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

const redactarSecretos = (valor) => {
  let texto = String(valor || '');

  [
    process.env.MAIL_PASSWORD,
    process.env.JWT_SECRET,
    process.env.RECAPTCHA_SECRET_KEY,
    process.env.DB_PASSWORD
  ].forEach((secreto) => {
    if (typeof secreto === 'string' && secreto.length > 0) {
      texto = texto.split(secreto).join('[REDACTADO]');
    }
  });

  return texto;
};

// ============================================================
// PLANTILLA VISUAL DE ARCHIVEX
// ============================================================
//
// Se usan estilos inline para que Gmail, Outlook y correos
// institucionales conserven el diseño sin depender de CSS externo.
// ============================================================

const crearPlantillaCorreo = ({
  titulo,
  saludo,
  contenido,
  accionTexto,
  accionUrl,
  aviso
}) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo} · ArchiveX</title>
</head>
<body style="margin:0;padding:0;background:#f4f8fc;font-family:Arial,Helvetica,sans-serif;color:#14213d;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f8fc;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dce7f3;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#0b7de3 0%,#00b894 100%);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:42px;height:42px;border-radius:12px;background:#ffffff;color:#087fe0;text-align:center;font-size:24px;font-weight:800;line-height:42px;">A</td>
                  <td style="padding-left:12px;color:#ffffff;">
                    <div style="font-size:20px;font-weight:800;letter-spacing:-0.4px;">ARCHIVE<span style="color:#d5fff5;">X</span></div>
                    <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;opacity:0.9;margin-top:3px;">GESTIÓN DE ARCHIVOS</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px 18px;">
              <div style="display:inline-block;padding:6px 10px;background:#e8f8f3;border-radius:999px;color:#008a70;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Seguridad de tu cuenta</div>
              <h1 style="margin:18px 0 12px;font-size:26px;line-height:1.25;color:#14213d;">${titulo}</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#4d6480;">${saludo}</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#4d6480;">${contenido}</p>
              <div style="padding:28px 0 22px;text-align:center;">
                <a href="${accionUrl}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#087fe0;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 5px 12px rgba(8,127,224,0.20);">${accionTexto}</a>
              </div>
              <div style="padding:15px 16px;background:#f3f8fc;border-left:4px solid #00b894;border-radius:8px;font-size:12px;line-height:1.55;color:#5d7188;">${aviso}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px;text-align:center;color:#8394a8;font-size:11px;line-height:1.55;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${accionUrl}" style="color:#087fe0;word-break:break-all;">${accionUrl}</a>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:#8fa0b4;font-size:11px;">© ${new Date().getFullYear()} ArchiveX · Gestión de archivos</p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

const enviarCorreo = async ({ transporter, mail, destinatario }) => {
  const enDesarrollo = process.env.NODE_ENV === 'development';

  if (enDesarrollo) {
    console.info('[SMTP] Intento de envío', { destinatario });
  }

  try {
    const resultado = await transporter.sendMail(mail);

    if (enDesarrollo) {
      console.info('[SMTP] Envío completado', {
        destinatario,
        messageId: resultado.messageId,
        accepted: resultado.accepted,
        rejected: resultado.rejected
      });
    }

    return resultado;
  } catch (error) {
    if (enDesarrollo) {
      console.error('[SMTP] Falló el envío', {
        destinatario,
        code: redactarSecretos(error.code),
        command: redactarSecretos(error.command),
        responseCode: error.responseCode,
        response: redactarSecretos(error.response),
        message: redactarSecretos(error.message)
      });
    }

    throw error;
  }
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

  const html = crearPlantillaCorreo({
    titulo: 'Recupera tu contraseña',
    saludo: `Hola <strong>${nombreSeguro}</strong>,`,
    contenido: 'Recibimos una solicitud para crear una nueva contraseña para tu cuenta de ArchiveX.',
    accionTexto: 'Restablecer contraseña',
    accionUrl: resetUrl,
    aviso: 'Este enlace es temporal y solo puede utilizarse una vez. Si no solicitaste este cambio, puedes ignorar este correo.'
  });

  return enviarCorreo({
    transporter,
    destinatario: destinatario.trim(),
    mail: {
      from: config.from,
      to: destinatario.trim(),
      subject: 'ArchiveX - Recuperación de contraseña',
      text: textoPlano,
      html
    }
  });
};

const enviarCorreoRecuperacion = sendPasswordResetEmail;

const sendEmailVerification = async ({ to, name, token }) => {
  if (typeof to !== 'string' || !to.trim()) {
    throw new Error('El correo del destinatario es obligatorio.');
  }

  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('El token de verificación es obligatorio.');
  }

  const transporter = crearTransporter();
  const config = obtenerConfiguracionMail();
  const frontendOrigin = obtenerFrontendOrigin();
  const verificationUrl = `${frontendOrigin}/?verify-token=${encodeURIComponent(token.trim())}`;
  const nombreSeguro = escaparHtml(name || 'Usuario de ArchiveX');

  return enviarCorreo({
    transporter,
    destinatario: to.trim(),
    mail: {
      from: config.from,
      to: to.trim(),
      subject: 'ArchiveX - Verifica tu correo electrónico',
      text: `Hola ${name || 'usuario'},\n\nConfirma tu correo electrónico para activar tu cuenta de ArchiveX:\n\n${verificationUrl}\n\nEste enlace expira en 24 horas. Si no creaste esta cuenta, puedes ignorar este mensaje.`,
      html: crearPlantillaCorreo({
        titulo: 'Verifica tu correo',
        saludo: `Hola <strong>${nombreSeguro}</strong>,`,
        contenido: 'Confirma que esta dirección te pertenece para activar tu cuenta de ArchiveX.',
        accionTexto: 'Verificar mi correo',
        accionUrl: verificationUrl,
        aviso: 'Este enlace expira en 24 horas. Si no creaste esta cuenta, puedes ignorar este correo sin realizar ninguna acción.'
      })
    }
  });
};

const enviarCorreoVerificacion = sendEmailVerification;

// ============================================================
// EXPORTACIÓN
// ============================================================

module.exports = {
  sendPasswordResetEmail,
  enviarCorreoRecuperacion,
  sendEmailVerification,
  enviarCorreoVerificacion
};
