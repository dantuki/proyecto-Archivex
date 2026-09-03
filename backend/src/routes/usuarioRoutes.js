const express = require('express');
const multer = require('multer');

const router = express.Router();

const ctrl = require('../controllers/usuarioController');

const verificarToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const {
  validarFirmasPostSubida
} = require('../middleware/secureUpload');

const {
  PUBLIC_DIR,
  PRIVATE_DIR
} = require('../config/uploadPaths');

// ============================================================
// TIPOS DE ARCHIVO PERMITIDOS
// ============================================================
//
// FOTO:
// - PNG
// - JPEG/JPG
//
// CERTIFICADO:
// - PDF
//
// La extensión física siempre es generada por el servidor.
// Nunca se utiliza path.extname(file.originalname).
// ============================================================

const MIME_EXT_FOTO = {
  'image/png': '.png',
  'image/jpeg': '.jpg'
};

const MIME_EXT_CERT = {
  'application/pdf': '.pdf'
};

// ============================================================
// STORAGE
// ============================================================
//
// Foto:
//   pública
//
// Certificado:
//   privado
//
// Esto evita servir certificados mediante /uploads.
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'certificado') {
      return cb(null, PRIVATE_DIR);
    }

    return cb(null, PUBLIC_DIR);
  },

  filename: (req, file, cb) => {
    const mapa =
      file.fieldname === 'certificado'
        ? MIME_EXT_CERT
        : MIME_EXT_FOTO;

    const extension = mapa[file.mimetype];

    if (!extension) {
      return cb(
        new Error('Tipo de archivo no permitido.')
      );
    }

    const uniqueSuffix =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9);

    return cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${extension}`
    );
  }
});

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {

  // ----------------------------------------------------------
  // FOTO
  // ----------------------------------------------------------

  if (file.fieldname === 'foto') {
    if (MIME_EXT_FOTO[file.mimetype]) {
      return cb(null, true);
    }

    return cb(
      new Error(
        'El campo "foto" solo admite imágenes PNG o JPG/JPEG.'
      ),
      false
    );
  }

  // ----------------------------------------------------------
  // CERTIFICADO
  // ----------------------------------------------------------

  if (file.fieldname === 'certificado') {
    if (MIME_EXT_CERT[file.mimetype]) {
      return cb(null, true);
    }

    return cb(
      new Error(
        'El campo "certificado" solo admite archivos PDF.'
      ),
      false
    );
  }

  return cb(
    new Error(
      'Campo de archivo no reconocido.'
    ),
    false
  );
};

// ============================================================
// MULTER
// ============================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 2
  }
});

// ============================================================
// AUTENTICACIÓN GLOBAL
// ============================================================

router.use(verificarToken);

// ============================================================
// ADMINISTRACIÓN
// ============================================================

router.get(
  '/',
  requireRole('Admin'),
  ctrl.getUsuarios
);

router.get(
  '/evaluadores',
  requireRole('Admin'),
  ctrl.getEvaluadores
);

router.post(
  '/registro',
  requireRole('Admin'),
  ctrl.registrarUsuario
);

// ============================================================
// PURGA DE DESARROLLO
// ============================================================
//
// Debe mantenerse ANTES de /:id.
// ============================================================

router.delete(
  '/mantenimiento/purgar-todo',
  requireRole('Admin'),
  ctrl.limpiarTablaDesarrollo
);

// ============================================================
// USUARIO INDIVIDUAL
// ============================================================
//
// El controller valida ownership.
// ============================================================

router.get(
  '/:id',
  ctrl.getUsuarioById
);

// ============================================================
// ACTUALIZAR USUARIO
// ============================================================
//
// Flujo:
//
// JWT
// ↓
// Multer
// ↓
// MIME permitido
// ↓
// límite de tamaño
// ↓
// magic bytes
// ↓
// controller
//
// Foto:
//   PUBLIC_DIR
//
// Certificado:
//   PRIVATE_DIR
// ============================================================

router.put(
  '/:id',
  upload.fields([
    {
      name: 'foto',
      maxCount: 1
    },
    {
      name: 'certificado',
      maxCount: 1
    }
  ]),
  validarFirmasPostSubida,
  ctrl.updateUsuario
);

// ============================================================
// ELIMINAR USUARIO
// ============================================================

router.delete(
  '/:id',
  requireRole('Admin'),
  ctrl.deleteUsuario
);

module.exports = router;