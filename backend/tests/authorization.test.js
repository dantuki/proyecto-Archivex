const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Autorización por rol (matriz de endpoints)', () => {
  let server;
  let db;
  let tokens;
  let target;

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    const admin = await h.getAdmin(db);
    const prof = await h.createTestUser(db, { rol: 'Profesor', prefix: 'authz' });
    const evaluador = await h.createTestUser(db, { rol: 'Evaluador', prefix: 'authz' });
    target = await h.createTestUser(db, { rol: 'Profesor', prefix: 'authz-target' });
    tokens = {
      admin: await h.loginAs(db, admin),
      prof: await h.loginAs(db, prof),
      eval: await h.loginAs(db, evaluador),
      anon: undefined
    };
    tokens.profUser = prof;
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  const call = (role, method, path, extra = {}) =>
    h.request(server, method, path, { token: tokens[role], ...extra });

  // Solo operaciones seguras para ejecutar con Admin; las destructivas se prueban solo con roles sin permiso.
  const adminOnlyReads = [
    ['GET', '/api/usuarios'],
    ['GET', '/api/usuarios/evaluadores'],
    ['GET', '/api/asignaciones/todas'],
    ['GET', '/api/postulaciones'],
    ['GET', '/api/settings/admin/pending-deletions'],
    ['GET', '/api/settings/admin/activity'],
    ['GET', '/api/reportes/convocatorias'],
    ['GET', '/api/reportes/sedes-demografia'],
    ['GET', '/api/reportes/evaluadores'],
    ['GET', '/api/reportes/proyectos-titulos']
  ];

  for (const [method, path] of adminOnlyReads) {
    test(`${method} ${path}: anónimo 401, Profesor 403, Evaluador 403, Admin 200`, async () => {
      assert.equal((await call('anon', method, path)).status, 401);
      assert.equal((await call('prof', method, path)).status, 403);
      assert.equal((await call('eval', method, path)).status, 403);
      assert.equal((await call('admin', method, path)).status, 200);
    });
  }

  const adminOnlyMutations = [
    ['POST', '/api/usuarios/registro', { json: {} }],
    ['DELETE', '/api/usuarios/mantenimiento/purgar-todo'],
    ['DELETE', '/api/usuarios/999999'],
    ['POST', '/api/asignaciones', { json: { solicitud_id: 1, evaluador_id: 1 } }],
    ['DELETE', '/api/asignaciones/999999'],
    ['POST', '/api/convocatorias', { json: {} }],
    ['PUT', '/api/convocatorias/999999', { json: {} }],
    ['DELETE', '/api/convocatorias/999999'],
    ['POST', '/api/sedes', { json: { nombre_sede: 'TEST' } }],
    ['PUT', '/api/sedes/999999', { json: { nombre_sede: 'TEST' } }],
    ['DELETE', '/api/sedes/999999'],
    ['PUT', '/api/postulaciones/999999/estado', { json: { estado: 'Aprobado' } }],
    ['PATCH', '/api/solicitudes/1/documentos/1/revision', { json: { status: 'validated' } }],
    ['DELETE', '/api/settings/admin/pending-deletions/999999'],
    ['POST', '/api/settings/admin/pending-deletions/999999/anonymize']
  ];

  for (const [method, path, extra] of adminOnlyMutations) {
    test(`${method} ${path}: anónimo 401, Profesor 403, Evaluador 403`, async () => {
      assert.equal((await call('anon', method, path, extra)).status, 401);
      assert.equal((await call('prof', method, path, extra)).status, 403);
      assert.equal((await call('eval', method, path, extra)).status, 403);
    });
  }

  test('Admin sobre recursos inexistentes no recibe 401/403 (autorizado)', async () => {
    for (const [method, path] of [
      ['DELETE', '/api/usuarios/999999'],
      ['DELETE', '/api/asignaciones/999999'],
      ['DELETE', '/api/convocatorias/999999'],
      ['DELETE', '/api/sedes/999999']
    ]) {
      const res = await call('admin', method, path);
      assert.ok(![401, 403].includes(res.status), `${method} ${path} -> ${res.status}`);
    }
  });

  test('Profesor no puede evaluar: PUT /asignaciones/:id/calificar -> 403', async () => {
    const res = await call('prof', 'PUT', '/api/asignaciones/1/calificar', { json: { puntaje: 90 } });
    assert.equal(res.status, 403);
  });

  test('Profesor no accede a asignaciones del Evaluador', async () => {
    assert.equal((await call('prof', 'GET', '/api/asignaciones')).status, 403);
    assert.equal((await call('prof', 'GET', '/api/asignaciones/evaluador/1')).status, 403);
    assert.equal((await call('prof', 'GET', '/api/asignaciones/1')).status, 403);
  });

  test('Comentar documentos es exclusivo del Evaluador (Profesor y Admin -> 403)', async () => {
    const extra = { json: { comment: 'x' } };
    assert.equal((await call('prof', 'POST', '/api/solicitudes/1/documentos/1/comentarios', extra)).status, 403);
    assert.equal((await call('admin', 'POST', '/api/solicitudes/1/documentos/1/comentarios', extra)).status, 403);
    assert.equal((await call('anon', 'POST', '/api/solicitudes/1/documentos/1/comentarios', extra)).status, 401);
  });

  test('Evaluador no gestiona usuarios ni reportes', async () => {
    assert.equal((await call('eval', 'GET', '/api/usuarios')).status, 403);
    assert.equal((await call('eval', 'GET', '/api/reportes/evaluadores')).status, 403);
  });

  test('Lectura pública de convocatorias y sedes', async () => {
    assert.equal((await call('anon', 'GET', '/api/convocatorias')).status, 200);
    assert.equal((await call('anon', 'GET', '/api/sedes')).status, 200);
  });

  test('Usuario normal no puede ver ni modificar a otro usuario (IDOR)', async () => {
    assert.equal((await call('prof', 'GET', `/api/usuarios/${target.id}`)).status, 403);
    assert.equal((await call('prof', 'PUT', `/api/usuarios/${target.id}`, { json: { telefono: '3000000000' } })).status, 403);
    const [rows] = await db.query('SELECT telefono FROM usuarios WHERE id = ?', [target.id]);
    assert.equal(rows[0].telefono, null);
  });

  test('Los reportes devuelven XLSX para Admin', async () => {
    const res = await call('admin', 'GET', '/api/reportes/convocatorias');
    assert.match(res.headers.get('content-type') || '', /spreadsheetml|octet-stream/);
    assert.equal(res.buffer.subarray(0, 2).toString('utf8'), 'PK');
  });
});
