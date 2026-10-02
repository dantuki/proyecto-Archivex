const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const { ADMIN_EMAIL } = require('../config/securityConfig');
const {
  sendEmailChange,
  sendAccountDeletionConfirmation,
  sendNotificationEmail
} = require('../services/emailService');

const obtenerUsuarioId = (req) => Number(req.user?.id || 0);
const temasValidos = new Set(['light', 'dark', 'system']);
const escalasValidas = new Set(['compact', 'normal']);

const normalizarEmail = (email) => (
  typeof email === 'string' ? email.trim().toLowerCase() : ''
);

const hashToken = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const esAdmin = (req) => {
  const role = String(req.user?.rol || '').trim().toLowerCase();
  return (role === 'admin' || role === 'administrador') &&
    normalizarEmail(req.user?.email) === ADMIN_EMAIL;
};

const obtenerPreferencias = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const [rows] = await db.query(
            `SELECT theme, text_scale, email_notifications, deadline_notifications,
              notify_comments, notify_assignments, notify_deadlines, notify_convocations
       FROM user_preferences WHERE usuario_id = ? LIMIT 1`,
      [usuarioId]
    );

    return res.json(rows[0] || {
      theme: 'system',
      text_scale: 'normal',
      email_notifications: true,
      deadline_notifications: true,
      notify_comments: true,
      notify_assignments: true,
      notify_deadlines: true,
      notify_convocations: true
    });
  } catch (error) {
    console.error('Error consultando preferencias:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible cargar las preferencias.' });
  }
};

const actualizarPreferencias = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const theme = String(req.body?.theme || '').trim();
    const textScale = String(req.body?.text_scale || 'normal').trim();
    const emailNotifications = Boolean(req.body?.email_notifications);
    const deadlineNotifications = Boolean(req.body?.deadline_notifications);

    if (!temasValidos.has(theme) || !escalasValidas.has(textScale)) {
      return res.status(400).json({ error: 'Las preferencias seleccionadas no son válidas.' });
    }

    await db.query(
      `INSERT INTO user_preferences
        (usuario_id, theme, text_scale, email_notifications, deadline_notifications,
         notify_comments, notify_assignments, notify_deadlines, notify_convocations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        theme = VALUES(theme),
        text_scale = VALUES(text_scale),
        email_notifications = VALUES(email_notifications),
        deadline_notifications = VALUES(deadline_notifications),
        notify_comments = VALUES(notify_comments),
        notify_assignments = VALUES(notify_assignments),
        notify_deadlines = VALUES(notify_deadlines),
        notify_convocations = VALUES(notify_convocations)`,
      [
        usuarioId,
        theme,
        textScale,
        emailNotifications,
        deadlineNotifications,
        Boolean(req.body?.notify_comments),
        Boolean(req.body?.notify_assignments),
        Boolean(req.body?.notify_deadlines),
        Boolean(req.body?.notify_convocations)
      ]
    );

    return res.json({ message: 'Preferencias guardadas correctamente.' });
  } catch (error) {
    console.error('Error guardando preferencias:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible guardar las preferencias.' });
  }
};

const listarNotificaciones = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const [convocatorias] = await db.query(
      `SELECT id, titulo, DATEDIFF(fecha_cierre, CURRENT_DATE) AS dias
       FROM convocatorias
       WHERE fecha_cierre > CURRENT_TIMESTAMP
         AND fecha_cierre <= DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 DAY)`
    );
    const [usuarios] = await db.query(
      `SELECT id FROM usuarios WHERE account_status = 'active'`
    );

    await Promise.all(convocatorias.flatMap((convocatoria) =>
      usuarios.map((usuario) => crearNotificacion({
          usuarioId: usuario.id,
          type: 'deadline',
          title: 'Cierre próximo',
          body: `La convocatoria "${convocatoria.titulo}" cierra en ${convocatoria.dias} día(s).`,
          link: '/convocatorias_abiertas',
          eventKey: `deadline:${convocatoria.id}`
        }))
    ));

    const [asignaciones] = await db.query(
      `SELECT ae.id, ae.evaluador_id, s.titulo_propuesta, c.fecha_cierre
       FROM asignacion_evaluaciones ae
       INNER JOIN solicitudes s ON s.id = ae.solicitud_id
       INNER JOIN convocatorias c ON c.id = s.convocatoria_id
       WHERE ae.estado_evaluacion IN ('Asignado', 'En Progreso')`
    );

    await Promise.all(asignaciones.map((asignacion) => crearNotificacion({
        usuarioId: asignacion.evaluador_id,
        type: 'assignment',
        title: 'Evaluación pendiente',
        body: `Tienes pendiente la evaluación de "${asignacion.titulo_propuesta}". Fecha límite: ${new Date(asignacion.fecha_cierre).toLocaleDateString('es-ES')}.`,
        link: '/evaluar_propuestas',
        eventKey: `assignment:${asignacion.id}`
      })));

    const [rows] = await db.query(
      `SELECT id, type, title, body, link, read_at, created_at
       FROM notifications WHERE usuario_id = ?
       ORDER BY created_at DESC LIMIT 30`,
      [usuarioId]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error consultando notificaciones:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible cargar las notificaciones.' });
  }
};

const obtenerPerfil = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nombre_completo, email, rol, telefono, direccion,
              nivel_educativo, carrera_titulo, foto_url, certificado_url,
              correo_verificado, correo_verificado_at
       FROM usuarios WHERE id = ? LIMIT 1`,
      [obtenerUsuarioId(req)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No se encontró el perfil.' });
    return res.json(rows[0]);
  } catch (error) {
    console.error('Error consultando perfil:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible cargar el perfil.' });
  }
};

const actualizarPerfil = async (req, res) => {
  const fields = {
    telefono: 20,
    direccion: 255,
    nivel_educativo: 100,
    carrera_titulo: 150
  };
  const fieldsToUpdate = Object.entries(fields)
    .filter(([field]) => Object.hasOwn(req.body || {}, field));
  if (!fieldsToUpdate.length) {
    return res.status(400).json({ error: 'No se recibieron campos de perfil para actualizar.' });
  }
  const setClause = fieldsToUpdate.map(([field]) => `${field} = ?`).join(', ');
  const values = fieldsToUpdate.map(([field, maxLength]) => {
    const value = req.body[field];
    return typeof value === 'string' ? value.trim().slice(0, maxLength) || null : null;
  });

  try {
    await db.query(
      `UPDATE usuarios SET ${setClause} WHERE id = ?`,
      [...values, obtenerUsuarioId(req)]
    );
    return res.json({ message: 'Perfil actualizado correctamente.' });
  } catch (error) {
    console.error('Error actualizando perfil:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible actualizar el perfil.' });
  }
};

const solicitarCambioEmail = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const nuevoEmail = normalizarEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoEmail) || nuevoEmail.length > 100) {
      return res.status(400).json({ error: 'El nuevo correo no es válido.' });
    }
    if (nuevoEmail === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Ese correo está reservado para la administración.' });
    }

    const [users] = await db.query(
      'SELECT email, nombre_completo, password FROM usuarios WHERE id = ? LIMIT 1',
      [usuarioId]
    );
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }
    if (normalizarEmail(user.email) === nuevoEmail) {
      return res.status(400).json({ error: 'Ese correo ya está asociado a tu cuenta.' });
    }
    if (esAdmin(req)) {
      return res.status(403).json({ error: 'El correo administrativo reservado no puede cambiarse desde esta opción.' });
    }

    const [existing] = await db.query(
      'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
      [nuevoEmail]
    );
    if (existing.length) return res.status(409).json({ error: 'El correo ya está en uso.' });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    await db.query(
      `UPDATE email_change_tokens SET used_at = CURRENT_TIMESTAMP
       WHERE usuario_id = ? AND used_at IS NULL`,
      [usuarioId]
    );
    await db.query(
      `INSERT INTO email_change_tokens (usuario_id, new_email, token_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE))`,
      [usuarioId, nuevoEmail, tokenHash]
    );

    try {
      await sendEmailChange({ to: nuevoEmail, name: user.nombre_completo, token });
    } catch (error) {
      await db.query(
        `UPDATE email_change_tokens SET used_at = CURRENT_TIMESTAMP
         WHERE token_hash = ? AND used_at IS NULL`,
        [tokenHash]
      );
      console.error('No se pudo enviar verificación de cambio de correo:', error.code || 'fallo de entrega');
      return res.status(503).json({ error: 'No se pudo enviar el correo de confirmación. Intenta más tarde.' });
    }
    return res.json({ message: 'Enviamos un enlace de confirmación al nuevo correo.' });
  } catch (error) {
    console.error('Error solicitando cambio de correo:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible solicitar el cambio de correo.' });
  }
};

const confirmarCambioEmail = async (req, res) => {
  let connection;
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'El token de confirmación es obligatorio.' });
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, usuario_id, new_email, expires_at, used_at
       FROM email_change_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE`,
      [hashToken(token)]
    );
    const pending = rows[0];
    if (!pending || pending.used_at || new Date(pending.expires_at) <= new Date()) {
      await connection.rollback();
      return res.status(400).json({ error: 'El enlace no es válido o ha expirado.' });
    }
    const [existing] = await connection.query(
      'SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1',
      [pending.new_email, pending.usuario_id]
    );
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'El correo ya está en uso.' });
    }
    await connection.query(
      `UPDATE usuarios SET email = ?, correo_verificado = TRUE,
       correo_verificado_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [pending.new_email, pending.usuario_id]
    );
    await connection.query(
      'UPDATE login SET email = ? WHERE usuario_id = ?',
      [pending.new_email, pending.usuario_id]
    );
    await connection.query(
      'UPDATE login_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE usuario_id = ? AND revoked_at IS NULL',
      [pending.usuario_id]
    );
    await connection.query(
      `UPDATE email_change_tokens SET used_at = CURRENT_TIMESTAMP
       WHERE usuario_id = ? AND used_at IS NULL`,
      [pending.usuario_id]
    );
    await connection.commit();
    return res.json({ message: 'Correo actualizado y verificado correctamente.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error confirmando cambio de correo:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible confirmar el cambio de correo.' });
  } finally {
    if (connection) connection.release();
  }
};

const exportarDatos = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const [profile] = await db.query(
      `SELECT id, nombre_completo, email, rol, telefono, direccion,
              nivel_educativo, carrera_titulo, correo_verificado, created_at
       FROM usuarios WHERE id = ? LIMIT 1`,
      [usuarioId]
    );
    const [applications] = await db.query(
      `SELECT id, num_solicitud, titulo_propuesta, estado, motivo_decision,
              observaciones, created_at, updated_at
       FROM solicitudes WHERE usuario_id = ? ORDER BY created_at DESC`,
      [usuarioId]
    );
    const [history] = await db.query(
      `SELECT t.solicitud_id, t.estado_anterior, t.estado_nuevo,
              t.motivo_cambio, t.fecha_cambio, u.nombre_completo AS responsable
       FROM trazabilidad_solicitudes t
       INNER JOIN solicitudes s ON s.id = t.solicitud_id
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE s.usuario_id = ? ORDER BY t.fecha_cambio DESC`,
      [usuarioId]
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="archivex-datos-personales.json"');
    return res.json({ exportado_at: new Date().toISOString(), perfil: profile[0], solicitudes: applications, trazabilidad: history });
  } catch (error) {
    console.error('Error exportando datos personales:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible exportar tus datos.' });
  }
};

const listarBajasPendientes = async (req, res) => {
  if (!esAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
  try {
    const [rows] = await db.query(
      `SELECT id, nombre_completo, email, deletion_requested_at, deletion_scheduled_at
       FROM usuarios WHERE account_status = 'pending_deletion'
       ORDER BY deletion_scheduled_at ASC`
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error consultando bajas pendientes:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible consultar las solicitudes.' });
  }
};

const obtenerActividadAdmin = async (req, res) => {
  if (!esAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.solicitud_id, t.estado_anterior, t.estado_nuevo,
              t.motivo_cambio, t.fecha_cambio, s.titulo_propuesta,
              u.nombre_completo AS responsable
       FROM trazabilidad_solicitudes t
       LEFT JOIN solicitudes s ON s.id = t.solicitud_id
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       ORDER BY t.fecha_cambio DESC, t.id DESC LIMIT 30`
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error consultando actividad administrativa:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible consultar la actividad reciente.' });
  }
};

const cancelarBajaPendiente = async (req, res) => {
  if (!esAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'El usuario no es válido.' });
  try {
    const [result] = await db.query(
      `UPDATE usuarios SET account_status = 'active', deletion_requested_at = NULL,
       deletion_scheduled_at = NULL WHERE id = ? AND account_status = 'pending_deletion'`,
      [id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No hay una baja pendiente para ese usuario.' });
    return res.json({ message: 'La baja pendiente fue cancelada.' });
  } catch (error) {
    console.error('Error cancelando baja:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible cancelar la baja.' });
  }
};

const marcarNotificacionLeida = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'La notificación no es válida.' });
    }

    await db.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );
    return res.json({ message: 'Notificación actualizada.' });
  } catch (error) {
    console.error('Error actualizando notificación:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible actualizar la notificación.' });
  }
};

const listarSesiones = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const sessionId = String(req.user?.sid || '');
    const [rows] = await db.query(
      `SELECT id, ip_address, user_agent, last_seen_at, created_at, expires_at, revoked_at
       FROM login_sessions
       WHERE usuario_id = ?
       ORDER BY last_seen_at DESC LIMIT 30`,
      [usuarioId]
    );

    return res.json(rows.map((session) => ({
      ...session,
      current: session.id === sessionId
    })));
  } catch (error) {
    console.error('Error consultando sesiones:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible cargar las sesiones.' });
  }
};

const revocarTodasSesiones = async (req, res) => {
  try {
    await db.query(
      'UPDATE login_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE usuario_id = ? AND revoked_at IS NULL',
      [obtenerUsuarioId(req)]
    );
    return res.json({ message: 'Todas las sesiones fueron cerradas.' });
  } catch (error) {
    console.error('Error cerrando todas las sesiones:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible cerrar las sesiones.' });
  }
};

const revocarOtrasSesiones = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const sessionId = String(req.user?.sid || '');
    await db.query(
      `UPDATE login_sessions SET revoked_at = CURRENT_TIMESTAMP
       WHERE usuario_id = ? AND id <> ? AND revoked_at IS NULL`,
      [usuarioId, sessionId]
    );
    return res.json({ message: 'Las demás sesiones fueron cerradas.' });
  } catch (error) {
    console.error('Error cerrando sesiones:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible cerrar las sesiones.' });
  }
};

const cambiarContrasena = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const actual = String(req.body?.currentPassword || '');
    const nueva = String(req.body?.newPassword || '');

    if (!actual || nueva.length < 8 || nueva.length > 128) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener entre 8 y 128 caracteres.' });
    }

    const [rows] = await db.query(
      'SELECT email, password FROM usuarios WHERE id = ? LIMIT 1',
      [usuarioId]
    );
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(actual, usuario.password))) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const passwordHash = await bcrypt.hash(nueva, 12);
    await db.query('UPDATE usuarios SET password = ? WHERE id = ?', [passwordHash, usuarioId]);
    await db.query('UPDATE login SET password = ? WHERE usuario_id = ?', [passwordHash, usuarioId]);
    await db.query(
      `UPDATE login_sessions SET revoked_at = CURRENT_TIMESTAMP
       WHERE usuario_id = ? AND id <> ? AND revoked_at IS NULL`,
      [usuarioId, String(req.user?.sid || '')]
    );
    return res.json({ message: 'Contraseña actualizada. Las demás sesiones se cerraron.' });
  } catch (error) {
    console.error('Error cambiando contraseña:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible cambiar la contraseña.' });
  }
};

const solicitarEliminacion = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const password = String(req.body?.password || '');
    const confirmacion = String(req.body?.confirmation || '').trim().toUpperCase();
    if (confirmacion !== 'ELIMINAR' || !password) {
      return res.status(400).json({ error: 'Escribe ELIMINAR y confirma tu contraseña para continuar.' });
    }

    const [rows] = await db.query('SELECT password, rol, email, nombre_completo FROM usuarios WHERE id = ? LIMIT 1', [usuarioId]);
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      return res.status(401).json({ error: 'La contraseña no es correcta.' });
    }
    if (String(usuario.rol).toLowerCase() === 'admin') {
      return res.status(403).json({ error: 'La cuenta administrativa principal no puede eliminarse desde esta opción.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    await db.query(
      `UPDATE account_deletion_tokens SET used_at = CURRENT_TIMESTAMP
       WHERE usuario_id = ? AND used_at IS NULL`,
      [usuarioId]
    );
    await db.query(
      `INSERT INTO account_deletion_tokens (usuario_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE))`,
      [usuarioId, tokenHash]
    );
    try {
      await sendAccountDeletionConfirmation({ to: usuario.email, name: usuario.nombre_completo, token });
    } catch (emailError) {
      await db.query(
        `UPDATE account_deletion_tokens SET used_at = CURRENT_TIMESTAMP
         WHERE token_hash = ? AND used_at IS NULL`,
        [tokenHash]
      );
      console.error('No se pudo enviar confirmación de eliminación:', emailError.code || 'fallo de entrega');
      return res.status(503).json({ error: 'No se pudo enviar el correo de confirmación. Intenta más tarde.' });
    }
    return res.json({ message: 'Te enviamos un correo para confirmar la solicitud de eliminación.' });
  } catch (error) {
    console.error('Error solicitando eliminación:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible solicitar la eliminación de la cuenta.' });
  }
};

const confirmarEliminacion = async (req, res) => {
  let connection;
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'El token de confirmación es obligatorio.' });
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, usuario_id, expires_at, used_at FROM account_deletion_tokens
       WHERE token_hash = ? LIMIT 1 FOR UPDATE`,
      [hashToken(token)]
    );
    const pending = rows[0];
    if (!pending || pending.used_at || new Date(pending.expires_at) <= new Date()) {
      await connection.rollback();
      return res.status(400).json({ error: 'El enlace no es válido o ha expirado.' });
    }
    await connection.query(
      `UPDATE usuarios SET account_status = 'pending_deletion',
       deletion_requested_at = CURRENT_TIMESTAMP,
       deletion_scheduled_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
       WHERE id = ?`,
      [pending.usuario_id]
    );
    await connection.query(
      'UPDATE login_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE usuario_id = ?',
      [pending.usuario_id]
    );
    await connection.query(
      `UPDATE account_deletion_tokens SET used_at = CURRENT_TIMESTAMP
       WHERE usuario_id = ? AND used_at IS NULL`,
      [pending.usuario_id]
    );
    await connection.commit();
    return res.json({ message: 'Cuenta desactivada y programada para anonimización en 30 días. Tus expedientes se conservarán.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error confirmando eliminación:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible confirmar la solicitud.' });
  } finally {
    if (connection) connection.release();
  }
};

const anonimizarCuentaVencidaPorId = async (id) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id FROM usuarios WHERE id = ? AND account_status = 'pending_deletion'
       AND deletion_scheduled_at <= CURRENT_TIMESTAMP FOR UPDATE`,
      [id]
    );
    if (!rows.length) {
      await connection.rollback();
      return false;
    }
    const email = `eliminado+${id}@invalid.archivex`;
    const cedula = `AX${id}`;
    const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    await connection.query(
      `UPDATE usuarios SET nombre_completo = 'Cuenta eliminada', email = ?, cedula = ?,
       telefono = NULL, direccion = NULL, foto_url = NULL, nivel_educativo = NULL,
       carrera_titulo = NULL, certificado_url = NULL, password = ?, rol = 'Docente',
       correo_verificado = FALSE, correo_verificado_at = NULL, account_status = 'disabled'
       WHERE id = ?`,
      [email, cedula, password, id]
    );
    await connection.query(
      'UPDATE login SET email = ?, password = ? WHERE usuario_id = ?',
      [email, password, id]
    );
    await connection.query('DELETE FROM login_sessions WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM trusted_devices WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM login_device_tokens WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM email_change_tokens WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM account_deletion_tokens WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM email_verification_tokens WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM password_reset_tokens WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM notifications WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM user_preferences WHERE usuario_id = ?', [id]);
    await connection.commit();
    return true;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

const anonimizarCuentaVencida = async (req, res) => {
  if (!esAdmin(req)) return res.status(403).json({ error: 'Acceso denegado.' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'El usuario no es válido.' });
  try {
    const anonimizada = await anonimizarCuentaVencidaPorId(id);
    if (!anonimizada) return res.status(409).json({ error: 'La cuenta no está vencida o no tiene una baja pendiente.' });
    return res.json({ message: 'La cuenta fue anonimizada. Solicitudes y trazabilidad institucional se conservaron.' });
  } catch (error) {
    console.error('Error anonimizando cuenta vencida:', error.code || 'error interno');
    return res.status(500).json({ error: 'No fue posible anonimizar la cuenta.' });
  }
};

const procesarBajasVencidas = async () => {
  const [rows] = await db.query(
    `SELECT id FROM usuarios WHERE account_status = 'pending_deletion'
     AND deletion_scheduled_at <= CURRENT_TIMESTAMP`
  );
  const results = await Promise.all(rows.map(async ({ id }) => {
    try {
      return await anonimizarCuentaVencidaPorId(id);
    } catch (error) {
      console.error('No se pudo anonimizar cuenta vencida:', error.code || 'error interno');
      return false;
    }
  }));
  return results.filter(Boolean).length;
};

const crearNotificacion = async ({ usuarioId, type = 'general', title, body, link = null, eventKey = null }) => {
  if (!usuarioId || !title || !body) return;
  const [rows] = await db.query(
    `SELECT u.email, u.nombre_completo, COALESCE(p.email_notifications, TRUE) AS email_notifications,
       COALESCE(p.notify_comments, TRUE) AS notify_comments,
       COALESCE(p.notify_assignments, TRUE) AS notify_assignments,
        COALESCE(p.notify_deadlines, TRUE) AS notify_deadlines,
        COALESCE(p.notify_convocations, TRUE) AS notify_convocations
     FROM usuarios u LEFT JOIN user_preferences p ON p.usuario_id = u.id
     WHERE u.id = ? AND u.account_status = 'active' LIMIT 1`,
    [usuarioId]
  );
  const user = rows[0];
  if (!user) return;
  const preferencesByType = {
    assignment: user.notify_assignments,
    deadline: user.notify_deadlines,
    convocation: user.notify_convocations,
    comment: user.notify_comments,
    solicitud: user.notify_comments,
    general: user.notify_comments
  };
  const preference = preferencesByType[type] ?? user.notify_comments;
  if (!preference) return;
  const [result] = await db.query(
    `INSERT IGNORE INTO notifications (usuario_id, type, title, body, link, event_key)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [usuarioId, type, title, body, link, eventKey ? `${usuarioId}:${eventKey}` : null]
  );
  if (result.affectedRows && user.email_notifications) {
    const categoryEnabled = preferencesByType[type] ?? user.notify_comments;
    if (categoryEnabled) {
      try {
        await sendNotificationEmail({ to: user.email, name: user.nombre_completo, title, body });
      } catch (error) {
        console.error('No se pudo enviar aviso por correo:', error.code || 'fallo de entrega');
      }
    }
  }
};

module.exports = {
  obtenerPerfil,
  actualizarPerfil,
  solicitarCambioEmail,
  confirmarCambioEmail,
  exportarDatos,
  listarBajasPendientes,
  obtenerActividadAdmin,
  cancelarBajaPendiente,
  anonimizarCuentaVencida,
  procesarBajasVencidas,
  obtenerPreferencias,
  actualizarPreferencias,
  listarNotificaciones,
  marcarNotificacionLeida,
  listarSesiones,
  revocarOtrasSesiones,
  revocarTodasSesiones,
  cambiarContrasena,
  solicitarEliminacion,
  confirmarEliminacion,
  crearNotificacion
};
