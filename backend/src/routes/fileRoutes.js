const express = require('express');

const verificarToken = require('../middleware/authMiddleware.js');
const {
  descargarArchivoPrivado
} = require('../controllers/fileController.js');

const router = express.Router();

/**
 * Todos los archivos privados requieren JWT.
 *
 * La autorización fina (Admin / propietario)
 * se realiza dentro de fileController.js.
 */
router.get(
  '/:archivo',
  verificarToken,
  descargarArchivoPrivado
);

module.exports = router;