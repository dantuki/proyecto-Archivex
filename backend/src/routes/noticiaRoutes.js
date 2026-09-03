const express = require('express');

const router = express.Router();

const ctrl = require('../controllers/noticiaController');

const multer = require('multer');

const verificarToken = require('../middleware/authMiddleware');

const {
  validarFirmasPostSubida
} = require('../middleware/secureUpload');

const {
  PRIVATE_DIR
} = require('../config/uploadPaths');

// ============================================================
// CONFIGURACIÓN DE ARCHIVOS
// ============================================================
//
// Las noticias pueden incluir un documento adjunto.
//
// Tipos permitidos:
// - PDF
// - PNG
// - JPEG
//
// La extensión física NO se obtiene del nombre enviado por
// el cliente.
//
// El archivo se almacena en PRIVATE_DIR porque los adjuntos
// de noticias no deben quedar expuestos mediante /uploads.
// ============================================================

const MIME_EXT = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PRIVATE_DIR);
  },

  filename: (req, file, cb) => {
    const ext = MIME_EXT[file.mimetype];

    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    cb(
      null,
      `doc-${uniqueSuffix}${ext}`
    );
  }
});

const upload = multer({
  storage,

  fileFilter: (req, file, cb) => {
    if (MIME_EXT[file.mimetype]) {
      return cb(null, true);
    }

    return cb(
      new Error(
        'Formato no permitido. Solo se aceptan PDF, PNG o JPG.'
      ),
      false
    );
  },

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

// ============================================================
// AUTENTICACIÓN
// ============================================================
//
// Todas las operaciones de noticias requieren una sesión
// autenticada.
//
// La autorización sobre la noticia concreta se valida en el
// controller mediante req.user.
// ============================================================

router.use(verificarToken);

// ============================================================
// CONSULTAR NOTICIAS DE UN USUARIO
// ============================================================
//
// El controller debe verificar:
//
// Admin:
//   puede consultar.
//
// Usuario normal:
//   únicamente sus propias noticias.
//
// No confiamos únicamente en la URL.
// ============================================================

router.get(
  '/usuario/:usuarioId',
  ctrl.getNoticiasUsuario
);

// ============================================================
// CREAR NOTICIA
// ============================================================
//
// Flujo:
//
// JWT
//  ↓
// Multer
//  ↓
// validación de MIME/extensión permitida
//  ↓
// validación de magic bytes
//  ↓
// controller
//
// La identidad del autor será obtenida del JWT.
// ============================================================

router.post(
  '/',
  upload.single('archivo'),
  validarFirmasPostSubida,
  ctrl.crearNoticia
);

// ============================================================
// ACTUALIZAR NOTICIA
// ============================================================

router.put(
  '/:id',
  upload.single('archivo'),
  validarFirmasPostSubida,
  ctrl.actualizarNoticia
);

// ============================================================
// ELIMINAR NOTICIA
// ============================================================

router.delete(
  '/:id',
  ctrl.eliminarNoticia
);

module.exports = router;