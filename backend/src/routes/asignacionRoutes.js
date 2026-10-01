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
//
// - consultar asignaciones sin sesión;
// - crear asignaciones sin sesión;
// - calificar sin sesión;
// - eliminar asignaciones sin sesión.
//
// La autorización concreta por rol y ownership se aplica
// posteriormente según cada operación.
// ============================================================

router.use(verificarToken);

// ============================================================
// CONSULTAR ASIGNACIONES
// ============================================================
//
// ADMIN:
// Puede consultar todas.
//
// EVALUADOR:
// Puede consultar sus propias asignaciones.
//
// DOCENTE:
// No recibe acceso administrativo a las asignaciones.
// ============================================================

// ------------------------------------------------------------
// GET GENERAL
// ------------------------------------------------------------
//
// Admin:
//   puede consultar todas.
//
// Evaluador:
//   obtiene únicamente sus propias asignaciones.
//
// El controller mantiene una segunda validación de ownership.
//

router.get(
  '/',
  requireRole(
    'Admin',
    'Administrador',
    'Evaluador'
  ),
  ctrl.getAsignaciones
);

// ------------------------------------------------------------
// GET TODAS
// ------------------------------------------------------------
//
// Se conserva por compatibilidad con el frontend.
//
// Solo Admin puede utilizar esta ruta.
//

router.get(
  '/todas',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.getAsignaciones
);

// ------------------------------------------------------------
// GET POR EVALUADOR
// ------------------------------------------------------------
//
// Admin:
//   puede consultar las asignaciones de cualquier evaluador.
//
// Evaluador:
//   solamente puede consultar sus propias asignaciones.
//
// El controller debe comprobar nuevamente el ownership.
//

router.get(
  '/evaluador/:evaluadorId',
  requireRole(
    'Admin',
    'Administrador',
    'Evaluador'
  ),
  ctrl.getAsignacionesByEvaluador
);

// ------------------------------------------------------------
// GET ASIGNACIÓN ESPECÍFICA
// ------------------------------------------------------------
//
// Admin:
//   puede consultar cualquiera.
//
// Evaluador:
//   solamente puede consultar una asignación cuyo
//   evaluador_id coincida con su usuario autenticado.
//

router.get(
  '/:id',
  requireRole(
    'Admin',
    'Administrador',
    'Evaluador'
  ),
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
// ============================================================

router.post(
  '/',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.asignarEvaluador
);

// ============================================================
// CALIFICAR / SUBIR ACTA DE EVALUACIÓN
// ============================================================
//
// Permitido para:
//
// - Admin
// - Evaluador
//
// El controller debe comprobar que el Evaluador realmente sea
// el evaluador asignado al recurso.
//
// Flujo:
//
// JWT
//   ↓
// autorización por rol
//   ↓
// Multer
//   ↓
// validación de firma binaria
//   ↓
// controller
//
// De esta forma un archivo cuyo MIME declarado sea PDF pero
// cuyo contenido real no corresponda será rechazado antes
// de llegar al controller.
// ============================================================

router.put(
  '/:id/calificar',
  requireRole(
    'Admin',
    'Administrador',
    'Evaluador'
  ),
  upload.single('archivo_evaluacion'),
  validarFirmasPostSubida,
  ctrl.calificar
);

// ============================================================
// ELIMINAR ASIGNACIÓN
// ============================================================
//
// Solo Admin puede eliminar una asignación.
// ============================================================

router.delete(
  '/:id',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.deleteAsignacion
);

module.exports = router;