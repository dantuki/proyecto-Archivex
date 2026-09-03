const express = require('express');

const router = express.Router();

const SedeController = require('../controllers/sedeController');
const verificarToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

/**
 * Consulta de sedes:
 * puede mantenerse pública porque el frontend necesita
 * mostrar el catálogo de sedes.
 */
router.get('/', SedeController.getSedes);
router.get('/:id', SedeController.getSedeById);

/**
 * Operaciones administrativas:
 * crear, modificar y eliminar sedes.
 */
router.post(
  '/',
  verificarToken,
  requireRole('Admin'),
  SedeController.createSede
);

router.put(
  '/:id',
  verificarToken,
  requireRole('Admin'),
  SedeController.updateSede
);

router.delete(
  '/:id',
  verificarToken,
  requireRole('Admin'),
  SedeController.deleteSede
);

module.exports = router;