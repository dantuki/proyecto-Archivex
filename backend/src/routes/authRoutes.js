const express = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController.js');

const router = express.Router();

/**
 * Rate limiting para autenticación.
 *
 * Objetivo:
 * - Reducir ataques de fuerza bruta sobre login.
 * - Reducir abuso automatizado del registro.
 *
 * IMPORTANTE:
 * Los límites son relativamente estrictos porque estas rutas
 * son sensibles y pueden ser atacadas repetidamente.
 */

/**
 * Límite para inicio de sesión:
 * máximo 10 intentos por IP cada 15 minutos.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    status: 'error',
    message:
      'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos.'
  }
});

/**
 * Límite para registro:
 * máximo 5 intentos por IP cada hora.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    status: 'error',
    message:
      'Demasiados intentos de registro. Intenta nuevamente más tarde.'
  }
});

/**
 * Registro público.
 *
 * El controlador se encarga además de:
 * - validar CAPTCHA
 * - impedir asignación de roles privilegiados
 * - validar los datos
 */
router.post(
  '/register',
  registerLimiter,
  authController.register
);

/**
 * Inicio de sesión.
 *
 * El controlador se encarga además de:
 * - validar CAPTCHA
 * - verificar credenciales
 * - firmar JWT
 */
router.post(
  '/login',
  loginLimiter,
  authController.login
);

module.exports = router;