const express = require('express');

const verificarToken =
  require('../middleware/authMiddleware.js');

const {
  descargarArchivoPrivado
} = require('../controllers/fileController.js');

const router =
  express.Router();

// ============================================================
// ARCHIVOS PRIVADOS
// ============================================================
//
// Todos los archivos privados requieren autenticación.
//
// La autorización fina se realiza dentro del controller:
//
// - Admin
// - propietario del recurso
// - evaluador asignado a la solicitud correspondiente
//
// No se utiliza ningún identificador de usuario enviado por
// el cliente para determinar permisos.
// ============================================================

router.get(
  '/:archivo',
  verificarToken,
  descargarArchivoPrivado
);

module.exports = router;