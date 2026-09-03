const express = require('express');

const router = express.Router();

const postulacionController = require('../controllers/postulacionController');

const verificarToken = require('../middleware/authMiddleware');

const { requireRole } = require('../middleware/roleMiddleware');

const {
  validarFirmasPostSubida
} = require('../middleware/secureUpload');

const { PRIVATE_DIR } = require('../config/uploadPaths');

const multer = require('multer');

// ============================================================
// CONFIGURACIÓN DE ARCHIVOS
// ============================================================
//
// Las postulaciones utilizan cuatro documentos:
//
// - presupuesto
// - cronograma
// - honestidad
// - identidad
//
// Actualmente el flujo funcional trabaja con PDF.
// Los archivos se almacenan en PRIVATE_DIR para evitar que
// queden expuestos mediante el directorio público /uploads.
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PRIVATE_DIR);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    // La extensión no viene del nombre original del usuario.
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}.pdf`
    );
  }
});

// ============================================================
// FILTRO DE ARCHIVOS
// ============================================================

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    return cb(null, true);
  }

  return cb(
    new Error(
      'Solo se permiten archivos en formato PDF.'
    ),
    false
  );
};

// ============================================================
// MULTER
// ============================================================
//
// Máximo 10 MB por archivo.
// Máximo 4 archivos según los campos definidos.
//
// La validación de contenido real se realiza posteriormente
// mediante validarFirmasPostSubida.
// ============================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 4
  }
});

// ============================================================
// CAMPOS ESPERADOS
// ============================================================

const cpUpload = upload.fields([
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
// MANEJO DE ERRORES DE MULTER
// ============================================================

const handleMulterUpload = (req, res, next) => {
  cpUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message:
            'Uno de los archivos excede el límite de peso permitido (10 MB).'
        });
      }

      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          status: 'error',
          message:
            'Se excedió la cantidad máxima de archivos permitidos.'
        });
      }

      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
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
        message: error.message
      });
    }

    next();
  });
};

// ============================================================
// RUTAS
// ============================================================

// ------------------------------------------------------------
// RADICAR POSTULACIÓN
// ------------------------------------------------------------
//
// El usuario autenticado crea la postulación.
//
// La identidad del usuario debe ser determinada en el
// controller mediante req.user y no mediante una identidad
// arbitraria enviada desde el frontend.
//

router.post(
  '/radicar',
  verificarToken,
  handleMulterUpload,
  validarFirmasPostSubida,
  postulacionController.createPostulacion
);

// ------------------------------------------------------------
// MIS SOLICITUDES
// ------------------------------------------------------------

router.get(
  '/mis-solicitudes',
  verificarToken,
  postulacionController.getPostulacionesByUser
);

// ------------------------------------------------------------
// BANDEJA ADMINISTRATIVA
// ------------------------------------------------------------
//
// Se mantiene el comportamiento funcional actual:
// Admin/Administrador y Evaluador pueden consultar esta vista.
//
// La autorización real debe seguir siendo validada también
// en controller si existen restricciones adicionales sobre
// los registros mostrados.
//

router.get(
  '/',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador',
    'Evaluador'
  ),
  postulacionController.getPostulacionesAdmin
);

// ------------------------------------------------------------
// ACTUALIZAR ESTADO
// ------------------------------------------------------------
//
// Solo Admin puede ejecutar esta operación.
// Se evita que un Evaluador pueda convertir esta ruta en una
// operación administrativa simplemente por estar autenticado.
//

router.put(
  '/:id/estado',
  verificarToken,
  requireRole(
    'Admin',
    'Administrador'
  ),
  postulacionController.updateEstadoPostulacion
);

module.exports = router;