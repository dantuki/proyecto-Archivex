const express = require('express');
const multer = require('multer');

const router = express.Router();

const convocatoriaController =
  require('../controllers/convocatoriaController');

const verificarToken =
  require('../middleware/authMiddleware');

const {
  requireRole
} = require('../middleware/roleMiddleware');

const {
  validarFirmasPostSubida
} = require('../middleware/secureUpload');

const {
  PUBLIC_DIR
} = require('../config/uploadPaths');

// ============================================================
// CONFIGURACIÓN DE SUBIDA DE ARCHIVOS
// ============================================================
//
// Las bases de las convocatorias son documentos públicos según
// el diseño actual del sistema.
//
// Se almacenan en PUBLIC_DIR y se sirven mediante /uploads.
//
// Seguridad:
// - solo PDF;
// - extensión generada por el servidor;
// - nombre físico generado por el servidor;
// - máximo 10 MB;
// - validación posterior de magic bytes.
// ============================================================

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      cb
    ) => {
      cb(
        null,
        PUBLIC_DIR
      );
    },

    filename: (
      req,
      file,
      cb
    ) => {
      const uniqueSuffix =
        Date.now() +
        '-' +
        Math.round(
          Math.random() * 1e9
        );

      cb(
        null,
        `bases-${uniqueSuffix}.pdf`
      );
    }
  });

// ============================================================
// MULTER
// ============================================================

const upload =
  multer({
    storage,

    fileFilter: (
      req,
      file,
      cb
    ) => {
      if (
        file.mimetype ===
        'application/pdf'
      ) {
        return cb(
          null,
          true
        );
      }

      return cb(
        new Error(
          'Solo se permiten archivos en formato PDF.'
        ),
        false
      );
    },

    limits: {
      fileSize:
        10 * 1024 * 1024,
      files: 1
    }
  });

// ============================================================
// MANEJO CONTROLADO DE MULTER
// ============================================================
//
// Los errores esperables de subida se convierten en 400.
// ============================================================

const handleMulterUpload = (
  req,
  res,
  next
) => {
  upload.single(
    'archivo_bases'
  )(
    req,
    res,
    (error) => {
      if (
        error instanceof
        multer.MulterError
      ) {
        if (
          error.code ===
          'LIMIT_FILE_SIZE'
        ) {
          return res.status(400).json({
            status:
              'error',
            message:
              'El archivo de bases excede el límite de 10 MB.'
          });
        }

        if (
          error.code ===
          'LIMIT_UNEXPECTED_FILE'
        ) {
          return res.status(400).json({
            status:
              'error',
            message:
              'Se recibió un campo de archivo no permitido.'
          });
        }

        return res.status(400).json({
          status:
            'error',
          message:
            'No fue posible procesar el archivo enviado.'
        });
      }

      if (error) {
        return res.status(400).json({
          status:
            'error',
          message:
            error.message ||
            'No fue posible procesar el archivo enviado.'
        });
      }

      next();
    }
  );
};

// ============================================================
// RUTAS PÚBLICAS
// ============================================================
//
// Cualquier visitante puede consultar convocatorias.
// ============================================================

router.get(
  '/',
  convocatoriaController.getConvocatorias
);

router.get(
  '/:id',
  convocatoriaController.getConvocatoriaById
);

// ============================================================
// RUTAS ADMINISTRATIVAS
// ============================================================
//
// Solo Admin puede crear, modificar y eliminar.
//
// requireRole() aparece ANTES de Multer para evitar que un
// usuario sin permisos provoque una subida de archivo.
// ============================================================

router.post(
  '/',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador'
  ),
  handleMulterUpload,
  validarFirmasPostSubida,
  convocatoriaController.createConvocatoria
);

router.put(
  '/:id',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador'
  ),
  handleMulterUpload,
  validarFirmasPostSubida,
  convocatoriaController.updateConvocatoria
);

router.delete(
  '/:id',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador'
  ),
  convocatoriaController.deleteConvocatoria
);

module.exports = router;