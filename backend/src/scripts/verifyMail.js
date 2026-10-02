require('dotenv').config();

const {
  crearTransporter,
  obtenerConfiguracionMail
} = require('../config/mailConfig');

const mostrarErrorSeguro = (error) => {
  const redact = (value) => {
    let output = String(value || '');
    [
      process.env.MAIL_PASSWORD,
      process.env.JWT_SECRET,
      process.env.RECAPTCHA_SECRET_KEY,
      process.env.DB_PASSWORD
    ].forEach((secret) => {
      if (typeof secret === 'string' && secret.length > 0) {
        output = output.split(secret).join('[REDACTADO]');
      }
    });
    return output;
  };

  console.error('[SMTP] SMTP_FAIL', {
    code: redact(error?.code),
    command: redact(error?.command),
    responseCode: error?.responseCode,
    response: redact(error?.response),
    message: redact(error?.message || 'Error desconocido.')
  });
};

const verificarCorreo = async () => {
  let transporter;
  try {
    const config = obtenerConfiguracionMail();
    transporter = crearTransporter();

    console.log(`[SMTP] Verificando transporter ${config.host}:${config.port}...`);
    await transporter.verify();
    console.log('[SMTP] Autenticación y conexión listas.');

    const result = await transporter.sendMail({
      from: config.from,
      to: config.auth.user,
      subject: 'ArchiveX - Prueba de correo SMTP',
      text: 'Prueba de envío SMTP de ArchiveX completada.'
    });

    const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
    const rejected = Array.isArray(result.rejected) ? result.rejected.length : 0;
    console.log('[SMTP] SMTP_OK', {
      messageIdPresent: Boolean(result.messageId),
      accepted,
      rejected
    });

    if (accepted === 0 || rejected > 0) process.exitCode = 1;
  } catch (error) {
    mostrarErrorSeguro(error);
    process.exitCode = 1;
  } finally {
    transporter?.close();
  }
};

verificarCorreo();
