const multer = require('multer');
const { PRIVATE_DIR } = require('../config/uploadPaths');

// ============================================================
// ARCHIVOS PERMITIDOS
// ============================================================
//
// No utilizamos la extensión enviada por el usuario.
// La extensión física será determinada por el MIME permitido.
//

const MIME_EXT = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg'
};

// ============================================================
// STORAGE
// ============================================================
//
// Este middleware se utiliza para documentos que deben quedar
// fuera de la carpeta pública.
//
// IMPORTANTE:
// PRIVATE_DIR está definido en:
// backend/src/config/uploadPaths.js
//
// Los archivos NO se almacenan dentro de /uploads.
//

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PRIVATE_DIR);
  },

  filename: (req, file, cb) => {
    const ext = MIME_EXT[file.mimetype];

    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// ============================================================
// FILE FILTER
// ============================================================
//
// Solo aceptamos explícitamente:
// - PDF
// - PNG
// - JPEG/JPG
//
// No confiamos en la extensión original del archivo.
//

const fileFilter = (req, file, cb) => {
  if (MIME_EXT[file.mimetype]) {
    return cb(null, true);
  }

  return cb(
    new Error(
      'Formato no válido. Solo se permiten archivos PDF, PNG o JPG/JPEG.'
    ),
    false
  );
};

// ============================================================
// MULTER
// ============================================================
//
// Límite máximo por archivo: 10 MB
// Límite máximo de archivos en la petición: 5
//
// El segundo control será especialmente importante cuando una
// ruta utilice upload.fields().
// ============================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  }
});

module.exports = upload;