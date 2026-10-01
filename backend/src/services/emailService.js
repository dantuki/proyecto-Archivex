const {
  crearTransporter,
  obtenerConfiguracionMail
} = require('../config/mailConfig');

// ============================================================
// CONFIGURACIÓN FRONTEND
// ============================================================

const obtenerFrontendOrigin = () => {
  const origin =
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:5173';

  return origin
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
};

// ============================================================
// ESCAPAR HTML
// ============================================================

const escaparHtml = (valor) => {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ============================================================
// SERVICIO DE RECUPERACIÓN DE CONTRASEÑA
// ============================================================

const sendPasswordResetEmail = async ({
  to,
  email,
  name,
  nombre,
  token
}) => {
  const destinatario = to || email;
  const nombreUsuario = name || nombre || 'Usuario de ArchiveX';

  if (!destinatario || !destinatario.trim()) {
    throw new Error('El correo del destinatario es obligatorio.');
  }

  if (!token || !token.trim()) {
    throw new Error('El token de restablecimiento es obligatorio.');
  }

  const transporter = crearTransporter();
  const config = obtenerConfiguracionMail();
  const frontendOrigin = obtenerFrontendOrigin();

  const resetUrl = `${frontendOrigin}/?reset-token=${encodeURIComponent(token.trim())}`;
  const nombreSeguro = escaparHtml(nombreUsuario);

  const textoPlano = `
Hola ${nombreUsuario},

Recibimos una solicitud para restablecer la contraseña de tu cuenta de ArchiveX.

Para crear una nueva contraseña, abre el siguiente enlace:

${resetUrl}

Este enlace es temporal y dejará de funcionar después del tiempo de expiración establecido.

Si no solicitaste este cambio, puedes ignorar este mensaje.

Por seguridad, nunca compartas este enlace con otras personas.

Equipo de ArchiveX
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recuperación de contraseña - ArchiveX</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;padding:10px 18px;border-radius:12px;background:#0f172a;color:#ffffff;font-size:22px;font-weight:700;">
          Archive<span style="color:#10b981;">X</span>
        </div>
      </div>
      <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px;">
        Recuperación de contraseña
      </h1>
      <p style="font-size:15px;line-height:1.6;color:#475569;">
        Hola <strong>${nombreSeguro}</strong>,
      </p>
      <p style="font-size:15px;line-height:1.6;color:#475569;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta de ArchiveX.
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a
          href="${resetUrl}"
          style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:700;"
        >
          Restablecer contraseña
        </a>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#64748b;">
        Este enlace es temporal y dejará de funcionar después del tiempo de expiración establecido.
      </p>
      <p style="font-size:13px;line-height:1.6;color:#64748b;">
        Si tú no realizaste esta solicitud, puedes ignorar este mensaje.
      </p>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <p style="font-size:12px;line-height:1.5;color:#94a3b8;margin:0;">
          Por seguridad, nunca compartas este enlace de recuperación.
        </p>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px;">
      Equipo de ArchiveX
    </p>
  </div>
</body>
</html>
`.trim();

  return await transporter.sendMail({
    from: config.from,
    to: destinatario.trim(),
    subject: 'ArchiveX - Recuperación de contraseña',
    text: textoPlano,
    html
  });
};

const enviarCorreoRecuperacion = sendPasswordResetEmail;

// ============================================================
// EXPORTACIÓN
// ============================================================

module.exports = {
  sendPasswordResetEmail,
  enviarCorreoRecuperacion
};
