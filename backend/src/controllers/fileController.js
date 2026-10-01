const path = require('path');
const fs = require('fs');

const db =
  require('../config/db.js');

const {
  PRIVATE_DIR
} = require('../config/uploadPaths.js');

// ============================================================
// UTILIDADES
// ============================================================

const normalizarRol = (
  rol
) => {
  const valor =
    String(
      rol || ''
    )
      .trim()
      .toLowerCase();

  if (
    valor ===
    'administrador'
  ) {
    return 'admin';
  }

  return valor;
};

const obtenerUsuarioAutenticadoId = (
  req
) => {
  const id =
    Number(
      req.user?.id ||
      req.user?.usuario_id ||
      req.user?.id_usuario ||
      req.user?.userId ||
      0
    );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
};

const esAdminUser = (
  req
) => {
  return (
    normalizarRol(
      req.user?.rol
    ) === 'admin'
  );
};

const esEvaluadorUser = (
  req
) => {
  return (
    normalizarRol(
      req.user?.rol
    ) === 'evaluador'
  );
};

// ============================================================
// VALIDAR NOMBRE DE ARCHIVO
// ============================================================
//
// El endpoint recibe únicamente el nombre del archivo:
//
// archivo.pdf
//
// No permitimos:
//
// ../../archivo.pdf
// ../../../etc/passwd
// C:\Windows\...
// /etc/passwd
// nombres con separadores de ruta
// ============================================================

const obtenerNombreArchivoSeguro = (
  valor
) => {
  if (
    !valor ||
    typeof valor !== 'string'
  ) {
    return null;
  }

  const valorNormalizado =
    valor.trim();

  if (
    !valorNormalizado ||
    valorNormalizado.length >
      255
  ) {
    return null;
  }

  const nombre =
    path.basename(
      valorNormalizado
    );

  if (
    !nombre ||
    nombre === '.' ||
    nombre === '..'
  ) {
    return null;
  }

  if (
    nombre !==
    valorNormalizado
  ) {
    return null;
  }

  if (
    nombre.includes('/') ||
    nombre.includes('\\')
  ) {
    return null;
  }

  // Solo aceptamos las extensiones utilizadas por ArchiveX.
  const extension =
    path.extname(
      nombre
    ).toLowerCase();

  const extensionesPermitidas = [
    '.pdf',
    '.png',
    '.jpg',
    '.jpeg'
  ];

  if (
    !extensionesPermitidas.includes(
      extension
    )
  ) {
    return null;
  }

  return nombre;
};

// ============================================================
// CONSTRUIR RUTA FÍSICA PRIVADA
// ============================================================

const obtenerRutaFisicaPrivada = (
  nombreArchivo
) => {
  if (
    !nombreArchivo
  ) {
    return null;
  }

  const directorioPrivado =
    path.resolve(
      PRIVATE_DIR
    );

  const rutaArchivo =
    path.resolve(
      directorioPrivado,
      nombreArchivo
    );

  if (
    rutaArchivo ===
    directorioPrivado
  ) {
    return null;
  }

  if (
    !rutaArchivo.startsWith(
      `${directorioPrivado}${path.sep}`
    )
  ) {
    return null;
  }

  return rutaArchivo;
};

// ============================================================
// GENERAR VARIANTES DE URL PRIVADA
// ============================================================
//
// ArchiveX puede tener registros antiguos con o sin "/" inicial.
// ============================================================

const obtenerValoresUrlPrivada = (
  nombreArchivo
) => {
  return [
    `/uploads_private/${nombreArchivo}`,
    `uploads_private/${nombreArchivo}`
  ];
};

// ============================================================
// LOCALIZAR ARCHIVO EN BASE DE DATOS
// ============================================================
//
// Devuelve información suficiente para aplicar autorización.
//
// propietarioIds:
//   usuarios propietarios directos del recurso.
//
// evaluadorIds:
//   evaluadores que tienen asignado el recurso.
//
// propietarioEvaluacionIds:
//   evaluadores propietarios de una evaluación concreta.
//
// tipo:
//   identifica el tipo de recurso.
// ============================================================

const localizarArchivoEnBaseDeDatos =
  async (
    nombreArchivo
  ) => {
    const urlsPermitidas =
      obtenerValoresUrlPrivada(
        nombreArchivo
      );

    // --------------------------------------------------------
    // 1. SOLICITUDES
    // --------------------------------------------------------
    //
    // Propietario:
    //   solicitudes.usuario_id
    //
    // Evaluador autorizado:
    //   evaluador_id de una asignación de esa solicitud.
    // --------------------------------------------------------

    const [
      solicitudRows
    ] = await db.query(
      `
        SELECT
          s.id,
          s.usuario_id,
          ae.evaluador_id
        FROM solicitudes s
        LEFT JOIN asignacion_evaluaciones ae
          ON ae.solicitud_id = s.id
        WHERE
          s.presupuesto_url IN (?, ?)
          OR s.cronograma_url IN (?, ?)
          OR s.honestidad_url IN (?, ?)
          OR s.id_url IN (?, ?)
          OR s.doc_par_1 IN (?, ?)
          OR s.doc_par_2 IN (?, ?)
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

    if (
      solicitudRows.length >
      0
    ) {
      return {
        encontrado: true,
        tipo:
          'solicitud',

        propietarioIds:
          [
            ...new Set(
              solicitudRows
                .filter(
                  (row) =>
                    row.usuario_id !==
                    null
                )
                .map(
                  (row) =>
                    Number(
                      row.usuario_id
                    )
                )
            )
          ],

        evaluadorIds:
          [
            ...new Set(
              solicitudRows
                .filter(
                  (row) =>
                    row.evaluador_id !==
                    null
                )
                .map(
                  (row) =>
                    Number(
                      row.evaluador_id
                    )
                )
            )
          ]
      };
    }

    // --------------------------------------------------------
    // 2. DOCUMENTOS INDIVIDUALES DE SOLICITUD
    // --------------------------------------------------------

    const [
      documentoRows
    ] = await db.query(
      `
        SELECT
          ds.id,
          s.usuario_id,
          ae.evaluador_id
        FROM documentos_solicitud ds
        INNER JOIN solicitudes s
          ON s.id = ds.solicitud_id
        LEFT JOIN asignacion_evaluaciones ae
          ON ae.solicitud_id = s.id
        WHERE ds.archivo_url IN (?, ?)
      `,
      [
        urlsPermitidas[0],
        urlsPermitidas[1]
      ]
    );

    if (
      documentoRows.length >
      0
    ) {
      return {
        encontrado: true,
        tipo:
          'documento_solicitud',

        propietarioIds:
          [
            ...new Set(
              documentoRows
                .filter(
                  (row) =>
                    row.usuario_id !==
                    null
                )
                .map(
                  (row) =>
                    Number(
                      row.usuario_id
                    )
                )
            )
          ],

        evaluadorIds:
          [
            ...new Set(
              documentoRows
                .filter(
                  (row) =>
                    row.evaluador_id !==
                    null
                )
                .map(
                  (row) =>
                    Number(
                      row.evaluador_id
                    )
                )
            )
          ]
      };
    }

    // --------------------------------------------------------
    // 3. ARCHIVOS DE EVALUACIÓN
    // --------------------------------------------------------
    //
    // Solo:
    // - Admin
    // - Evaluador propietario de la evaluación
    // --------------------------------------------------------

    const [
      evaluacionRows
    ] = await db.query(
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

    if (
      evaluacionRows.length >
      0
    ) {
      return {
        encontrado: true,
        tipo:
          'evaluacion',

        propietarioIds: [],

        evaluadorIds:
          [
            ...new Set(
              evaluacionRows
                .map(
                  (row) =>
                    Number(
                      row.evaluador_id
                    )
                )
            )
          ]
      };
    }

    // --------------------------------------------------------
    // 4. ARCHIVOS DE NOTICIAS
    // --------------------------------------------------------
    //
    // Solo:
    // - Admin
    // - propietario de la noticia
    // --------------------------------------------------------

    const [
      noticiaRows
    ] = await db.query(
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

    if (
      noticiaRows.length >
      0
    ) {
      return {
        encontrado: true,
        tipo:
          'noticia',

        propietarioIds:
          [
            ...new Set(
              noticiaRows.map(
                (row) =>
                  Number(
                    row.usuario_id
                  )
              )
            )
          ],

        evaluadorIds: []
      };
    }

    // --------------------------------------------------------
    // 5. CERTIFICADO DE USUARIO
    // --------------------------------------------------------

    const [
      usuarioRows
    ] = await db.query(
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

    if (
      usuarioRows.length >
      0
    ) {
      return {
        encontrado: true,
        tipo:
          'usuario',

        propietarioIds:
          [
            ...new Set(
              usuarioRows.map(
                (row) =>
                  Number(
                    row.id
                  )
              )
            )
          ],

        evaluadorIds: []
      };
    }

    // --------------------------------------------------------
    // NO ENCONTRADO
    // --------------------------------------------------------

    return {
      encontrado: false,
      propietarioIds: [],
      evaluadorIds: [],
      tipo: null
    };
  };

// ============================================================
// DETERMINAR AUTORIZACIÓN
// ============================================================

const usuarioPuedeAcceder = (
  req,
  registro,
  usuarioId
) => {
  // ----------------------------------------------------------
  // ADMIN
  // ----------------------------------------------------------

  if (
    esAdminUser(req)
  ) {
    return true;
  }

  // ----------------------------------------------------------
  // PROPIETARIO
  // ----------------------------------------------------------

  if (
    registro.propietarioIds.includes(
      usuarioId
    )
  ) {
    return true;
  }

  // ----------------------------------------------------------
  // EVALUADOR
  // ----------------------------------------------------------
  //
  // Un evaluador solamente puede acceder a documentos de
  // solicitudes que tenga realmente asignadas.
  //
  // Para archivos de evaluación, igualmente debe ser el
  // evaluador propietario del archivo.
  // ----------------------------------------------------------

  if (
    esEvaluadorUser(req) &&
    registro.evaluadorIds.includes(
      usuarioId
    )
  ) {
    return true;
  }

  return false;
};

// ============================================================
// DETERMINAR MIME
// ============================================================

const obtenerContentType = (
  nombreArchivo
) => {
  const extension =
    path.extname(
      nombreArchivo
    ).toLowerCase();

  const mimeTypes = {
    '.pdf':
      'application/pdf',
    '.png':
      'image/png',
    '.jpg':
      'image/jpeg',
    '.jpeg':
      'image/jpeg'
  };

  return (
    mimeTypes[
      extension
    ] ||
    null
  );
};

// ============================================================
// DESCARGAR ARCHIVO PRIVADO
// ============================================================

const descargarArchivoPrivado =
  async (
    req,
    res
  ) => {
    try {
      // ------------------------------------------------------
      // 1. AUTENTICACIÓN
      // ------------------------------------------------------

      const usuarioId =
        obtenerUsuarioAutenticadoId(
          req
        );

      if (
        !usuarioId
      ) {
        return res.status(401).json({
          status:
            'error',
          message:
            'No autenticado.'
        });
      }

      // ------------------------------------------------------
      // 2. VALIDAR NOMBRE
      // ------------------------------------------------------

      const nombreArchivo =
        obtenerNombreArchivoSeguro(
          req.params.archivo
        );

      if (
        !nombreArchivo
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'Nombre de archivo no válido.'
        });
      }

      // ------------------------------------------------------
      // 3. LOCALIZAR EN BD
      // ------------------------------------------------------

      const registro =
        await localizarArchivoEnBaseDeDatos(
          nombreArchivo
        );

      if (
        !registro.encontrado
      ) {
        return res.status(404).json({
          status:
            'error',
          message:
            'Archivo no encontrado.'
        });
      }

      // ------------------------------------------------------
      // 4. AUTORIZACIÓN
      // ------------------------------------------------------

      if (
        !usuarioPuedeAcceder(
          req,
          registro,
          usuarioId
        )
      ) {
        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permisos para acceder a este archivo.'
        });
      }

      // ------------------------------------------------------
      // 5. RUTA FÍSICA SEGURA
      // ------------------------------------------------------

      const rutaArchivo =
        obtenerRutaFisicaPrivada(
          nombreArchivo
        );

      if (
        !rutaArchivo
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'Ruta de archivo no válida.'
        });
      }

      // ------------------------------------------------------
      // 6. COMPROBAR ARCHIVO
      // ------------------------------------------------------

      try {
        await fs.promises.access(
          rutaArchivo,
          fs.constants.R_OK
        );
      } catch {
        return res.status(404).json({
          status:
            'error',
          message:
            'Archivo no encontrado en el servidor.'
        });
      }

      // ------------------------------------------------------
      // 7. MIME
      // ------------------------------------------------------

      const contentType =
        obtenerContentType(
          nombreArchivo
        );

      if (
        !contentType
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'Tipo de archivo no permitido.'
        });
      }

      // ------------------------------------------------------
      // 8. CABECERAS
      // ------------------------------------------------------

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

      // Los documentos privados no deben quedar almacenados
      // en cachés compartidas.
      res.setHeader(
        'Cache-Control',
        'private, no-store, max-age=0'
      );

      res.setHeader(
        'Pragma',
        'no-cache'
      );

      // ------------------------------------------------------
      // 9. ENVÍO
      // ------------------------------------------------------

      return res.sendFile(
        rutaArchivo
      );
    } catch (error) {
      console.error(
        'Error descargando archivo privado:',
        error
      );

      return res.status(500).json({
        status:
          'error',
        message:
          'No fue posible acceder al archivo.'
      });
    }
  };

module.exports = {
  descargarArchivoPrivado
};