const nodemailer =
  require('nodemailer');

// ============================================================
// CONFIGURACIÓN DEL SERVICIO DE CORREO
// ============================================================
//
// Las credenciales REALes nunca deben estar aquí.
//
// Se obtienen exclusivamente desde variables de entorno.
//
// Variables esperadas:
//
// MAIL_HOST
// MAIL_PORT
// MAIL_SECURE
// MAIL_USER
// MAIL_PASSWORD
// MAIL_FROM
//
// Ejemplo típico para SMTP:
//
// MAIL_HOST=smtp.gmail.com
// MAIL_PORT=465
// MAIL_SECURE=true
// MAIL_USER=correo@dominio.com
// MAIL_PASSWORD=contraseña_de_aplicación
// MAIL_FROM=ArchiveX <correo@dominio.com>
//
// ============================================================

const obtenerConfiguracionMail =
  () => {
    const host =
      process.env.MAIL_HOST;

    const port =
      Number(
        process.env.MAIL_PORT
      );

    const secureRaw =
      String(
        process.env.MAIL_SECURE ||
          ''
      )
        .trim()
        .toLowerCase();

    const user =
      process.env.MAIL_USER;

    const password =
      process.env.MAIL_PASSWORD;

    const fromRaw =
      process.env.MAIL_FROM ||
      user ||
      '';

    const from =
      typeof fromRaw === 'string' && fromRaw.trim() &&
      !fromRaw.includes('<')
        ? `ArchiveX <${fromRaw.trim()}>`
        : fromRaw;

    if (
      typeof host !==
        'string' ||
      !host.trim()
    ) {
      throw new Error(
        'MAIL_HOST no está configurado correctamente.'
      );
    }

    if (
      !Number.isInteger(
        port
      ) ||
      port <= 0 ||
      port > 65535
    ) {
      throw new Error(
        'MAIL_PORT no está configurado correctamente.'
      );
    }

    const secure =
      secureRaw ===
        'true' ||
      secureRaw ===
        '1' ||
      secureRaw ===
        'yes';

    if (
      typeof user !==
        'string' ||
      !user.trim()
    ) {
      throw new Error(
        'MAIL_USER no está configurado correctamente.'
      );
    }

    if (
      typeof password !==
        'string' ||
      !password.trim()
    ) {
      throw new Error(
        'MAIL_PASSWORD no está configurado correctamente.'
      );
    }

    if (
      typeof from !==
        'string' ||
      !from.trim()
    ) {
      throw new Error(
        'MAIL_FROM no está configurado correctamente.'
      );
    }

    return {
      host:
        host.trim(),

      port,

      secure,

      auth: {
        user:
          user.trim(),

        pass:
          password
      },

      from:
        from.trim()
    };
  };

// ============================================================
// CREAR TRANSPORTER
// ============================================================

const crearTransporter =
  () => {
    const config =
      obtenerConfiguracionMail();

    return nodemailer.createTransport({
      host:
        config.host,

      port:
        config.port,

      secure:
        config.secure,

      auth:
        config.auth
    });
  };

// ============================================================
// EXPORTACIÓN
// ============================================================

module.exports = {
  obtenerConfiguracionMail,
  crearTransporter
};
