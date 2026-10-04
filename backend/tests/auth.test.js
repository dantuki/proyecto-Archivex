const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');

describe('Autenticación (JWT y sesiones)', () => {
  let server;
  let db;
  let admin;
  const users = {};

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
    admin = await h.getAdmin(db);
    users.prof = await h.createTestUser(db, { rol: 'Profesor', prefix: 'auth' });
    users.eval = await h.createTestUser(db, { rol: 'Evaluador', prefix: 'auth' });
    users.unverified = await h.createTestUser(db, { rol: 'Profesor', prefix: 'auth', verified: false });
    users.disabled = await h.createTestUser(db, { rol: 'Profesor', prefix: 'auth', status: 'disabled' });
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  const protectedGet = (token, extra = {}) =>
    h.request(server, 'GET', '/api/asignaciones', { token, ...extra });

  test('A. endpoint protegido sin JWT -> 401', async () => {
    assert.equal((await protectedGet()).status, 401);
  });

  test('B. JWT inválido -> 401 (formato, firma incorrecta, alg none, valores nulos)', async () => {
    assert.equal((await protectedGet('abc.def.ghi')).status, 401);
    assert.equal((await protectedGet(undefined, { rawAuth: 'Token xyz' })).status, 401);
    assert.equal((await protectedGet('null')).status, 401);
    assert.equal((await protectedGet('undefined')).status, 401);

    const otraFirma = h.signToken(users.eval, { secret: 'otro-secreto-distinto-de-al-menos-32-caracteres' });
    assert.equal((await protectedGet(otraFirma)).status, 401);

    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ id: admin.id, rol: 'Admin', email: h.ADMIN_EMAIL })).toString('base64url');
    assert.equal((await protectedGet(`${header}.${body}.`)).status, 401);
  });

  test('C. JWT expirado -> 401', async () => {
    const sid = await h.createSession(db, users.eval.id);
    const expired = h.signToken(users.eval, { sid, expiresIn: -60 });
    assert.equal((await protectedGet(expired)).status, 401);
  });

  test('F. sesión revocada o vencida -> 401', async () => {
    const revokedSid = await h.createSession(db, users.eval.id, { revoked: true });
    const revoked = h.signToken(users.eval, { sid: revokedSid });
    assert.equal((await protectedGet(revoked)).status, 401);

    const expiredSid = await h.createSession(db, users.eval.id, { expiresSql: 'DATE_SUB(NOW(), INTERVAL 1 HOUR)' });
    assert.equal((await protectedGet(h.signToken(users.eval, { sid: expiredSid }))).status, 401);

    const activeSid = await h.createSession(db, users.eval.id);
    const active = h.signToken(users.eval, { sid: activeSid });
    assert.equal((await protectedGet(active)).status, 200);
    await db.query('UPDATE login_sessions SET revoked_at = NOW() WHERE id = ?', [activeSid]);
    assert.equal((await protectedGet(active)).status, 401, 'revocar la sesión debe invalidar el JWT existente');
  });

  test('F2. sesión de otro usuario no es aceptada para este JWT -> 401', async () => {
    const foreignSid = await h.createSession(db, users.prof.id);
    assert.equal((await protectedGet(h.signToken(users.eval, { sid: foreignSid }))).status, 401);
  });

  test('G. Admin autorizado -> permitido', async () => {
    const token = await h.loginAs(db, admin);
    assert.equal((await h.request(server, 'GET', '/api/usuarios', { token })).status, 200);
  });

  test('G2. JWT de Admin con correo distinto al reservado -> 403', async () => {
    const sid = await h.createSession(db, admin.id);
    const forged = h.signToken(admin, { sid, email: 'otro.admin@archivex-test.invalid' });
    assert.equal((await h.request(server, 'GET', '/api/usuarios', { token: forged })).status, 403);
  });

  test('H. Profesor autorizado donde corresponde', async () => {
    const token = await h.loginAs(db, users.prof);
    assert.equal((await h.request(server, 'GET', '/api/postulaciones/mis-solicitudes', { token })).status, 200);
    assert.equal((await h.request(server, 'GET', '/api/solicitudes/mis-solicitudes', { token })).status, 200);
    assert.equal((await h.request(server, 'GET', '/api/settings/profile', { token })).status, 200);
  });

  test('I. Evaluador autorizado donde corresponde', async () => {
    const token = await h.loginAs(db, users.eval);
    assert.equal((await protectedGet(token)).status, 200);
    assert.equal((await h.request(server, 'GET', '/api/settings/profile', { token })).status, 200);
  });

  test('E. sesiones revocadas de un usuario desactivado -> 401', async () => {
    const sid = await h.createSession(db, users.disabled.id, { revoked: true });
    const token = h.signToken(users.disabled, { sid });
    assert.equal((await protectedGet(token)).status, 401);
  });

  test(
    'D. usuario sin correo verificado con JWT/sesión vigente -> 403 (FINDING-AUTH-01)',
    { todo: 'authMiddleware no consulta correo_verificado; solo login lo exige' },
    async () => {
      const token = await h.loginAs(db, users.unverified);
      const res = await h.request(server, 'GET', '/api/settings/profile', { token });
      assert.equal(res.status, 403);
    }
  );

  test(
    'E2. usuario desactivado con sesión vigente -> 403 (FINDING-AUTH-01)',
    { todo: 'authMiddleware no consulta account_status; las bajas confiables revocan sesiones' },
    async () => {
      const token = await h.loginAs(db, users.disabled);
      const res = await h.request(server, 'GET', '/api/settings/profile', { token });
      assert.equal(res.status, 403);
    }
  );

  test(
    'F3. JWT sin claim sid -> debe validarse contra sesiones (FINDING-AUTH-02)',
    { todo: 'authMiddleware omite la validación de sesión si el JWT no trae sid' },
    async () => {
      const token = h.signToken(users.eval);
      const res = await protectedGet(token);
      assert.equal(res.status, 401);
    }
  );

  test('CORS: origen permitido recibe cabecera; origen ajeno no', async () => {
    const ok = await h.request(server, 'GET', '/api/convocatorias', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const bad = await h.request(server, 'GET', '/api/convocatorias', { headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });

  test('Cabeceras de seguridad (helmet) presentes en la API', async () => {
    const res = await h.request(server, 'GET', '/api/convocatorias');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
  });

  test('El JWT firmado usa HS256 y el servidor rechaza HS512', async () => {
    const sid = await h.createSession(db, users.eval.id);
    const hs512 = jwt.sign({ id: users.eval.id, email: users.eval.email, rol: 'Evaluador', sid }, h.TEST_JWT_SECRET, {
      algorithm: 'HS512'
    });
    assert.equal((await protectedGet(hs512)).status, 401);
  });
});
