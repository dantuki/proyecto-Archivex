const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const h = require('./helpers');

describe('Recuperación de contraseña (sin correo real)', () => {
  let server;
  let db;

  before(async () => {
    db = await h.connectDb();
    server = await h.startServer();
  });

  after(async () => {
    await server.stop();
    await db.end();
  });

  const insertToken = async (userId, { expiresSql = 'DATE_ADD(NOW(), INTERVAL 30 MINUTE)', used = false } = {}) => {
    const token = h.rand() + h.rand() + h.rand() + h.rand();
    await db.query(
      `INSERT INTO password_reset_tokens (usuario_id, token_hash, expires_at, used_at)
       VALUES (?, ?, ${expiresSql}, ${used ? 'NOW()' : 'NULL'})`,
      [userId, h.hash(token)]
    );
    return token;
  };

  const reset = (token, password) => h.request(server, 'POST', '/api/auth/reset-password', { json: { token, password } });

  test('Solicitud: respuesta genérica idéntica exista o no la cuenta (sin enumeración)', async () => {
    const user = await h.createTestUser(db, { rol: 'Profesor', prefix: 'pr' });
    const known = await h.request(server, 'POST', '/api/auth/forgot-password', { json: { email: user.email } });
    const unknown = await h.request(server, 'POST', '/api/auth/forgot-password', {
      json: { email: `nadie.${h.rand()}@archivex-test.invalid` }
    });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.deepEqual(known.data, unknown.data);
  });

  test('Solicitud: se genera token almacenado como hash SHA-256 y se revocan las sesiones', async () => {
    const user = await h.createTestUser(db, { rol: 'Profesor', prefix: 'pr' });
    const sid = await h.createSession(db, user.id);
    const res = await h.request(server, 'POST', '/api/auth/forgot-password', { json: { email: user.email } });
    assert.equal(res.status, 200);
    const [tokens] = await db.query('SELECT token_hash, expires_at, used_at FROM password_reset_tokens WHERE usuario_id = ?', [user.id]);
    assert.equal(tokens.length, 1);
    assert.match(tokens[0].token_hash, /^[0-9a-f]{64}$/);
    // El SMTP de prueba es inalcanzable, así que el token se invalida al fallar el envío.
    assert.ok(tokens[0].used_at, 'sin entrega de correo el token queda invalidado');
    const [sessions] = await db.query('SELECT revoked_at FROM login_sessions WHERE id = ?', [sid]);
    assert.ok(sessions[0].revoked_at, 'las sesiones activas deben revocarse al solicitar recuperación');
  });

  test('Restablecer: token válido cambia la contraseña (bcrypt) y queda de un solo uso', async () => {
    const user = await h.createTestUser(db, { rol: 'Evaluador', prefix: 'pr' });
    const token = await insertToken(user.id);
    const [stored] = await db.query('SELECT token_hash FROM password_reset_tokens WHERE usuario_id = ?', [user.id]);
    assert.notEqual(stored[0].token_hash, token, 'el token no se guarda en texto plano');

    const newPassword = `Nueva-${h.rand()}-Clave`;
    const ok = await reset(token, newPassword);
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    const [rows] = await db.query('SELECT password FROM usuarios WHERE id = ?', [user.id]);
    assert.equal(await bcrypt.compare(newPassword, rows[0].password), true);
    assert.equal(await bcrypt.compare(user.passwordPlain, rows[0].password), false);

    const reuse = await reset(token, `Otra-${h.rand()}-Clave`);
    assert.equal(reuse.status, 400);
    assert.match(reuse.data.error, /utilizado/i);
  });

  test('Restablecer: token expirado, inexistente, ya usado o contraseña corta -> 400', async () => {
    const user = await h.createTestUser(db, { rol: 'Profesor', prefix: 'pr' });
    const expired = await insertToken(user.id, { expiresSql: 'DATE_SUB(NOW(), INTERVAL 1 MINUTE)' });
    const used = await insertToken(user.id, { used: true });
    const valid = await insertToken(user.id);

    assert.equal((await reset(expired, 'ClaveSegura-123')).status, 400);
    assert.equal((await reset('f'.repeat(64), 'ClaveSegura-123')).status, 400);
    assert.equal((await reset(used, 'ClaveSegura-123')).status, 400);
    assert.equal((await reset(valid, 'corta')).status, 400);
    assert.equal((await reset(undefined, 'ClaveSegura-123')).status, 400);

    const [rows] = await db.query('SELECT password FROM usuarios WHERE id = ?', [user.id]);
    assert.equal(await bcrypt.compare(user.passwordPlain, rows[0].password), true, 'la contraseña original no cambió');
  });

  test('Restablecer: invalida los demás tokens pendientes del usuario', async () => {
    const user = await h.createTestUser(db, { rol: 'Profesor', prefix: 'pr' });
    const first = await insertToken(user.id);
    const second = await insertToken(user.id);
    assert.equal((await reset(first, `Clave-${h.rand()}-Nueva`)).status, 200);
    assert.equal((await reset(second, `Clave-${h.rand()}-Otra`)).status, 400);
  });

  test(
    'Restablecer: debería revocar las sesiones existentes (FINDING-AUTH-03)',
    { todo: 'resetPassword no revoca login_sessions; solo lo hace forgotPassword al solicitar' },
    async () => {
      const user = await h.createTestUser(db, { rol: 'Profesor', prefix: 'pr' });
      const sid = await h.createSession(db, user.id);
      const token = await insertToken(user.id);
      assert.equal((await reset(token, `Clave-${h.rand()}-Nueva`)).status, 200);
      const [rows] = await db.query('SELECT revoked_at FROM login_sessions WHERE id = ?', [sid]);
      assert.ok(rows[0].revoked_at);
    }
  );
});
