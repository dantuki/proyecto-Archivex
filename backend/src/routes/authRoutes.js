const express =
  require('express');

const rateLimit =
  require('express-rate-limit');

const authController =
  require('../controllers/authController.js');

const router =
  express.Router();

// ============================================================
// RATE LIMITING
// ============================================================
//
// LOGIN:
// 10 solicitudes por IP cada 15 minutos.
//
// REGISTRO:
// 5 solicitudes por IP cada hora.
//
// RECUPERACIÓN:
// 5 solicitudes por IP cada 15 minutos.
//
// RESTABLECIMIENTO:
// 10 solicitudes por IP cada 15 minutos.
//
// ============================================================

const loginLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    limit:
      10,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    message: {
      status:
        'error',

      error:
        'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos.',

      message:
        'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos.'
    }
  });

const registerLimiter =
  rateLimit({
    windowMs:
      60 *
      60 *
      1000,

    limit:
      5,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    message: {
      status:
        'error',

      error:
        'Demasiados intentos de registro. Intenta nuevamente más tarde.',

      message:
        'Demasiados intentos de registro. Intenta nuevamente más tarde.'
    }
  });

const passwordResetRequestLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    limit:
      5,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    message: {
      status:
        'error',

      error:
        'Demasiadas solicitudes de recuperación. Intenta nuevamente más tarde.',

      message:
        'Demasiadas solicitudes de recuperación. Intenta nuevamente más tarde.'
    }
  });

const passwordResetLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    limit:
      10,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    message: {
      status:
        'error',

      error:
        'Demasiados intentos de restablecimiento. Intenta nuevamente más tarde.',

      message:
        'Demasiados intentos de restablecimiento. Intenta nuevamente más tarde.'
    }
  });

const emailVerificationLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    limit:
      10,

    standardHeaders:
      'draft-8',

    legacyHeaders:
      false,

    message: {
      status: 'error',
      error: 'Demasiados intentos de verificación. Intenta nuevamente más tarde.'
    }
  });

// ============================================================
// REGISTRO PÚBLICO
// ============================================================

router.post(
  '/register',
  registerLimiter,
  authController.register
);

// ============================================================
// INICIO DE SESIÓN
// ============================================================

router.post(
  '/login',
  loginLimiter,
  authController.login
);

// ============================================================
// SOLICITAR RECUPERACIÓN
// ============================================================
//
// IMPORTANTE:
//
// Esta respuesta será genérica para evitar enumeración de
// cuentas.
//
// No se informará al cliente si el correo existe.
//
// ============================================================

router.post(
  '/forgot-password',
  passwordResetRequestLimiter,
  authController.forgotPassword
);

// ============================================================
// RESTABLECER CONTRASEÑA
// ============================================================

router.post(
  '/reset-password',
  passwordResetLimiter,
  authController.resetPassword
);

router.post(
  '/verify-email',
  emailVerificationLimiter,
  authController.verifyEmail
);

router.post(
  '/resend-verification',
  passwordResetRequestLimiter,
  authController.resendEmailVerification
);

module.exports =
  router;
