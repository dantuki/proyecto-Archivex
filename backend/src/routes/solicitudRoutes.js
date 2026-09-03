const express = require('express');

const router = express.Router();

const solicitudController = require('../controllers/solicitudController');

const verificarToken = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

const {
  validarFirmasPostSubida
} = require('../middleware/secureUpload');

// ============================================================
// CAMPOS DE ARCHIVOS
// ============================================================
//
// ArchiveX utiliza cuatro documentos en las solicitudes:
//
// - presupuesto
// - cronograma
// - honestidad
// - identidad
//
// Cada campo admite como máximo un archivo.
//

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
// RUTAS DE CONSULTA
// ============================================================

// Obtener solicitudes.
// El controller determina qué puede consultar el usuario
// según su identidad y rol.

router.get(
  '/',
  verificarToken,
  solicitudController.getSolicitudes
);

// Obtener las solicitudes del usuario autenticado.
//
// Esta ruta debe permanecer antes de /:id para evitar que
// "mis-solicitudes" sea interpretado como un ID.

router.get(
  '/mis-solicitudes',
  verificarToken,
  solicitudController.getMisSolicitudes
);

// Obtener una solicitud específica.
//
// El controller realiza la comprobación de ownership.

router.get(
  '/:id',
  verificarToken,
  solicitudController.getSolicitudById
);

// ============================================================
// CREAR SOLICITUD
// ============================================================
//
// Flujo de seguridad:
//
// 1. verificarToken
// 2. Multer
// 3. validación de magic bytes
// 4. controller
//
// Ningún archivo llega al controller si la firma binaria
// no corresponde con el tipo permitido.
//

router.post(
  '/',
  verificarToken,
  uploadFields,
  validarFirmasPostSubida,
  solicitudController.createSolicitud
);

// ============================================================
// ACTUALIZAR SOLICITUD
// ============================================================
//
// Mismo flujo seguro de subida.
//
// Además, el controller verifica ownership y controla
// los cambios administrativos de estado.
//

router.put(
  '/:id',
  verificarToken,
  uploadFields,
  validarFirmasPostSubida,
  solicitudController.updateSolicitud
);

// ============================================================
// ELIMINAR SOLICITUD
// ============================================================
//
// El controller verifica ownership o permisos administrativos.
//

router.delete(
  '/:id',
  verificarToken,
  solicitudController.deleteSolicitud
);

module.exports = router;