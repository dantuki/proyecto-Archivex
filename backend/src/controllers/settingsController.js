const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');

const obtenerUsuarioId = (req) => Number(req.user?.id || 0);
const temasValidos = new Set(['light', 'dark', 'system']);

const obtenerPreferencias = async (req, res) => {
  try {
    const usuarioId = obtenerUsuarioId(req);
    const [rows] = await db.query(
      `SELECT theme, email_notifications, deadline_notifications
       FROM user_preferences WHERE usuario_id = ? LIMIT 1`,
      [usuarioId]
    );

    return res.json(rows[0] || {
      theme: 'system',
      email_notifications: true,
      deadline_notifications: true
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
    const emailNotifications = Boolean(req.body?.email_notifications);
    const deadlineNotifications = Boolean(req.body?.deadline_notifications);

    if (!temasValidos.has(theme)) {
      return res.status(400).json({ error: 'El tema seleccionado no es válido.' });
    }

    await db.query(
      `INSERT INTO user_preferences
        (usuario_id, theme, email_notifications, deadline_notifications)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        theme = VALUES(theme),
        email_notifications = VALUES(email_notifications),
        deadline_notifications = VALUES(deadline_notifications)`,
      [usuarioId, theme, emailNotifications, deadlineNotifications]
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
      `SELECT id, ip_address, user_agent, last_seen_at, created_at, expires_at
       FROM login_sessions
       WHERE usuario_id = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY last_seen_at DESC`,
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

    const [rows] = await db.query('SELECT password, rol FROM usuarios WHERE id = ? LIMIT 1', [usuarioId]);
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      return res.status(401).json({ error: 'La contraseña no es correcta.' });
    }
    if (String(usuario.rol).toLowerCase() === 'admin') {
      return res.status(403).json({ error: 'La cuenta administrativa principal no puede eliminarse desde esta opción.' });
    }

    await db.query(
      `UPDATE usuarios SET account_status = 'pending_deletion',
       deletion_requested_at = CURRENT_TIMESTAMP,
       deletion_scheduled_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
       WHERE id = ?`,
      [usuarioId]
    );
    await db.query('UPDATE login_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE usuario_id = ?', [usuarioId]);
    return res.json({ message: 'La cuenta se desactivó y quedará programada para eliminación en 30 días.' });
  } catch (error) {
    console.error('Error solicitando eliminación:', error.code || error.message);
    return res.status(500).json({ error: 'No fue posible solicitar la eliminación de la cuenta.' });
  }
};

const crearNotificacion = async ({ usuarioId, type = 'general', title, body, link = null }) => {
  if (!usuarioId || !title || !body) return;
  await db.query(
    'INSERT INTO notifications (usuario_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)',
    [usuarioId, type, title, body, link]
  );
};

module.exports = {
  obtenerPreferencias,
  actualizarPreferencias,
  listarNotificaciones,
  marcarNotificacionLeida,
  listarSesiones,
  revocarOtrasSesiones,
  cambiarContrasena,
  solicitarEliminacion,
  crearNotificacion
};
