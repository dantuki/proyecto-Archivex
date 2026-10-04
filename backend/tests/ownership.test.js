const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

describe('Ownership / IDOR entre Evaluadores y Profesores', () => {
  let server;
  let db;
  let admin;
  let tokens;
  let u;
  let s; // solicitudes
  let a; // asignaciones
  let docs; // documentos y archivos privados

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    admin = await h.getAdmin(db);
    u = {
      p1: await h.createTestUser(db, { rol: 'Profesor', prefix: 'own' }),
      p2: await h.createTestUser(db, { rol: 'Profesor', prefix: 'own' }),
      evA: await h.createTestUser(db, { rol: 'Evaluador', prefix: 'own' }),
      evB: await h.createTestUser(db, { rol: 'Evaluador', prefix: 'own' })
    };
    tokens = {
      admin: await h.loginAs(db, admin),
      p1: await h.loginAs(db, u.p1),
      p2: await h.loginAs(db, u.p2),
      evA: await h.loginAs(db, u.evA),
      evB: await h.loginAs(db, u.evB)
    };

    const resA = await h.createSolicitudViaApi(server, db, tokens.p1, { title: 'TEST DATA A' });
    const resB = await h.createSolicitudViaApi(server, db, tokens.p2, { title: 'TEST DATA B' });
    assert.equal(resA.status, 201, JSON.stringify(resA.data));
    assert.equal(resB.status, 201, JSON.stringify(resB.data));
    s = { A: resA.data.data.id, B: resB.data.data.id };

    const asigA = await h.request(server, 'POST', '/api/asignaciones', {
      token: tokens.admin,
      json: { postulacionId: s.A, evaluadorId: u.evA.id }
    });
    const asigB = await h.request(server, 'POST', '/api/asignaciones', {
      token: tokens.admin,
      json: { postulacionId: s.B, evaluadorId: u.evB.id }
    });
    assert.equal(asigA.status, 201, JSON.stringify(asigA.data));
    assert.equal(asigB.status, 201, JSON.stringify(asigB.data));
    a = { A: asigA.data.id, B: asigB.data.id };

    const doc = async (sid) => {
      const [rows] = await db.query(
        "SELECT id, archivo_url FROM documentos_solicitud WHERE solicitud_id = ? AND tipo_documento = 'Presupuesto'",
        [sid]
      );
      return { id: rows[0].id, file: path.basename(rows[0].archivo_url) };
    };
    docs = { A: await doc(s.A), B: await doc(s.B) };
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  const get = (token, p) => h.request(server, 'GET', p, { token });

  test('Evaluador A -> asignación A permitido; asignación B 403', async () => {
    assert.equal((await get(tokens.evA, `/api/asignaciones/${a.A}`)).status, 200);
    assert.equal((await get(tokens.evA, `/api/asignaciones/${a.B}`)).status, 403);
  });

  test('Evaluador B -> asignación B permitido; asignación A 403', async () => {
    assert.equal((await get(tokens.evB, `/api/asignaciones/${a.B}`)).status, 200);
    assert.equal((await get(tokens.evB, `/api/asignaciones/${a.A}`)).status, 403);
  });

  test('Listados por evaluador: propio permitido, ajeno 403, y la lista general solo trae lo propio', async () => {
    assert.equal((await get(tokens.evA, `/api/asignaciones/evaluador/${u.evA.id}`)).status, 200);
    assert.equal((await get(tokens.evA, `/api/asignaciones/evaluador/${u.evB.id}`)).status, 403);
    const list = await get(tokens.evA, '/api/asignaciones');
    assert.equal(list.status, 200);
    const rows = Array.isArray(list.data) ? list.data : list.data.data;
    assert.ok(rows.length >= 1);
    assert.ok(rows.every((r) => Number(r.evaluador_id) === u.evA.id));
  });

  test('Evaluador A no puede calificar ni eliminar la asignación B (403) y la BD no cambia', async () => {
    const grade = await h.request(server, 'PUT', `/api/asignaciones/${a.B}/calificar`, {
      token: tokens.evA,
      json: { puntaje: 99, comentarios: 'intento de IDOR' }
    });
    assert.equal(grade.status, 403);
    const del = await h.request(server, 'DELETE', `/api/asignaciones/${a.B}`, { token: tokens.evA });
    assert.equal(del.status, 403);
    const [rows] = await db.query('SELECT puntaje, estado_evaluacion FROM asignacion_evaluaciones WHERE id = ?', [a.B]);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].puntaje), 0);
    assert.equal(rows[0].estado_evaluacion, 'Asignado');
  });

  test('Documentos privados: propietario/evaluador asignado/Admin permitido; ajenos 403; sin JWT 401', async () => {
    const urlA = `/api/archivos-privados/${docs.A.file}`;
    const urlB = `/api/archivos-privados/${docs.B.file}`;

    const okEval = await get(tokens.evA, urlA);
    assert.equal(okEval.status, 200);
    assert.equal(okEval.buffer.subarray(0, 4).toString(), '%PDF');
    assert.equal((await get(tokens.evA, urlB)).status, 403);
    assert.equal((await get(tokens.evB, urlB)).status, 200);
    assert.equal((await get(tokens.evB, urlA)).status, 403);

    assert.equal((await get(tokens.p1, urlA)).status, 200);
    assert.equal((await get(tokens.p1, urlB)).status, 403);
    assert.equal((await get(tokens.p2, urlA)).status, 403);

    assert.equal((await get(tokens.admin, urlA)).status, 200);
    assert.equal((await get(tokens.admin, urlB)).status, 200);
    assert.equal((await get(undefined, urlA)).status, 401);
  });

  test('Archivo privado: nombres con traversal o extensión no permitida se rechazan', async () => {
    for (const name of ['..%2F..%2Fpackage.json', '%2E%2E%5C%2E%2E%5Cpackage.json', 'archivo.exe', 'archivo.pdf.exe']) {
      const res = await get(tokens.admin, `/api/archivos-privados/${name}`);
      assert.ok([400, 403, 404].includes(res.status), `${name} -> ${res.status}`);
    }
  });

  test('Comentarios: Evaluador A en documento A 201; en B 403; Evaluador B en A 403', async () => {
    const post = (token, sol, doc) =>
      h.request(server, 'POST', `/api/solicitudes/${sol}/documentos/${doc}/comentarios`, {
        token,
        json: { comment: 'Comentario de prueba de ownership.' }
      });
    assert.equal((await post(tokens.evA, s.A, docs.A.id)).status, 201);
    assert.equal((await post(tokens.evA, s.B, docs.B.id)).status, 403);
    assert.equal((await post(tokens.evB, s.A, docs.A.id)).status, 403);
    const [rows] = await db.query('SELECT usuario_id, documento_id FROM document_comments WHERE documento_id = ?', [docs.A.id]);
    assert.deepEqual(rows.map((r) => [r.usuario_id, r.documento_id]), [[u.evA.id, docs.A.id]]);
  });

  test('Cronología: dueño, evaluador asignado y Admin permitido; ajenos 403', async () => {
    assert.equal((await get(tokens.evA, `/api/solicitudes/${s.A}/cronologia`)).status, 200);
    assert.equal((await get(tokens.evA, `/api/solicitudes/${s.B}/cronologia`)).status, 403);
    assert.equal((await get(tokens.p1, `/api/solicitudes/${s.A}/cronologia`)).status, 200);
    assert.equal((await get(tokens.p2, `/api/solicitudes/${s.A}/cronologia`)).status, 403);
    assert.equal((await get(tokens.admin, `/api/solicitudes/${s.A}/cronologia`)).status, 200);
  });

  test('Solicitudes ajenas: Profesor y Evaluador no leen, modifican ni eliminan (403)', async () => {
    assert.equal((await get(tokens.p2, `/api/solicitudes/${s.A}`)).status, 403);
    assert.equal((await get(tokens.evA, `/api/solicitudes/${s.A}`)).status, 403);
    const put = await h.request(server, 'PUT', `/api/solicitudes/${s.A}`, {
      token: tokens.p2,
      json: { titulo_propuesta: 'hack' }
    });
    assert.equal(put.status, 403);
    const del = await h.request(server, 'DELETE', `/api/solicitudes/${s.A}`, { token: tokens.p2 });
    assert.equal(del.status, 403);
    const [rows] = await db.query('SELECT titulo_propuesta FROM solicitudes WHERE id = ?', [s.A]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].titulo_propuesta, 'hack');
  });

  test('Los archivos privados existen físicamente fuera de la carpeta pública', () => {
    assert.ok(fs.existsSync(path.join(h.PRIVATE_DIR, docs.A.file)));
    assert.equal(fs.existsSync(path.join(h.PUBLIC_DIR, docs.A.file)), false);
  });
});
