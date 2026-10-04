const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

describe('Flujo completo de evaluación (base de pruebas)', () => {
  let server;
  let db;
  let tokens;
  let u;
  const state = {};

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    const admin = await h.getAdmin(db);
    u = {
      prof: await h.createTestUser(db, { rol: 'Profesor', prefix: 'flow' }),
      evA: await h.createTestUser(db, { rol: 'Evaluador', prefix: 'flow' })
    };
    tokens = {
      admin: await h.loginAs(db, admin),
      prof: await h.loginAs(db, u.prof),
      evA: await h.loginAs(db, u.evA)
    };
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  test('1. Profesor crea solicitud con documentos (Borrador, 4 documentos, archivos privados)', async () => {
    const res = await h.createSolicitudViaApi(server, db, tokens.prof, { title: 'TEST DATA Flujo' });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    state.solicitudId = res.data.data.id;
    const [sol] = await db.query('SELECT usuario_id, estado FROM solicitudes WHERE id = ?', [state.solicitudId]);
    assert.equal(sol[0].usuario_id, u.prof.id);
    assert.equal(sol[0].estado, 'Borrador');
    const [docs] = await db.query('SELECT id, archivo_url, tipo_documento FROM documentos_solicitud WHERE solicitud_id = ?', [state.solicitudId]);
    assert.equal(docs.length, 4);
    state.docId = docs.find((d) => d.tipo_documento === 'Presupuesto').id;
    state.docFile = path.basename(docs[0].archivo_url);
    for (const d of docs) {
      assert.ok(fs.existsSync(path.join(h.PRIVATE_DIR, path.basename(d.archivo_url))));
    }
  });

  test('2. Documentos privados no se exponen como estáticos', async () => {
    for (const p of [`/uploads/${state.docFile}`, `/uploads_private/${state.docFile}`, `/uploads/../uploads_private/${state.docFile}`, '/uploads/']) {
      const res = await h.request(server, 'GET', p);
      assert.equal(res.status, 404, `${p} -> ${res.status}`);
    }
  });

  test('3. Admin no puede asignar a un usuario que no es Evaluador', async () => {
    const res = await h.request(server, 'POST', '/api/asignaciones', {
      token: tokens.admin,
      json: { postulacionId: state.solicitudId, evaluadorId: u.prof.id }
    });
    assert.ok(res.status >= 400, `status ${res.status}`);
    const [rows] = await db.query('SELECT id FROM asignacion_evaluaciones WHERE solicitud_id = ?', [state.solicitudId]);
    assert.equal(rows.length, 0);
  });

  test(
    '3b. Asignar a un no-Evaluador debería responder 4xx y no 500 (FINDING-API-01)',
    { todo: 'Asignacion.create lanza Error genérico y el controller responde 500 ante datos inválidos' },
    async () => {
      const res = await h.request(server, 'POST', '/api/asignaciones', {
        token: tokens.admin,
        json: { postulacionId: state.solicitudId, evaluadorId: u.prof.id }
      });
      assert.ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
    }
  );

  test('4. Admin asigna al Evaluador A y la asignación persiste', async () => {
    const res = await h.request(server, 'POST', '/api/asignaciones', {
      token: tokens.admin,
      json: { postulacionId: state.solicitudId, evaluadorId: u.evA.id }
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    state.asignacionId = res.data.id;
    const [rows] = await db.query('SELECT solicitud_id, evaluador_id, estado_evaluacion FROM asignacion_evaluaciones WHERE id = ?', [state.asignacionId]);
    assert.deepEqual(
      [rows[0].solicitud_id, rows[0].evaluador_id, rows[0].estado_evaluacion],
      [state.solicitudId, u.evA.id, 'Asignado']
    );
    const again = await h.request(server, 'POST', '/api/asignaciones', {
      token: tokens.admin,
      json: { postulacionId: state.solicitudId, evaluadorId: u.evA.id }
    });
    const [count] = await db.query('SELECT COUNT(*) AS n FROM asignacion_evaluaciones WHERE solicitud_id = ?', [state.solicitudId]);
    assert.equal(count[0].n, 1, `la asignación duplicada no debe crear otra fila (status ${again.status})`);
  });

  test('5. Evaluador A ve su asignación con datos de la propuesta', async () => {
    const res = await h.request(server, 'GET', '/api/asignaciones', { token: tokens.evA });
    assert.equal(res.status, 200);
    const rows = Array.isArray(res.data) ? res.data : res.data.data;
    const mine = rows.find((r) => Number(r.asignacion_id) === state.asignacionId);
    assert.ok(mine);
    assert.match(String(mine.titulo_propuesta), /TEST DATA Flujo/);
  });

  test('6. Evaluador A comenta un documento (autor y documento correctos, persiste)', async () => {
    const res = await h.request(server, 'POST', `/api/solicitudes/${state.solicitudId}/documentos/${state.docId}/comentarios`, {
      token: tokens.evA,
      json: { comment: 'Documento revisado correctamente durante la prueba E2E.' }
    });
    assert.equal(res.status, 201);
    const [rows] = await db.query('SELECT usuario_id, documento_id, comentario FROM document_comments WHERE documento_id = ?', [state.docId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].usuario_id, u.evA.id);
    const empty = await h.request(server, 'POST', `/api/solicitudes/${state.solicitudId}/documentos/${state.docId}/comentarios`, {
      token: tokens.evA,
      json: { comment: '   ' }
    });
    assert.equal(empty.status, 400);
    const long = await h.request(server, 'POST', `/api/solicitudes/${state.solicitudId}/documentos/${state.docId}/comentarios`, {
      token: tokens.evA,
      json: { comment: 'x'.repeat(5001) }
    });
    assert.equal(long.status, 400);
  });

  test('7. Calificación fuera de rango o inválida se rechaza (400) sin modificar la BD', async () => {
    for (const puntaje of [-1, 101, 'abc', 100.01]) {
      const res = await h.request(server, 'PUT', `/api/asignaciones/${state.asignacionId}/calificar`, {
        token: tokens.evA,
        json: { puntaje, comentarios: 'x' }
      });
      assert.equal(res.status, 400, `puntaje ${puntaje} -> ${res.status}`);
    }
    const [rows] = await db.query('SELECT puntaje, estado_evaluacion FROM asignacion_evaluaciones WHERE id = ?', [state.asignacionId]);
    assert.equal(Number(rows[0].puntaje), 0);
    assert.equal(rows[0].estado_evaluacion, 'Asignado');
  });

  test('8. Evaluador A califica 85 con retroalimentación y archivo opcional; queda Finalizado', async () => {
    const form = h.buildForm(
      { puntaje: 85, comentarios: 'Evaluación E2E de prueba realizada correctamente.' },
      [h.pdfFile('archivo_evaluacion', 'retroalimentacion.pdf')]
    );
    const res = await h.request(server, 'PUT', `/api/asignaciones/${state.asignacionId}/calificar`, { token: tokens.evA, form });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const [rows] = await db.query(
      'SELECT puntaje, comentarios, archivo_evaluacion, estado_evaluacion, evaluador_id, solicitud_id FROM asignacion_evaluaciones WHERE id = ?',
      [state.asignacionId]
    );
    assert.equal(Number(rows[0].puntaje), 85);
    assert.equal(rows[0].comentarios, 'Evaluación E2E de prueba realizada correctamente.');
    assert.equal(rows[0].estado_evaluacion, 'Finalizado');
    assert.equal(rows[0].evaluador_id, u.evA.id);
    assert.equal(rows[0].solicitud_id, state.solicitudId);
    assert.match(rows[0].archivo_evaluacion, /^uploads_private\//);
    state.evalFile = path.basename(rows[0].archivo_evaluacion);
    assert.ok(fs.existsSync(path.join(h.PRIVATE_DIR, state.evalFile)));
  });

  test('9. El acta de evaluación es privada: el Evaluador dueño la descarga, sin JWT 401', async () => {
    const own = await h.request(server, 'GET', `/api/archivos-privados/${state.evalFile}`, { token: tokens.evA });
    assert.equal(own.status, 200);
    assert.equal((await h.request(server, 'GET', `/api/archivos-privados/${state.evalFile}`)).status, 401);
    assert.equal((await h.request(server, 'GET', `/uploads/${state.evalFile}`)).status, 404);
  });

  test('10. Admin consulta evaluador, calificación 85, retroalimentación y comentario', async () => {
    const res = await h.request(server, 'GET', `/api/asignaciones/${state.asignacionId}`, { token: tokens.admin });
    assert.equal(res.status, 200);
    const row = res.data.data || res.data;
    assert.equal(Number(row.puntaje), 85);
    assert.equal(Number(row.evaluador_id), u.evA.id);
    assert.equal(row.comentarios, 'Evaluación E2E de prueba realizada correctamente.');
    assert.equal(row.estado_evaluacion, 'Finalizado');

    const timeline = await h.request(server, 'GET', `/api/solicitudes/${state.solicitudId}/cronologia`, { token: tokens.admin });
    assert.equal(timeline.status, 200);
    assert.equal(timeline.data.data.comments.length, 1);
    assert.match(timeline.data.data.comments[0].comentario, /prueba E2E/);
  });

  test('11. Trazabilidad: eventos realmente registrados', async (t) => {
    const [rows] = await db.query(
      'SELECT estado_anterior, estado_nuevo, motivo_cambio FROM trazabilidad_solicitudes WHERE solicitud_id = ? ORDER BY id',
      [state.solicitudId]
    );
    t.diagnostic(`Eventos de trazabilidad: ${rows.map((r) => `${r.estado_anterior ?? '∅'}->${r.estado_nuevo}`).join(' | ')}`);
    assert.ok(rows.length >= 1);
    assert.equal(rows[0].estado_nuevo, 'Borrador');
    assert.match(rows[0].motivo_cambio, /Creación inicial/);
    const [sol] = await db.query('SELECT estado FROM solicitudes WHERE id = ?', [state.solicitudId]);
    t.diagnostic(`Estado de la solicitud tras finalizar la evaluación: ${sol[0].estado}`);
  });

  test(
    '12. Asignar y calificar deberían registrar eventos en trazabilidad (FINDING-TRACE-01)',
    { todo: 'La asignación y la calificación no escriben en trazabilidad_solicitudes' },
    async () => {
      const [rows] = await db.query('SELECT motivo_cambio FROM trazabilidad_solicitudes WHERE solicitud_id = ?', [state.solicitudId]);
      assert.ok(rows.some((r) => /asign/i.test(r.motivo_cambio)), 'falta evento de asignación');
      assert.ok(rows.some((r) => /evalua|calific/i.test(r.motivo_cambio)), 'falta evento de evaluación');
    }
  );
});
