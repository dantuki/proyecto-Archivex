const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const registerBody = (overrides = {}) => ({
  nombre_completo: 'TEST DATA Registro',
  email: `reg.${h.rand()}@archivex-test.invalid`,
  password: 'Passw0rd-test-123',
  rol: 'Profesor',
  captchaToken: 'token-de-prueba-no-valido',
  ...overrides
});

describe('Registro público y roles (el reCAPTCHA real es dependencia externa)', () => {
  let server;
  let server2;
  let db;

  before(async () => {
    db = await h.connectDb();
    // Cada servidor tiene su propio limitador de registro (5 por hora por IP).
    server = await h.startServer();
    server2 = await h.startServer();
  });

  after(async () => {
    await server.stop();
    await server2.stop();
    await db.end();
  });

  const userExists = async (email) => {
    const [rows] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    return rows.length > 0;
  };

  test('Docente -> rechazado (400) y no se crea usuario', async () => {
    const body = registerBody({ rol: 'Docente' });
    const res = await h.request(server, 'POST', '/api/auth/register', { json: body });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /rol/i);
    assert.equal(await userExists(body.email), false);
  });

  test('Admin -> rechazado (403) y no se crea usuario', async () => {
    const body = registerBody({ rol: 'Admin' });
    const res = await h.request(server, 'POST', '/api/auth/register', { json: body });
    assert.equal(res.status, 403);
    assert.equal(await userExists(body.email), false);
  });

  test('Administrador -> rechazado (403) y no se crea usuario', async () => {
    const body = registerBody({ rol: 'Administrador' });
    const res = await h.request(server, 'POST', '/api/auth/register', { json: body });
    assert.equal(res.status, 403);
    assert.equal(await userExists(body.email), false);
  });

  test('Correo administrativo reservado no puede registrarse (403)', async () => {
    const res = await h.request(server, 'POST', '/api/auth/register', {
      json: registerBody({ email: h.ADMIN_EMAIL.toUpperCase(), rol: 'Profesor' })
    });
    assert.equal(res.status, 403);
    assert.match(res.data.error, /reservado/i);
    const [rows] = await db.query('SELECT COUNT(*) AS n FROM usuarios WHERE rol = ?', ['Admin']);
    assert.equal(rows[0].n, 1, 'debe existir un único Admin');
  });

  test('Profesor -> supera la validación de rol (se detiene en reCAPTCHA, EXTERNAL)', async () => {
    const body = registerBody({ rol: 'Profesor' });
    const res = await h.request(server, 'POST', '/api/auth/register', { json: body });
    assert.doesNotMatch(String(res.data?.error), /rol/i);
    assert.notEqual(res.status, 403);
    assert.equal(await userExists(body.email), false, 'sin reCAPTCHA válido no se crea la cuenta');
  });

  test('Evaluador -> supera la validación de rol (se detiene en reCAPTCHA, EXTERNAL)', async () => {
    const body = registerBody({ rol: 'Evaluador' });
    const res = await h.request(server2, 'POST', '/api/auth/register', { json: body });
    assert.doesNotMatch(String(res.data?.error), /rol/i);
    assert.notEqual(res.status, 403);
    assert.equal(await userExists(body.email), false);
  });

  test('Variantes de mayúsculas (docente, ADMIN) no son roles públicos', async () => {
    for (const rol of ['docente', 'ADMIN', 'admin', '']) {
      const res = await h.request(server2, 'POST', '/api/auth/register', { json: registerBody({ rol }) });
      assert.ok([400, 403].includes(res.status), `rol "${rol}" devolvió ${res.status}`);
    }
  });

  test('Validación estática: rolesPublicos es exactamente [Profesor, Evaluador]', () => {
    const source = fs.readFileSync(path.join(h.BACKEND_DIR, 'src/controllers/authController.js'), 'utf8');
    const match = source.match(/const rolesPublicos = \[([\s\S]*?)\]/);
    assert.ok(match);
    const roles = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(roles, ['Profesor', 'Evaluador']);
  });
});
