const express = require('express');

const router =
  express.Router();

const reporteController =
  require('../controllers/reporteController');

const verificarToken =
  require('../middleware/authMiddleware');

const {
  requireRole
} = require('../middleware/roleMiddleware');

// ============================================================
// PROTECCIÓN GENERAL
// ============================================================
//
// Todos los reportes contienen información institucional y
// están destinados al módulo administrativo.
//
// Requisitos:
//
// 1. JWT válido
// 2. Rol Admin
//
// La autorización también se comprueba dentro del controller
// como defensa en profundidad.
// ============================================================

router.use(
  verificarToken
);

router.use(
  requireRole(
    'Admin',
    'Administrador'
  )
);

// ============================================================
// REPORTES
// ============================================================

// Reporte general de convocatorias
router.get(
  '/convocatorias',
  reporteController.getReporteConvocatorias
);

// Demografía por sedes
router.get(
  '/sedes-demografia',
  reporteController.getReporteSedesDemografia
);

// Control de evaluadores
router.get(
  '/evaluadores',
  reporteController.getReporteEvaluadores
);

// Proyectos y títulos asociados
router.get(
  '/proyectos-titulos',
  reporteController.getReporteProyectosTitulos
);

module.exports = router;