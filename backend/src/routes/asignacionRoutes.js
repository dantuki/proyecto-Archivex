const express = require('express');

const router = express.Router();

const ctrl = require('../controllers/asignacionController');

const upload = require('../middleware/uploadMiddleware');

const verificarToken = require('../middleware/authMiddleware');

const { requireRole } = require('../middleware/roleMiddleware');

const {
  validarFirmasPostSubida
} = require('../middleware/secureUpload');

// ============================================================
// PROTECCIÓN GENERAL
// ============================================================
//
// Todas las rutas de asignaciones requieren autenticación.
//
// No se permite:
// - consultar asignaciones sin sesión;
// - crear asignaciones sin sesión;
// - calificar sin sesión;
// - eliminar asignaciones sin sesión.
//
// La autorización concreta por rol y ownership se aplica
// posteriormente según cada operación.
//

router.use(verificarToken);

// ============================================================
// CONSULTAR ASIGNACIONES
// ============================================================
//
// ADMIN:
// Puede consultar todas.
//
// EVALUADOR:
// Puede consultar sus propias asignaciones; el controller debe
// validar que el evaluador solicitado coincida con req.user.id.
//
// DOCENTE:
// No recibe acceso administrativo a las asignaciones.
// ============================================================

// GET general
router.get(
  '/',
  requireRole('Admin', 'Evaluador'),
  ctrl.getAsignaciones
);

// GET todas
//
// Se conserva porque el frontend del Admin utiliza esta ruta.
// Solo Admin debe poder utilizarla.
router.get(
  '/todas',
  requireRole('Admin'),
  ctrl.getAsignaciones
);

// GET por evaluador
//
// Admin puede consultar cualquier evaluador.
// Evaluador solamente puede consultar sus propias asignaciones.
// La validación de ownership debe permanecer también en el
// controller y nunca depender únicamente del frontend.
router.get(
  '/evaluador/:evaluadorId',
  requireRole('Admin', 'Evaluador'),
  ctrl.getAsignacionesByEvaluador
);

// GET asignación específica
//
// Admin puede consultar cualquiera.
// Evaluador debe quedar restringido a la asignación que realmente
// le pertenece; esa comprobación corresponde al controller.
router.get(
  '/:id',
  requireRole('Admin', 'Evaluador'),
  ctrl.getAsignacionById
);

// ============================================================
// CREAR ASIGNACIÓN
// ============================================================
//
// Solo Admin puede asignar un evaluador.
//
// No confiamos en que un Evaluador pueda crear una asignación
// enviando un evaluadorId manipulado.
//

router.post(
  '/',
  requireRole('Admin'),
  ctrl.asignarEvaluador
);

// ============================================================
// CALIFICAR / SUBIR ACTA DE EVALUACIÓN
// ============================================================
//
// Permitido para:
// - Admin
// - Evaluador
//
// El controller debe comprobar que el Evaluador realmente sea
// el evaluador asignado al recurso.
//
// Flujo:
//
// JWT
//  ↓
// autorización por rol
//  ↓
// Multer
//  ↓
// validación de firma binaria
//  ↓
// controller
//
// De esta forma un archivo cuyo MIME declarado sea PDF pero
// cuyo contenido real no corresponda será rechazado antes
// de llegar al controller.
//

router.put(
  '/:id/calificar',
  requireRole('Admin', 'Evaluador'),
  upload.single('archivo_evaluacion'),
  validarFirmasPostSubida,
  ctrl.calificar
);

// ============================================================
// ELIMINAR ASIGNACIÓN
// ============================================================
//
// Solo Admin puede eliminar una asignación.
//

router.delete(
  '/:id',
  requireRole('Admin'),
  ctrl.deleteAsignacion
);

module.exports = router;