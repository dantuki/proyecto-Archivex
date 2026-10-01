const express = require('express');

const router =
  express.Router();

const SedeController =
  require('../controllers/sedeController');

const verificarToken =
  require('../middleware/authMiddleware');

const {
  requireRole
} = require('../middleware/roleMiddleware');

// ============================================================
// CONSULTA PÚBLICA
// ============================================================
//
// El catálogo de sedes puede ser consultado sin autenticación.
// ============================================================

router.get(
  '/',
  SedeController.getSedes
);

router.get(
  '/:id',
  SedeController.getSedeById
);

// ============================================================
// OPERACIONES ADMINISTRATIVAS
// ============================================================
//
// Solo Admin puede:
//
// - crear sedes;
// - modificar sedes;
// - eliminar sedes.
//
// requireRole() se ejecuta antes del controller.
// ============================================================

router.post(
  '/',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador'
  ),
  SedeController.createSede
);

router.put(
  '/:id',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador'
  ),
  SedeController.updateSede
);

router.delete(
  '/:id',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador'
  ),
  SedeController.deleteSede
);

module.exports = router;