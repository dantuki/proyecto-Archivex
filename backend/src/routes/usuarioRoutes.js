const express =
  require('express');

const multer =
  require('multer');

const router =
  express.Router();

const ctrl =
  require('../controllers/usuarioController');

const verificarToken =
  require('../middleware/authMiddleware');

const {
  requireRole
} =
  require('../middleware/roleMiddleware');

const {
  validarFirmasPostSubida
} =
  require('../middleware/secureUpload');

const {
  PUBLIC_DIR,
  PRIVATE_DIR
} =
  require('../config/uploadPaths');

// ============================================================
// TIPOS DE ARCHIVO PERMITIDOS
// ============================================================

const MIME_EXT_FOTO = {
  'image/png':
    '.png',

  'image/jpeg':
    '.jpg'
};

const MIME_EXT_CERT = {
  'application/pdf':
    '.pdf'
};

// ============================================================
// STORAGE
// ============================================================

const storage =
  multer.diskStorage({
    destination: (
      req,
      file,
      cb
    ) => {
      if (
        file.fieldname ===
        'certificado'
      ) {
        return cb(
          null,
          PRIVATE_DIR
        );
      }

      return cb(
        null,
        PUBLIC_DIR
      );
    },

    filename: (
      req,
      file,
      cb
    ) => {
      const mapa =
        file.fieldname ===
          'certificado'
          ? MIME_EXT_CERT
          : MIME_EXT_FOTO;

      const extension =
        mapa[
          file.mimetype
        ];

      if (
        !extension
      ) {
        return cb(
          new Error(
            'Tipo de archivo no permitido.'
          )
        );
      }

      const uniqueSuffix =
        Date.now() +
        '-' +
        Math.round(
          Math.random() *
            1e9
        );

      return cb(
        null,
        `${file.fieldname}-${uniqueSuffix}${extension}`
      );
    }
  });

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (
  req,
  file,
  cb
) => {
  if (
    file.fieldname ===
    'foto'
  ) {
    if (
      MIME_EXT_FOTO[
        file.mimetype
      ]
    ) {
      return cb(
        null,
        true
      );
    }

    return cb(
      new Error(
        'El campo "foto" solo admite imágenes PNG o JPG/JPEG.'
      ),
      false
    );
  }

  if (
    file.fieldname ===
    'certificado'
  ) {
    if (
      MIME_EXT_CERT[
        file.mimetype
      ]
    ) {
      return cb(
        null,
        true
      );
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

const upload =
  multer({
    storage,
    fileFilter,

    limits: {
      fileSize:
        10 *
        1024 *
        1024,

      files:
        2
    }
  });

// ============================================================
// MANEJO CONTROLADO DE ERRORES DE MULTER
// ============================================================

const handleMulterUpload = (
  req,
  res,
  next
) => {
  upload.fields([
    {
      name:
        'foto',
      maxCount:
        1
    },
    {
      name:
        'certificado',
      maxCount:
        1
    }
  ])(
    req,
    res,
    (
      error
    ) => {
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
              'Uno de los archivos excede el límite de peso permitido (10 MB).'
          });
        }

        if (
          error.code ===
          'LIMIT_FILE_COUNT'
        ) {
          return res.status(400).json({
            status:
              'error',
            message:
              'Se excedió la cantidad máxima de archivos permitidos.'
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
            'No fue posible procesar los archivos enviados.'
        });
      }

      if (
        error
      ) {
        return res.status(400).json({
          status:
            'error',
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
// AUTENTICACIÓN GLOBAL
// ============================================================

router.use(
  verificarToken
);

// ============================================================
// ADMINISTRACIÓN
// ============================================================

router.get(
  '/',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.getUsuarios
);

router.get(
  '/evaluadores',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.getEvaluadores
);

router.post(
  '/registro',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.registrarUsuario
);

// ============================================================
// PURGA DE DESARROLLO
// ============================================================

router.delete(
  '/mantenimiento/purgar-todo',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.limpiarTablaDesarrollo
);

// ============================================================
// USUARIO INDIVIDUAL
// ============================================================

router.get(
  '/:id',
  ctrl.getUsuarioById
);

// ============================================================
// ACTUALIZAR USUARIO
// ============================================================

router.put(
  '/:id',
  handleMulterUpload,
  validarFirmasPostSubida,
  ctrl.updateUsuario
);

// ============================================================
// ELIMINAR USUARIO
// ============================================================

router.delete(
  '/:id',
  requireRole(
    'Admin',
    'Administrador'
  ),
  ctrl.deleteUsuario
);

module.exports =
  router;