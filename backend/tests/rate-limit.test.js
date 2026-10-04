const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Rate limiting (sin servicios externos)', () => {
  let server;

  before(async () => {
    server = await h.startServer();
  });

  after(async () => {
    await server.stop();
  });

  // [descripción, ruta, cuerpo que falla rápido sin llamar a servicios externos, límite configurado]
  const limiters = [
    ['login', '/api/auth/login', {}, 10],
    ['registro', '/api/auth/register', {}, 5],
    ['recuperación', '/api/auth/forgot-password', {}, 5],
    ['restablecimiento', '/api/auth/reset-password', {}, 10],
    ['verificación de correo', '/api/auth/verify-email', {}, 10]
  ];

  for (const [name, path, json, limit] of limiters) {
    test(`${name}: las primeras ${limit} solicitudes pasan y la siguiente recibe 429`, async () => {
      let first;
      for (let i = 0; i < limit; i += 1) {
        const res = await h.request(server, 'POST', path, { json });
        assert.notEqual(res.status, 429, `la solicitud ${i + 1} no debería estar limitada`);
        first ??= res;
      }
      const blocked = await h.request(server, 'POST', path, { json });
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get('ratelimit') || blocked.headers.get('ratelimit-policy'), 'expone cabeceras RateLimit');
    });
  }

  test('trust proxy = 1: el límite se aplica por IP real indicada por el proxy (X-Forwarded-For)', async () => {
    const xff = (ip) => ({ 'X-Forwarded-For': ip });
    // /verify-device comparte limitador propio (emailVerificationLimiter) distinto del de verify-email.
    let blocked = 0;
    for (let i = 0; i < 11; i += 1) {
      const res = await h.request(server, 'POST', '/api/auth/verify-device', { json: {}, headers: xff('203.0.113.10') });
      if (res.status === 429) blocked += 1;
    }
    assert.ok(blocked >= 1, 'la IP 203.0.113.10 debe agotar su cupo');
    const other = await h.request(server, 'POST', '/api/auth/verify-device', { json: {}, headers: xff('203.0.113.99') });
    assert.notEqual(other.status, 429, 'otra IP cliente no comparte el cupo');
  });
});
