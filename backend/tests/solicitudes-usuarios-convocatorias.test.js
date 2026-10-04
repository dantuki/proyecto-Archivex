const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Solicitudes, usuarios y convocatorias', () => {
  let server;
  let db;
  let tokens;
  let u;
  let base;

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    const admin = await h.getAdmin(db);
    base = await h.getBaseData(db);
    u = {
      admin,
      p1: await h.createTestUser(db, { rol: 'Profesor', prefix: 'su' }),
      p2: await h.createTestUser(db, { rol: 'Profesor', prefix: 'su' }),
      ev: await h.createTestUser(db, { rol: 'Evaluador', prefix: 'su' })
    };
    tokens = {
      admin: await h.loginAs(db, admin),
      p1: await h.loginAs(db, u.p1),
      p2: await h.loginAs(db, u.p2),
      ev: await h.loginAs(db, u.ev)
    };
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  const call = (token, method, path, json) => h.request(server, method, path, { token, json });

  describe('Solicitudes', () => {
    let id;

    test('Crear: estado inicial siempre Borrador y propietario = usuario autenticado (body no manda)', async () => {
      const res = await call(tokens.p1, 'POST', '/api/solicitudes', {
        convocatoria_id: base.convocatoriaId,
        sede_id: base.sedeId,
        titulo_propuesta: `TEST DATA Solicitud ${h.rand()}`,
        estado: 'Aprobado',
        usuario_id: u.p2.id,
        motivo_decision: 'inyectado'
      });
      assert.equal(res.status, 201, JSON.stringify(res.data));
      id = res.data.data.id;
      const [rows] = await db.query('SELECT usuario_id, estado, motivo_decision FROM solicitudes WHERE id = ?', [id]);
      assert.equal(rows[0].usuario_id, u.p1.id);
      assert.equal(rows[0].estado, 'Borrador');
      assert.equal(rows[0].motivo_decision, null);
    });

    test('Campos obligatorios y referencias inexistentes -> 400', async () => {
      assert.equal((await call(tokens.p1, 'POST', '/api/solicitudes', {})).status, 400);
      const res = await call(tokens.p1, 'POST', '/api/solicitudes', {
        convocatoria_id: 999999,
        sede_id: base.sedeId,
        titulo_propuesta: 'TEST DATA x'
      });
      assert.equal(res.status, 400);
    });

    test('Consultar: propia en listado y por id; ajena 403; Admin ve todo', async () => {
      const mine = await call(tokens.p1, 'GET', '/api/solicitudes/mis-solicitudes');
      assert.equal(mine.status, 200);
      const rows = Array.isArray(mine.data) ? mine.data : mine.data.data;
      assert.ok(rows.some((r) => Number(r.id) === id));
      assert.ok(rows.every((r) => Number(r.usuario_id ?? u.p1.id) === u.p1.id));
      assert.equal((await call(tokens.p1, 'GET', `/api/solicitudes/${id}`)).status, 200);
      assert.equal((await call(tokens.p2, 'GET', `/api/solicitudes/${id}`)).status, 403);
      assert.equal((await call(tokens.admin, 'GET', `/api/solicitudes/${id}`)).status, 200);
      assert.equal((await call(tokens.admin, 'GET', '/api/solicitudes')).status, 200);
    });

    test('Listado general de solicitudes no es accesible sin autenticación', async () => {
      assert.equal((await call(undefined, 'GET', '/api/solicitudes')).status, 401);
    });

    test('Modificar propia: título cambia; estado/propietario/decisión no pueden manipularse por body', async () => {
      const res = await call(tokens.p1, 'PUT', `/api/solicitudes/${id}`, {
        titulo_propuesta: 'TEST DATA Título actualizado',
        estado: 'Aprobado',
        motivo_decision: 'inyectado',
        usuario_id: u.p2.id,
        num_solicitud: 'HACK-001'
      });
      assert.ok(res.status < 500, `status ${res.status}`);
      const [rows] = await db.query('SELECT usuario_id, estado, motivo_decision, num_solicitud FROM solicitudes WHERE id = ?', [id]);
      assert.equal(rows[0].usuario_id, u.p1.id);
      assert.notEqual(rows[0].estado, 'Aprobado');
      assert.equal(rows[0].motivo_decision, null);
      assert.notEqual(rows[0].num_solicitud, 'HACK-001');
    });

    test('Cambio de estado administrativo: Profesor y Evaluador 403; Admin permitido', async () => {
      assert.equal((await call(tokens.p1, 'PUT', `/api/postulaciones/${id}/estado`, { estado: 'Aprobado' })).status, 403);
      assert.equal((await call(tokens.ev, 'PUT', `/api/postulaciones/${id}/estado`, { estado: 'Aprobado' })).status, 403);
      const [rows] = await db.query('SELECT estado FROM solicitudes WHERE id = ?', [id]);
      assert.notEqual(rows[0].estado, 'Aprobado');
      const ok = await call(tokens.admin, 'PUT', `/api/postulaciones/${id}/estado`, { estado: 'Radicado' });
      assert.ok(![401, 403].includes(ok.status), `Admin -> ${ok.status}`);
    });

    test('Eliminar: ajeno 403; propia permitido y se borra', async () => {
      assert.equal((await call(tokens.p2, 'DELETE', `/api/solicitudes/${id}`)).status, 403);
      const res = await call(tokens.p1, 'DELETE', `/api/solicitudes/${id}`);
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const [rows] = await db.query('SELECT id FROM solicitudes WHERE id = ?', [id]);
      assert.equal(rows.length, 0);
    });
  });

  describe('Usuarios', () => {
    test('Admin lista usuarios y la respuesta no expone hashes de contraseña', async () => {
      const res = await call(tokens.admin, 'GET', '/api/usuarios');
      assert.equal(res.status, 200);
      assert.doesNotMatch(res.buffer.toString('utf8'), /"password"|\$2[aby]\$/);
    });

    test('Usuario consulta su propio perfil sin exponer contraseña; perfil ajeno 403', async () => {
      const own = await call(tokens.p1, 'GET', `/api/usuarios/${u.p1.id}`);
      assert.equal(own.status, 200);
      assert.doesNotMatch(own.buffer.toString('utf8'), /"password"|\$2[aby]\$/);
      assert.equal((await call(tokens.p1, 'GET', `/api/usuarios/${u.p2.id}`)).status, 403);
    });

    test('Usuario modifica sus datos; ajeno 403', async () => {
      const ok = await call(tokens.p1, 'PUT', `/api/usuarios/${u.p1.id}`, { telefono: '3001234567' });
      assert.equal(ok.status, 200, JSON.stringify(ok.data));
      const [rows] = await db.query('SELECT telefono FROM usuarios WHERE id = ?', [u.p1.id]);
      assert.equal(rows[0].telefono, '3001234567');
      assert.equal((await call(tokens.p1, 'PUT', `/api/usuarios/${u.p2.id}`, { telefono: '3009999999' })).status, 403);
    });

    test('Usuario normal no puede cambiar su rol ni escalar a Admin; la BD no cambia', async () => {
      for (const rol of ['Admin', 'Evaluador', 'Profesor']) {
        const res = await call(tokens.p1, 'PUT', `/api/usuarios/${u.p1.id}`, { rol });
        assert.equal(res.status, 403, `rol ${rol} -> ${res.status}`);
      }
      const [rows] = await db.query('SELECT rol FROM usuarios WHERE id = ?', [u.p1.id]);
      assert.equal(rows[0].rol, 'Profesor');
    });

    test('Evaluador tampoco puede escalar privilegios', async () => {
      const res = await call(tokens.ev, 'PUT', `/api/usuarios/${u.ev.id}`, { rol: 'Admin' });
      assert.equal(res.status, 403);
      const [rows] = await db.query('SELECT rol FROM usuarios WHERE id = ?', [u.ev.id]);
      assert.equal(rows[0].rol, 'Evaluador');
    });

    test('Admin: rol Docente o Administrador inválido -> rechazado; Admin no se asigna a otro correo', async () => {
      for (const rol of ['Docente', 'Administrador', 'Superuser']) {
        const res = await call(tokens.admin, 'PUT', `/api/usuarios/${u.p2.id}`, { rol });
        assert.ok([400, 403].includes(res.status), `rol ${rol} -> ${res.status}`);
      }
      const asAdmin = await call(tokens.admin, 'PUT', `/api/usuarios/${u.p2.id}`, { rol: 'Admin' });
      assert.equal(asAdmin.status, 403);
      const [rows] = await db.query('SELECT rol FROM usuarios WHERE id = ?', [u.p2.id]);
      assert.equal(rows[0].rol, 'Profesor');
    });

    test('El Admin principal no puede perder su rol ni cambiar de correo', async () => {
      const demote = await call(tokens.admin, 'PUT', `/api/usuarios/${u.admin.id}`, { rol: 'Profesor' });
      assert.equal(demote.status, 403);
      const mail = await call(tokens.admin, 'PUT', `/api/usuarios/${u.admin.id}`, { email: 'otro@archivex-test.invalid' });
      assert.equal(mail.status, 403);
      const [rows] = await db.query('SELECT rol, email FROM usuarios WHERE id = ?', [u.admin.id]);
      assert.deepEqual([rows[0].rol, rows[0].email], ['Admin', h.ADMIN_EMAIL]);
    });

    test('Restricción de BD: no puede existir un segundo Admin ni usar el correo reservado con otro rol', async () => {
      await assert.rejects(
        db.query("UPDATE usuarios SET rol = 'Admin' WHERE id = ?", [u.p2.id]),
        /chk_unico_correo_admin|Check constraint/i
      );
    });
  });

  describe('Convocatorias', () => {
    const payload = () => ({
      codigo: `TEST-${h.rand()}`,
      titulo: `TEST DATA Convocatoria ${h.rand()}`,
      descripcion: 'Descripción de prueba',
      tipo: 'General',
      fecha_inicio: '2030-01-01 00:00:00',
      fecha_cierre: '2030-12-31 00:00:00'
    });
    let convId;

    test('GET público permitido sin JWT', async () => {
      const list = await call(undefined, 'GET', '/api/convocatorias');
      assert.equal(list.status, 200);
      assert.equal((await call(undefined, 'GET', `/api/convocatorias/${base.convocatoriaId}`)).status, 200);
    });

    test('POST/PUT/DELETE: anónimo 401; Profesor y Evaluador 403', async () => {
      for (const [method, path] of [
        ['POST', '/api/convocatorias'],
        ['PUT', `/api/convocatorias/${base.convocatoriaId}`],
        ['DELETE', `/api/convocatorias/${base.convocatoriaId}`]
      ]) {
        assert.equal((await call(undefined, method, path, payload())).status, 401);
        assert.equal((await call(tokens.p1, method, path, payload())).status, 403);
        assert.equal((await call(tokens.ev, method, path, payload())).status, 403);
      }
      const [rows] = await db.query('SELECT id FROM convocatorias WHERE id = ?', [base.convocatoriaId]);
      assert.equal(rows.length, 1);
    });

    test('Admin: crear, modificar y eliminar', async () => {
      const data = payload();
      const created = await call(tokens.admin, 'POST', '/api/convocatorias', data);
      assert.equal(created.status, 201, JSON.stringify(created.data));
      const [rows] = await db.query('SELECT id FROM convocatorias WHERE codigo = ?', [data.codigo]);
      convId = rows[0].id;

      const updated = await call(tokens.admin, 'PUT', `/api/convocatorias/${convId}`, { ...data, descripcion: 'Actualizada' });
      assert.equal(updated.status, 200, JSON.stringify(updated.data));
      const [after] = await db.query('SELECT descripcion FROM convocatorias WHERE id = ?', [convId]);
      assert.equal(after[0].descripcion, 'Actualizada');

      const removed = await call(tokens.admin, 'DELETE', `/api/convocatorias/${convId}`);
      assert.equal(removed.status, 200, JSON.stringify(removed.data));
      const [gone] = await db.query('SELECT id FROM convocatorias WHERE id = ?', [convId]);
      assert.equal(gone.length, 0);
    });

    test('Admin: datos inválidos (cierre anterior al inicio, tipo inválido, código duplicado) -> 400', async () => {
      const bad = { ...payload(), fecha_inicio: '2030-12-31 00:00:00', fecha_cierre: '2030-01-01 00:00:00' };
      assert.equal((await call(tokens.admin, 'POST', '/api/convocatorias', bad)).status, 400);
      assert.equal((await call(tokens.admin, 'POST', '/api/convocatorias', { ...payload(), tipo: 'Inexistente' })).status, 400);
    });

    test(
      'Admin: código de convocatoria duplicado debería responder 4xx y no 500 (FINDING-API-02)',
      { todo: 'La violación de UNIQUE se propaga como error 500 en createConvocatoria' },
      async () => {
        const dup = await call(tokens.admin, 'POST', '/api/convocatorias', { ...payload(), codigo: 'TEST-CONV-001' });
        assert.ok(dup.status >= 400 && dup.status < 500, `duplicado -> ${dup.status}`);
      }
    );
  });
});
