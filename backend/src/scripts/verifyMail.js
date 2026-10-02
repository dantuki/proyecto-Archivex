require('dotenv').config();

const {
  crearTransporter,
  obtenerConfiguracionMail
} = require('../config/mailConfig');

const mostrarErrorSeguro = (error) => {
  const message = String(error?.message || 'Error desconocido.');

  console.error('\n[SMTP] No se pudo verificar la configuración.');
  console.error(`[SMTP] ${message}`);
  console.error(
    '\nRevisa MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_PASSWORD y MAIL_FROM en backend/.env.'
  );
};

const verificarCorreo = async () => {
  try {
    const config = obtenerConfiguracionMail();
    const transporter = crearTransporter();

    console.log(`[SMTP] Probando conexión con ${config.host}:${config.port}...`);
    await transporter.verify();
    console.log('[SMTP] Conexión autenticada correctamente. ArchiveX ya puede enviar correos.');
  } catch (error) {
    mostrarErrorSeguro(error);
    process.exitCode = 1;
  }
};

verificarCorreo();
