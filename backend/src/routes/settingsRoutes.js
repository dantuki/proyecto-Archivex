const express = require('express');
const rateLimit = require('express-rate-limit');
const verificarToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const ctrl = require('../controllers/settingsController');

const router = express.Router();

const securityEmailLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { error: 'Demasiadas solicitudes de seguridad. Intenta nuevamente más tarde.' }
});

router.post('/email/confirm', ctrl.confirmarCambioEmail);
router.post('/account/deletion-confirm', ctrl.confirmarEliminacion);

router.use(verificarToken);

router.get('/profile', ctrl.obtenerPerfil);
router.put('/profile', ctrl.actualizarPerfil);
router.post('/email/change', securityEmailLimiter, ctrl.solicitarCambioEmail);
router.get('/preferences', ctrl.obtenerPreferencias);
router.put('/preferences', ctrl.actualizarPreferencias);
router.get('/notifications', ctrl.listarNotificaciones);
router.patch('/notifications/:id/read', ctrl.marcarNotificacionLeida);
router.get('/sessions', ctrl.listarSesiones);
router.post('/sessions/revoke-others', ctrl.revocarOtrasSesiones);
router.post('/sessions/revoke-all', ctrl.revocarTodasSesiones);
router.put('/password', ctrl.cambiarContrasena);
router.post('/account/deletion-request', securityEmailLimiter, ctrl.solicitarEliminacion);
router.get('/privacy/export', ctrl.exportarDatos);
router.get('/admin/pending-deletions', requireRole('Admin', 'Administrador'), ctrl.listarBajasPendientes);
router.delete('/admin/pending-deletions/:id', requireRole('Admin', 'Administrador'), ctrl.cancelarBajaPendiente);
router.post('/admin/pending-deletions/:id/anonymize', requireRole('Admin', 'Administrador'), ctrl.anonimizarCuentaVencida);

module.exports = router;
