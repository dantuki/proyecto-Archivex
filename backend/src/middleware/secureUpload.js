const fs = require('fs');

// ============================================================
// VALIDACIÓN DE FIRMA BINARIA REAL
// ============================================================
//
// V12:
// No confiamos únicamente en:
// - file.mimetype
// - file.originalname
// - extensión del archivo
//
// Después de que Multer guarda el archivo temporalmente,
// comprobamos sus primeros bytes (magic bytes) contra el tipo
// permitido declarado por el servidor.
//
// Tipos soportados actualmente por ArchiveX:
//
// PDF
// PNG
// JPEG
//

const FIRMAS = {
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46] // %PDF
  ],

  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  ],

  'image/jpeg': [
    [0xFF, 0xD8, 0xFF]
  ]
};

function coincideFirma(buffer, firma) {
  if (!buffer || buffer.length < firma.length) {
    return false;
  }

  return firma.every((byte, index) => buffer[index] === byte);
}

function verificarFirmaArchivo(filePath, mimetypeEsperado) {
  const firmas = FIRMAS[mimetypeEsperado];

  if (!firmas) {
    return false;
  }

  let fd;

  try {
    fd = fs.openSync(filePath, 'r');

    // Las firmas soportadas actualmente tienen como máximo 8 bytes.
    const buffer = Buffer.alloc(8);

    const bytesLeidos = fs.readSync(
      fd,
      buffer,
      0,
      buffer.length,
      0
    );

    if (bytesLeidos <= 0) {
      return false;
    }

    return firmas.some((firma) =>
      coincideFirma(buffer, firma)
    );
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
    }
  }
}

// ============================================================
// MIDDLEWARE POST-MULTER
// ============================================================
//
// Este middleware se ejecuta DESPUÉS de Multer.
//
// Revisa:
// - req.file
// - req.files
//
// Si encuentra un archivo cuya firma real no coincide con el
// MIME permitido, elimina los archivos de la petición y rechaza
// toda la operación.
//

function validarFirmasPostSubida(req, res, next) {
  const archivos = [];

  if (req.file) {
    archivos.push(req.file);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      archivos.push(...req.files);
    } else {
      Object.values(req.files).forEach((lista) => {
        if (Array.isArray(lista)) {
          archivos.push(...lista);
        }
      });
    }
  }

  // No hay archivos: continuar normalmente.
  if (archivos.length === 0) {
    return next();
  }

  for (const file of archivos) {
    let valido = false;

    try {
      valido = verificarFirmaArchivo(
        file.path,
        file.mimetype
      );
    } catch (error) {
      console.error(
        'Error al validar la firma del archivo:',
        error.message
      );

      valido = false;
    }

    if (!valido) {
      // Eliminamos todos los archivos recibidos en esta petición.
      for (const archivo of archivos) {
        try {
          fs.unlinkSync(archivo.path);
        } catch (_) {
          // No interrumpimos la respuesta por un fallo de limpieza.
        }
      }

      return res.status(400).json({
        status: 'error',
        message: `El archivo "${file.originalname}" no coincide con el tipo declarado.`
      });
    }
  }

  next();
}

module.exports = {
  validarFirmasPostSubida,
  verificarFirmaArchivo
};