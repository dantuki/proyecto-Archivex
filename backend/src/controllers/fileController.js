const path = require('path');
const fs = require('fs');

const db = require('../config/db.js');
const {
  PRIVATE_DIR
} = require('../config/uploadPaths.js');

// ============================================================
// UTILIDADES
// ============================================================

const normalizarRol = (rol) => {
  const valor = String(rol || '').trim().toLowerCase();

  if (valor === 'administrador') {
    return 'admin';
  }

  return valor;
};

const obtenerUsuarioAutenticadoId = (req) => {
  return Number(req.user?.id || 0);
};

const esAdminUser = (req) => {
  return normalizarRol(req.user?.rol) === 'admin';
};

/**
 * Devuelve únicamente el nombre final del archivo.
 *
 * Esto impide que un atacante pueda intentar enviar:
 *
 * ../../archivo
 * C:\Windows\...
 * ../../../etc/passwd
 */
const obtenerNombreArchivoSeguro = (valor) => {
  if (!valor || typeof valor !== 'string') {
    return null;
  }

  const nombre = path.basename(valor);

  if (
    !nombre ||
    nombre === '.' ||
    nombre === '..' ||
    nombre !== valor
  ) {
    return null;
  }

  return nombre;
};

/**
 * Construye una ruta física exclusivamente dentro
 * de PRIVATE_DIR.
 */
const obtenerRutaFisicaPrivada = (nombreArchivo) => {
  if (!nombreArchivo) {
    return null;
  }

  const directorioPrivado = path.resolve(PRIVATE_DIR);

  const rutaArchivo = path.resolve(
    directorioPrivado,
    nombreArchivo
  );

  if (
    rutaArchivo !== directorioPrivado &&
    !rutaArchivo.startsWith(
      `${directorioPrivado}${path.sep}`
    )
  ) {
    return null;
  }

  return rutaArchivo;
};

/**
 * Genera las dos representaciones utilizadas por la aplicación:
 *
 * /uploads_private/archivo.pdf
 * uploads_private/archivo.pdf
 *
 * Esto permite convivir temporalmente con registros creados
 * antes y después de la refactorización.
 */
const obtenerValoresUrlPrivada = (nombreArchivo) => {
  return [
    `/uploads_private/${nombreArchivo}`,
    `uploads_private/${nombreArchivo}`
  ];
};

// ============================================================
// AUTORIZACIÓN DEL ARCHIVO
// ============================================================

/**
 * Busca en qué recurso está registrado el archivo y determina
 * quién puede acceder a él.
 *
 * Retorna:
 *
 * {
 *   encontrado: true,
 *   propietarioIds: [...],
 *   tipo: 'solicitud' | 'evaluacion' | 'noticia' | 'usuario' | ...
 * }
 *
 * O:
 *
 * {
 *   encontrado: false
 * }
 */
const localizarArchivoEnBaseDeDatos = async (nombreArchivo) => {
  const urlsPermitidas = obtenerValoresUrlPrivada(
    nombreArchivo
  );

  // ----------------------------------------------------------
  // 1. SOLICITUDES
  // ----------------------------------------------------------

  const [solicitudRows] = await db.query(
    `
      SELECT
        id,
        usuario_id
      FROM solicitudes
      WHERE
        presupuesto_url IN (?, ?)
        OR cronograma_url IN (?, ?)
        OR honestidad_url IN (?, ?)
        OR id_url IN (?, ?)
        OR doc_par_1 IN (?, ?)
        OR doc_par_2 IN (?, ?)
    `,
    [
      urlsPermitidas[0],
      urlsPermitidas[1],
      urlsPermitidas[0],
      urlsPermitidas[1],
      urlsPermitidas[0],
      urlsPermitidas[1],
      urlsPermitidas[0],
      urlsPermitidas[1],
      urlsPermitidas[0],
      urlsPermitidas[1],
      urlsPermitidas[0],
      urlsPermitidas[1]
    ]
  );

  if (solicitudRows.length > 0) {
    return {
      encontrado: true,
      tipo: 'solicitud',
      propietarioIds: solicitudRows.map(
        (row) => Number(row.usuario_id)
      )
    };
  }

  // ----------------------------------------------------------
  // 2. DOCUMENTOS INDIVIDUALES DE SOLICITUD
  // ----------------------------------------------------------

  const [documentoRows] = await db.query(
    `
      SELECT
        ds.id,
        s.usuario_id
      FROM documentos_solicitud ds
      INNER JOIN solicitudes s
        ON s.id = ds.solicitud_id
      WHERE ds.archivo_url IN (?, ?)
    `,
    [
      urlsPermitidas[0],
      urlsPermitidas[1]
    ]
  );

  if (documentoRows.length > 0) {
    return {
      encontrado: true,
      tipo: 'documento_solicitud',
      propietarioIds: documentoRows.map(
        (row) => Number(row.usuario_id)
      )
    };
  }

  // ----------------------------------------------------------
  // 3. ARCHIVOS DE EVALUACIÓN
  // ----------------------------------------------------------

  const [evaluacionRows] = await db.query(
    `
      SELECT
        id,
        evaluador_id
      FROM asignacion_evaluaciones
      WHERE archivo_evaluacion IN (?, ?)
    `,
    [
      urlsPermitidas[0],
      urlsPermitidas[1]
    ]
  );

  if (evaluacionRows.length > 0) {
    return {
      encontrado: true,
      tipo: 'evaluacion',
      propietarioIds: evaluacionRows.map(
        (row) => Number(row.evaluador_id)
      )
    };
  }

  // ----------------------------------------------------------
  // 4. ARCHIVOS DE NOTICIAS
  // ----------------------------------------------------------

  const [noticiaRows] = await db.query(
    `
      SELECT
        id,
        usuario_id
      FROM noticias
      WHERE archivo_url IN (?, ?)
    `,
    [
      urlsPermitidas[0],
      urlsPermitidas[1]
    ]
  );

  if (noticiaRows.length > 0) {
    return {
      encontrado: true,
      tipo: 'noticia',
      propietarioIds: noticiaRows.map(
        (row) => Number(row.usuario_id)
      )
    };
  }

  // ----------------------------------------------------------
  // 5. CERTIFICADO / ARCHIVO PRIVADO DE USUARIO
  // ----------------------------------------------------------

  const [usuarioRows] = await db.query(
    `
      SELECT
        id
      FROM usuarios
      WHERE certificado_url IN (?, ?)
    `,
    [
      urlsPermitidas[0],
      urlsPermitidas[1]
    ]
  );

  if (usuarioRows.length > 0) {
    return {
      encontrado: true,
      tipo: 'usuario',
      propietarioIds: usuarioRows.map(
        (row) => Number(row.id)
      )
    };
  }

  return {
    encontrado: false,
    propietarioIds: [],
    tipo: null
  };
};

// ============================================================
// DESCARGAR ARCHIVO PRIVADO
// ============================================================

const descargarArchivoPrivado = async (req, res) => {
  try {
    // --------------------------------------------------------
    // 1. AUTENTICACIÓN
    // --------------------------------------------------------

    const usuarioId = obtenerUsuarioAutenticadoId(req);

    if (!usuarioId) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado.'
      });
    }

    // --------------------------------------------------------
    // 2. VALIDAR NOMBRE DEL ARCHIVO
    // --------------------------------------------------------

    const nombreArchivo = obtenerNombreArchivoSeguro(
      req.params.archivo
    );

    if (!nombreArchivo) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre de archivo no válido.'
      });
    }

    // --------------------------------------------------------
    // 3. LOCALIZAR EL REGISTRO EN BD
    // --------------------------------------------------------

    const registro =
      await localizarArchivoEnBaseDeDatos(
        nombreArchivo
      );

    if (!registro.encontrado) {
      return res.status(404).json({
        status: 'error',
        message: 'Archivo no encontrado.'
      });
    }

    // --------------------------------------------------------
    // 4. AUTORIZACIÓN
    // --------------------------------------------------------

    const esAdmin = esAdminUser(req);

    const esPropietario =
      registro.propietarioIds.includes(usuarioId);

    if (!esAdmin && !esPropietario) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permisos para acceder a este archivo.'
      });
    }

    // --------------------------------------------------------
    // 5. RUTA FÍSICA SEGURA
    // --------------------------------------------------------

    const rutaArchivo =
      obtenerRutaFisicaPrivada(
        nombreArchivo
      );

    if (!rutaArchivo) {
      return res.status(400).json({
        status: 'error',
        message: 'Ruta de archivo no válida.'
      });
    }

    // --------------------------------------------------------
    // 6. COMPROBAR EXISTENCIA
    // --------------------------------------------------------

    if (
      !fs.existsSync(rutaArchivo)
    ) {
      return res.status(404).json({
        status: 'error',
        message: 'Archivo no encontrado en el servidor.'
      });
    }

    // --------------------------------------------------------
    // 7. MIME
    // --------------------------------------------------------

    const extension =
      path.extname(
        nombreArchivo
      ).toLowerCase();

    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    };

    const contentType =
      mimeTypes[extension] ||
      'application/octet-stream';

    // --------------------------------------------------------
    // 8. CABECERAS DE SEGURIDAD
    // --------------------------------------------------------

    res.setHeader(
      'Content-Type',
      contentType
    );

    res.setHeader(
      'Content-Disposition',
      'inline'
    );

    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    // --------------------------------------------------------
    // 9. ENVÍO
    // --------------------------------------------------------

    return res.sendFile(
      rutaArchivo
    );
  } catch (error) {
    console.error(
      'Error descargando archivo privado:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'No fue posible acceder al archivo.'
    });
  }
};

module.exports = {
  descargarArchivoPrivado
};