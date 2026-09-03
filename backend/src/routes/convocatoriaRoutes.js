const express = require('express');

const router = express.Router();

const convocatoriaController = require('../controllers/convocatoriaController');

const verificarToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validarFirmasPostSubida } = require('../middleware/secureUpload');
const { PUBLIC_DIR } = require('../config/uploadPaths');

const multer = require('multer');

// ============================================================
// CONFIGURACIÓN DE SUBIDA DE ARCHIVOS
// ============================================================
//
// Las bases de las convocatorias son documentos institucionales
// públicos según el diseño actual del sistema.
//
// El archivo se guarda en uploads/ y la URL pública de la
// convocatoria continúa funcionando.
//
// IMPORTANTE:
// - No usamos la extensión enviada por el cliente.
// - Solo permitimos PDF.
// - El nombre físico lo genera el servidor.
// - Se limita el tamaño.
// - Después de Multer se valida la firma binaria real.
//

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PUBLIC_DIR);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);

    // La extensión es fija porque esta ruta únicamente admite PDF.
    cb(null, `bases-${uniqueSuffix}.pdf`);
  }
});

const upload = multer({
  storage,

  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      return cb(null, true);
    }

    return cb(
      new Error('Solo se permiten archivos en formato PDF'),
      false
    );
  },

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

// ============================================================
// RUTAS PÚBLICAS
// ============================================================
//
// Cualquier visitante puede consultar las convocatorias.
// Esto se conserva porque el frontend actual utiliza estas
// rutas sin autenticación.
//
// GET /api/convocatorias
// GET /api/convocatorias/:id
//

router.get('/', convocatoriaController.getConvocatorias);

router.get('/:id', convocatoriaController.getConvocatoriaById);

// ============================================================
// RUTAS ADMINISTRATIVAS
// ============================================================
//
// V10:
// Solo un usuario autenticado con rol Admin puede:
//
// POST   /api/convocatorias
// PUT    /api/convocatorias/:id
// DELETE /api/convocatorias/:id
//
// MUY IMPORTANTE:
// requireRole() aparece ANTES de Multer para que un usuario sin
// permisos ni siquiera pueda provocar una subida de archivo.
//

router.post(
  '/',
  verificarToken,
  requireRole('Admin'),
  upload.single('archivo_bases'),
  validarFirmasPostSubida,
  convocatoriaController.createConvocatoria
);

router.put(
  '/:id',
  verificarToken,
  requireRole('Admin'),
  upload.single('archivo_bases'),
  validarFirmasPostSubida,
  convocatoriaController.updateConvocatoria
);

router.delete(
  '/:id',
  verificarToken,
  requireRole('Admin'),
  convocatoriaController.deleteConvocatoria
);

module.exports = router;