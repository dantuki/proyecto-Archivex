const express = require('express');
const verificarToken = require('../middleware/authMiddleware');
const ctrl = require('../controllers/settingsController');

const router = express.Router();
router.use(verificarToken);

router.get('/preferences', ctrl.obtenerPreferencias);
router.put('/preferences', ctrl.actualizarPreferencias);
router.get('/notifications', ctrl.listarNotificaciones);
router.patch('/notifications/:id/read', ctrl.marcarNotificacionLeida);
router.get('/sessions', ctrl.listarSesiones);
router.post('/sessions/revoke-others', ctrl.revocarOtrasSesiones);
router.put('/password', ctrl.cambiarContrasena);
router.post('/account/deletion-request', ctrl.solicitarEliminacion);

module.exports = router;
