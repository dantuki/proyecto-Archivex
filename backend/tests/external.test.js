const { test, describe } = require('node:test');

// Pruebas que dependen de servicios externos y no pueden automatizarse sin falsificarlos.
describe('Dependencias externas (BLOCKED_EXTERNAL)', () => {
  test('reCAPTCHA real en registro e inicio de sesión (site key válida para el dominio)', {
    skip: 'EXTERNAL: requiere un desafío reCAPTCHA resuelto por una persona con una clave registrada para el dominio'
  }, () => {});

  test('Login completo: verificación de dispositivo nuevo y emisión de JWT', {
    skip: 'EXTERNAL: depende de reCAPTCHA y de recibir el correo de confirmación de dispositivo'
  }, () => {});

  test('Verificación de correo tras el registro (token recibido por SMTP)', {
    skip: 'EXTERNAL: requiere un buzón SMTP real de prueba'
  }, () => {});

  test('Entrega real de correos (recuperación, notificaciones, cambio de correo)', {
    skip: 'EXTERNAL: la suite apunta a un SMTP inexistente para no enviar correo real'
  }, () => {});

  test('Interfaz React (navegación, formularios, dashboards por rol)', {
    skip: 'MANUAL: no hay pruebas de UI automatizadas; solo build y lint'
  }, () => {});

  test('Despliegue en Hostinger (proxy, SSL, rutas persistentes de uploads, CORS entre subdominios)', {
    skip: 'EXTERNAL: solo verificable en el entorno real'
  }, () => {});
});
