const express = require('express');

const router = express.Router();

const solicitudController =
  require('../controllers/solicitudController');

const verificarToken =
  require('../middleware/authMiddleware');

const upload =
  require('../middleware/uploadMiddleware');

const {
  validarFirmasPostSubida
} = require('../middleware/secureUpload');

const multer = require('multer');

// ============================================================
// CAMPOS DE ARCHIVOS
// ============================================================
//
// ArchiveX utiliza cuatro documentos:
//
// - presupuesto
// - cronograma
// - honestidad
// - identidad
//
// Cada campo admite como máximo un archivo.
// ============================================================

const uploadFields = upload.fields([
  {
    name: 'presupuesto',
    maxCount: 1
  },
  {
    name: 'cronograma',
    maxCount: 1
  },
  {
    name: 'honestidad',
    maxCount: 1
  },
  {
    name: 'identidad',
    maxCount: 1
  }
]);

// ============================================================
// MANEJO CONTROLADO DE ERRORES DE MULTER
// ============================================================
//
// Evitamos que errores esperables de subida terminen como 500.
//
// Ejemplos:
//
// - archivo demasiado grande;
// - campo inesperado;
// - demasiados archivos;
// - MIME no permitido.
// ============================================================

const handleMulterUpload = (
  req,
  res,
  next
) => {
  uploadFields(
    req,
    res,
    (error) => {
      if (
        error instanceof multer.MulterError
      ) {
        if (
          error.code === 'LIMIT_FILE_SIZE'
        ) {
          return res.status(400).json({
            status: 'error',
            message:
              'Uno de los archivos excede el límite de peso permitido.'
          });
        }

        if (
          error.code === 'LIMIT_FILE_COUNT'
        ) {
          return res.status(400).json({
            status: 'error',
            message:
              'Se excedió la cantidad máxima de archivos permitidos.'
          });
        }

        if (
          error.code === 'LIMIT_UNEXPECTED_FILE'
        ) {
          return res.status(400).json({
            status: 'error',
            message:
              'Se recibió un campo de archivo no permitido.'
          });
        }

        return res.status(400).json({
          status: 'error',
          message:
            'No fue posible procesar los archivos enviados.'
        });
      }

      if (error) {
        return res.status(400).json({
          status: 'error',
          message:
            error.message ||
            'No fue posible procesar los archivos enviados.'
        });
      }

      next();
    }
  );
};

// ============================================================
// RUTAS DE CONSULTA
// ============================================================

// ------------------------------------------------------------
// OBTENER SOLICITUDES
// ------------------------------------------------------------

router.get(
  '/',
  verificarToken,
  solicitudController.getSolicitudes
);

// ------------------------------------------------------------
// OBTENER MIS SOLICITUDES
// ------------------------------------------------------------
//
// Debe aparecer antes de /:id para evitar que
// "mis-solicitudes" sea tratado como un identificador.
// ------------------------------------------------------------

router.get(
  '/mis-solicitudes',
  verificarToken,
  solicitudController.getMisSolicitudes
);

// ------------------------------------------------------------
// OBTENER SOLICITUD POR ID
// ------------------------------------------------------------

router.get(
  '/:id',
  verificarToken,
  solicitudController.getSolicitudById
);

// ============================================================
// CREAR SOLICITUD
// ============================================================
//
// Flujo:
//
// JWT
//   ↓
// Multer
//   ↓
// validación MIME
//   ↓
// validación magic bytes
//   ↓
// controller
//
// Ningún archivo llega al controller si falla la validación
// de contenido.
// ============================================================

router.post(
  '/',
  verificarToken,
  handleMulterUpload,
  validarFirmasPostSubida,
  solicitudController.createSolicitud
);

// ============================================================
// ACTUALIZAR SOLICITUD
// ============================================================

router.put(
  '/:id',
  verificarToken,
  handleMulterUpload,
  validarFirmasPostSubida,
  solicitudController.updateSolicitud
);

// ============================================================
// ELIMINAR SOLICITUD
// ============================================================

router.delete(
  '/:id',
  verificarToken,
  solicitudController.deleteSolicitud
);

module.exports = router;