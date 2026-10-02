const Solicitud =
  require('../models/solicitudModel');

const Trazabilidad =
  require('../models/trazabilidadModel');

const {
  crearNotificacion
} =
  require('./settingsController');

const db =
  require('../config/db');

const fs =
  require('fs');

const path =
  require('path');

const {
  PRIVATE_DIR
} = require('../config/uploadPaths');

// ============================================================
// CONSTANTES
// ============================================================

const ESTADOS_VALIDOS = [
  'Borrador',
  'Radicado',
  'En Evaluación',
  'Correcciones solicitadas',
  'Aprobado',
  'Rechazado'
];

const TIPOS_DOCUMENTO_VALIDOS = [
  'Presupuesto',
  'Cronograma',
  'Honestidad',
  'Identidad',
  'Otros'
];

// ============================================================
// UTILIDADES
// ============================================================

const generarRadicadoRandom = (
  prefijo = 'SOL'
) => {
  const caracteres =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let resultado = '';

  for (let i = 0; i < 5; i++) {
    resultado += caracteres.charAt(
      Math.floor(
        Math.random() *
          caracteres.length
      )
    );
  }

  return `${prefijo}-${resultado}`;
};

// ============================================================
// OBTENER ROL
// ============================================================

const obtenerRol = (req) => {
  const rolRaw =
    req.user?.rol ||
    req.user?.role ||
    req.user?.id_rol ||
    req.user?.tipo ||
    req.user?.tipo_usuario;

  return String(
    rolRaw || ''
  )
    .trim()
    .toLowerCase();
};

// ============================================================
// COMPROBAR ADMIN
// ============================================================

const esAdminUser = (req) => {
  const rol =
    obtenerRol(req);

  return (
    rol === 'admin' ||
    rol === 'administrador' ||
    rol === '1'
  );
};

// ============================================================
// OBTENER ID AUTENTICADO
// ============================================================

const obtenerUsuarioAutenticadoId = (
  req
) => {
  return (
    req.user?.id ||
    req.user?.usuario_id ||
    req.user?.id_usuario ||
    req.user?.userId
  );
};

// ============================================================
// VALIDAR ID
// ============================================================

const obtenerIdNumerico = (
  valor
) => {
  const id =
    Number.parseInt(
      valor,
      10
    );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
};

// ============================================================
// NORMALIZAR TEXTO
// ============================================================

const normalizarTexto = (
  valor
) => {
  if (
    typeof valor !== 'string'
  ) {
    return null;
  }

  const texto =
    valor.trim();

  return texto || null;
};

// ============================================================
// RESOLVER SEDE POR NOMBRE
// ============================================================
//
// No hacemos fallback a una sede arbitraria.
//
// Si el nombre no existe, se devuelve null y el controller
// responderá con 400.
// ============================================================

const resolverSedePorNombre = async (
  nombreSede
) => {
  const nombre =
    normalizarTexto(
      nombreSede
    );

  if (!nombre) {
    return null;
  }

  const [
    rows
  ] = await db.query(
    `
      SELECT id
      FROM sedes
      WHERE nombre_sede = ?
      LIMIT 1
    `,
    [nombre]
  );

  if (
    !rows ||
    rows.length === 0
  ) {
    return null;
  }

  return rows[0].id;
};

// ============================================================
// VALIDAR EXISTENCIA DE REFERENCIAS
// ============================================================

const validarReferenciasSolicitud = async ({
  usuarioId,
  convocatoriaId,
  sedeId
}) => {
  // ----------------------------------------------------------
  // USUARIO
  // ----------------------------------------------------------

  const [
    usuarioRows
  ] = await db.query(
    `
      SELECT id
      FROM usuarios
      WHERE id = ?
      LIMIT 1
    `,
    [usuarioId]
  );

  if (
    usuarioRows.length === 0
  ) {
    return {
      valido: false,
      mensaje:
        'El usuario asociado a la solicitud no existe.'
    };
  }

  // ----------------------------------------------------------
  // CONVOCATORIA
  // ----------------------------------------------------------

  const [
    convocatoriaRows
  ] = await db.query(
    `
      SELECT id
      FROM convocatorias
      WHERE id = ?
      LIMIT 1
    `,
    [convocatoriaId]
  );

  if (
    convocatoriaRows.length === 0
  ) {
    return {
      valido: false,
      mensaje:
        'La convocatoria indicada no existe.'
    };
  }

  // ----------------------------------------------------------
  // SEDE
  // ----------------------------------------------------------

  const [
    sedeRows
  ] = await db.query(
    `
      SELECT id
      FROM sedes
      WHERE id = ?
      LIMIT 1
    `,
    [sedeId]
  );

  if (
    sedeRows.length === 0
  ) {
    return {
      valido: false,
      mensaje:
        'La sede indicada no existe.'
    };
  }

  return {
    valido: true
  };
};

// ============================================================
// OBTENER ARCHIVOS PRIVADOS DE UNA SOLICITUD
// ============================================================
//
// Se utilizan antes de eliminar o reemplazar documentos.
//
// Incluimos:
//
// - columnas principales de solicitudes;
// - documentos_solicitud;
// - actas de evaluación asociadas.
//
// Esto permite limpiar posteriormente archivos físicos
// privados que ya no deben existir.
// ============================================================

const obtenerArchivosPrivadosSolicitud = async (
  solicitudId
) => {
  const archivos = new Set();

  const [
    solicitudRows
  ] = await db.query(
    `
      SELECT
        presupuesto_url,
        cronograma_url,
        honestidad_url,
        id_url
      FROM solicitudes
      WHERE id = ?
      LIMIT 1
    `,
    [solicitudId]
  );

  if (
    solicitudRows.length > 0
  ) {
    const solicitud =
      solicitudRows[0];

    [
      solicitud.presupuesto_url,
      solicitud.cronograma_url,
      solicitud.honestidad_url,
      solicitud.id_url
    ].forEach(
      (archivo) => {
        if (archivo) {
          archivos.add(
            archivo
          );
        }
      }
    );
  }

  const [
    documentosRows
  ] = await db.query(
    `
      SELECT archivo_url
      FROM documentos_solicitud
      WHERE solicitud_id = ?
    `,
    [solicitudId]
  );

  for (
    const documento of documentosRows
  ) {
    if (
      documento.archivo_url
    ) {
      archivos.add(
        documento.archivo_url
      );
    }
  }

  const [
    evaluacionesRows
  ] = await db.query(
    `
      SELECT archivo_evaluacion
      FROM asignacion_evaluaciones
      WHERE solicitud_id = ?
    `,
    [solicitudId]
  );

  for (
    const evaluacion of evaluacionesRows
  ) {
    if (
      evaluacion.archivo_evaluacion
    ) {
      archivos.add(
        evaluacion.archivo_evaluacion
      );
    }
  }

  return [
    ...archivos
  ];
};

// ============================================================
// RESOLVER ARCHIVO PRIVADO DE FORMA SEGURA
// ============================================================

const obtenerRutaArchivoPrivado = (
  archivoUrl
) => {
  if (!archivoUrl) {
    return null;
  }

  const valorNormalizado =
    String(archivoUrl)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

  const nombreArchivo =
    path.basename(
      valorNormalizado
    );

  if (
    !nombreArchivo ||
    nombreArchivo === '.' ||
    nombreArchivo !==
      valorNormalizado
        .split('/')
        .pop()
  ) {
    return null;
  }

  const privateRoot =
    path.resolve(
      PRIVATE_DIR
    );

  const rutaArchivo =
    path.resolve(
      privateRoot,
      nombreArchivo
    );

  if (
    rutaArchivo !==
      privateRoot &&
    !rutaArchivo.startsWith(
      `${privateRoot}${path.sep}`
    )
  ) {
    return null;
  }

  return rutaArchivo;
};

// ============================================================
// ELIMINAR ARCHIVO PRIVADO
// ============================================================

const eliminarArchivoPrivado = async (
  archivoUrl
) => {
  const rutaArchivo =
    obtenerRutaArchivoPrivado(
      archivoUrl
    );

  if (!rutaArchivo) {
    return;
  }

  try {
    await fs.promises.unlink(
      rutaArchivo
    );
  } catch (error) {
    if (
      error.code !==
      'ENOENT'
    ) {
      console.error(
        'Error al eliminar archivo privado:',
        error
      );
    }
  }
};

// ============================================================
// ELIMINAR VARIOS ARCHIVOS PRIVADOS
// ============================================================

const eliminarArchivosPrivados = async (
  archivos
) => {
  if (
    !Array.isArray(
      archivos
    )
  ) {
    return;
  }

  await Promise.all(
    archivos.map(
      (archivo) =>
        eliminarArchivoPrivado(
          archivo
        )
    )
  );
};

// ============================================================
// OBTENER ARCHIVOS NUEVOS DE MULTER
// ============================================================

const obtenerArchivosCargados = (
  req
) => {
  const archivos = [];

  const campos = [
    {
      campo:
        'presupuesto',
      tipo:
        'Presupuesto'
    },
    {
      campo:
        'cronograma',
      tipo:
        'Cronograma'
    },
    {
      campo:
        'honestidad',
      tipo:
        'Honestidad'
    },
    {
      campo:
        'identidad',
      tipo:
        'Identidad'
    }
  ];

  for (
    const campo of campos
  ) {
    const archivosCampo =
      req.files?.[
        campo.campo
      ];

    if (
      archivosCampo &&
      archivosCampo[0]
    ) {
      archivos.push({
        file:
          archivosCampo[0],
        tipo:
          campo.tipo
      });
    }
  }

  return archivos;
};

// ============================================================
// OBTENER SOLICITUDES GENERALES
// ============================================================

const getSolicitudes = async (
  req,
  res
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status:
          'error',
        message:
          'No autenticado.'
      });
    }

    const logueadoId =
      obtenerUsuarioAutenticadoId(
        req
      );

    const esAdmin =
      esAdminUser(req);

    if (!logueadoId) {
      return res.status(401).json({
        status:
          'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    if (esAdmin) {
      const solicitudes =
        await Solicitud.getAll();

      return res.status(200).json({
        status:
          'success',
        data:
          solicitudes
      });
    }

    const query = `
      SELECT
        s.id,
        s.num_solicitud AS codigoPropuesta,
        s.titulo_propuesta,
        s.observaciones,
        s.estado,
        s.motivo_decision,
        s.presupuesto_url AS presupuesto,
        s.cronograma_url AS cronograma,
        s.honestidad_url AS honestidad,
        s.id_url AS id_documento,
        s.doc_par_1,
        s.doc_par_2,
        s.created_at AS fecha_radicacion,

        u.nombre_completo AS docente_nombre,

        c.titulo AS convocatoria,

        se.nombre_sede AS nombre_sede,
        se.id AS Sede

      FROM solicitudes s

      LEFT JOIN usuarios u
        ON s.usuario_id = u.id

      LEFT JOIN convocatorias c
        ON s.convocatoria_id = c.id

      LEFT JOIN sedes se
        ON s.sede_id = se.id

      WHERE s.usuario_id = ?

      ORDER BY s.created_at DESC
    `;

    const [
      solicitudes
    ] = await db.query(
      query,
      [logueadoId]
    );

    return res.status(200).json({
      status:
        'success',
      data:
        solicitudes
    });
  } catch (error) {
    console.error(
      'Error en getSolicitudes:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al obtener las solicitudes.'
    });
  }
};

// ============================================================
// OBTENER MIS SOLICITUDES
// ============================================================

const getMisSolicitudes = async (
  req,
  res
) => {
  try {
    const logueadoId =
      obtenerUsuarioAutenticadoId(
        req
      );

    if (!logueadoId) {
      return res.status(401).json({
        status:
          'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    const esAdmin =
      esAdminUser(req);

    let query;
    let queryParams = [];

    if (esAdmin) {
      query = `
        SELECT
          s.id,
          s.num_solicitud AS codigoPropuesta,
          s.titulo_propuesta,
          s.observaciones,
          s.estado,
          s.motivo_decision,
          s.presupuesto_url AS presupuesto,
          s.cronograma_url AS cronograma,
          s.honestidad_url AS honestidad,
          s.id_url AS id_documento,
          s.doc_par_1,
          s.doc_par_2,
          s.created_at AS fecha_radicacion,

          u.nombre_completo AS docente_nombre,
          u.email AS docente_correo,

          c.titulo AS convocatoria,

          se.nombre_sede AS nombre_sede,
          se.id AS Sede

        FROM solicitudes s

        LEFT JOIN usuarios u
          ON s.usuario_id = u.id

        LEFT JOIN convocatorias c
          ON s.convocatoria_id = c.id

        LEFT JOIN sedes se
          ON s.sede_id = se.id

        ORDER BY s.created_at DESC
      `;
    } else {
      query = `
        SELECT
          s.id,
          s.num_solicitud AS codigoPropuesta,
          s.titulo_propuesta,
          s.observaciones,
          s.estado,
          s.motivo_decision,
          s.presupuesto_url AS presupuesto,
          s.cronograma_url AS cronograma,
          s.honestidad_url AS honestidad,
          s.id_url AS id_documento,
          s.doc_par_1,
          s.doc_par_2,
          s.created_at AS fecha_radicacion,

          u.nombre_completo AS docente_nombre,
          u.email AS docente_correo,

          c.titulo AS convocatoria,

          se.nombre_sede AS nombre_sede,
          se.id AS Sede

        FROM solicitudes s

        LEFT JOIN usuarios u
          ON s.usuario_id = u.id

        LEFT JOIN convocatorias c
          ON s.convocatoria_id = c.id

        LEFT JOIN sedes se
          ON s.sede_id = se.id

        WHERE s.usuario_id = ?

        ORDER BY s.created_at DESC
      `;

      queryParams.push(
        logueadoId
      );
    }

    const [
      solicitudes
    ] = await db.query(
      query,
      queryParams
    );

    return res.status(200).json({
      status:
        'success',
      data:
        solicitudes
    });
  } catch (error) {
    console.error(
      'Error en getMisSolicitudes:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al obtener tus solicitudes.'
    });
  }
};

// ============================================================
// OBTENER SOLICITUD POR ID
// ============================================================

const getSolicitudById = async (
  req,
  res
) => {
  try {
    const id =
      obtenerIdNumerico(
        req.params.id
      );

    if (!id) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El identificador de la solicitud no es válido.'
      });
    }

    const logueadoId =
      obtenerUsuarioAutenticadoId(
        req
      );

    if (!logueadoId) {
      return res.status(401).json({
        status:
          'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    const solicitud =
      await Solicitud.getById(id);

    if (!solicitud) {
      return res.status(404).json({
        status:
          'error',
        message:
          'Solicitud no encontrada.'
      });
    }

    const esAdmin =
      esAdminUser(req);

    const esDuenio =
      String(
        solicitud.usuario_id
      ) ===
      String(
        logueadoId
      );

    if (
      !esAdmin &&
      !esDuenio
    ) {
      return res.status(403).json({
        status:
          'error',
        message:
          'Acceso denegado: no tienes permiso para ver esta solicitud.'
      });
    }

    return res.status(200).json({
      status:
        'success',
      data:
        solicitud
    });
  } catch (error) {
    console.error(
      'Error en getSolicitudById:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al obtener la solicitud.'
    });
  }
};

const getSolicitudTimeline = async (req, res) => {
  try {
    const id = obtenerIdNumerico(req.params.id);
    const usuarioId = obtenerUsuarioAutenticadoId(req);
    if (!id || !usuarioId) {
      return res.status(400).json({ status: 'error', message: 'La solicitud o usuario no es válido.' });
    }

    const [solicitudes] = await db.query(
      `SELECT s.usuario_id, s.estado FROM solicitudes s WHERE s.id = ? LIMIT 1`,
      [id]
    );
    const solicitud = solicitudes[0];
    if (!solicitud) return res.status(404).json({ status: 'error', message: 'Solicitud no encontrada.' });

    const esDuenio = String(solicitud.usuario_id) === String(usuarioId);
    const esEvaluador = obtenerRol(req) === 'evaluador';
    let evaluadorAsignado = false;
    if (esEvaluador) {
      const [assignments] = await db.query(
        `SELECT id FROM asignacion_evaluaciones WHERE solicitud_id = ? AND evaluador_id = ? LIMIT 1`,
        [id, usuarioId]
      );
      evaluadorAsignado = assignments.length > 0;
    }
    if (!esDuenio && !esAdminUser(req) && !evaluadorAsignado) {
      return res.status(403).json({ status: 'error', message: 'No tienes permiso para ver esta cronología.' });
    }

    const [timeline] = await db.query(
      `SELECT t.id, t.estado_anterior, t.estado_nuevo, t.motivo_cambio,
              t.fecha_cambio, u.nombre_completo AS responsable
       FROM trazabilidad_solicitudes t
       LEFT JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.solicitud_id = ? ORDER BY t.fecha_cambio ASC, t.id ASC`,
      [id]
    );
    const [documents] = await db.query(
      `SELECT id, nombre_archivo, tipo_documento, archivo_url, review_status,
              review_comment, reviewed_at, version_no, replaced_by, created_at
       FROM documentos_solicitud WHERE solicitud_id = ?
       ORDER BY tipo_documento, version_no DESC`,
      [id]
    );
    const [comments] = await db.query(
      `SELECT dc.id, dc.documento_id, dc.comentario, dc.created_at,
              u.nombre_completo AS autor
       FROM document_comments dc
       LEFT JOIN usuarios u ON u.id = dc.usuario_id
       INNER JOIN documentos_solicitud d ON d.id = dc.documento_id
       WHERE d.solicitud_id = ? ORDER BY dc.created_at ASC, dc.id ASC`,
      [id]
    );

    return res.json({ status: 'success', data: { estado: solicitud.estado, timeline, documents, comments } });
  } catch (error) {
    console.error('Error consultando cronología de solicitud:', error.code || 'error interno');
    return res.status(500).json({ status: 'error', message: 'No fue posible cargar la cronología.' });
  }
};

const commentDocument = async (req, res) => {
  const solicitudId = obtenerIdNumerico(req.params.id);
  const documentId = obtenerIdNumerico(req.params.docId);
  const comment = normalizarTexto(req.body?.comment);
  const usuarioId = obtenerUsuarioAutenticadoId(req);
  if (!solicitudId || !documentId || !usuarioId || !comment || comment.length > 5000) {
    return res.status(400).json({ status: 'error', message: 'El comentario debe tener entre 1 y 5000 caracteres.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT d.id, s.usuario_id, s.titulo_propuesta
       FROM documentos_solicitud d
       INNER JOIN solicitudes s ON s.id = d.solicitud_id
       INNER JOIN asignacion_evaluaciones ae ON ae.solicitud_id = s.id
       WHERE d.id = ? AND d.solicitud_id = ? AND ae.evaluador_id = ?
       LIMIT 1`,
      [documentId, solicitudId, usuarioId]
    );
    const document = rows[0];
    if (!document) return res.status(403).json({ status: 'error', message: 'No tienes una asignación para comentar este documento.' });

    const [result] = await db.query(
      'INSERT INTO document_comments (documento_id, usuario_id, comentario) VALUES (?, ?, ?)',
      [documentId, usuarioId, comment]
    );
    await crearNotificacion({
      usuarioId: document.usuario_id,
      type: 'comment',
      title: 'Nuevo comentario sobre un documento',
      body: `La evaluación de "${document.titulo_propuesta}" incluye un comentario: ${comment}`,
      link: '/mis-solicitudes',
      eventKey: `document-comment:${result.insertId}`
    });
    return res.status(201).json({ status: 'success', message: 'Comentario guardado.' });
  } catch (error) {
    console.error('Error guardando comentario de documento:', error.code || 'error interno');
    return res.status(500).json({ status: 'error', message: 'No fue posible guardar el comentario.' });
  }
};

const reviewDocument = async (req, res) => {
  const solicitudId = obtenerIdNumerico(req.params.id);
  const documentId = obtenerIdNumerico(req.params.docId);
  const status = String(req.body?.status || '');
  const comment = normalizarTexto(req.body?.comment);

  if (!solicitudId || !documentId || !['validated', 'rejected'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Los datos de revisión no son válidos.' });
  }
  if (comment && comment.length > 5000) {
    return res.status(400).json({ status: 'error', message: 'El comentario supera el límite permitido.' });
  }
  if (status === 'rejected' && !comment) {
    return res.status(400).json({ status: 'error', message: 'Escribe el motivo de la corrección solicitada.' });
  }

  try {
    const [documents] = await db.query(
      `SELECT d.id, d.solicitud_id, d.review_status, s.usuario_id, s.titulo_propuesta
       FROM documentos_solicitud d INNER JOIN solicitudes s ON s.id = d.solicitud_id
       WHERE d.id = ? AND d.solicitud_id = ? LIMIT 1`,
      [documentId, solicitudId]
    );
    const document = documents[0];
    if (!document) return res.status(404).json({ status: 'error', message: 'No se encontró el documento.' });
    if (document.review_status === 'replaced') {
      return res.status(409).json({ status: 'error', message: 'No se puede revisar una versión reemplazada.' });
    }

    await db.query(
      `UPDATE documentos_solicitud SET review_status = ?, review_comment = ?,
       reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, comment, obtenerUsuarioAutenticadoId(req), documentId]
    );

    if (status === 'rejected') {
      const [rows] = await db.query('SELECT estado FROM solicitudes WHERE id = ? LIMIT 1', [solicitudId]);
      const previousState = rows[0]?.estado;
      await db.query(
        `UPDATE solicitudes SET estado = 'Correcciones solicitadas', motivo_decision = ? WHERE id = ?`,
        [comment || 'Un documento requiere correcciones.', solicitudId]
      );
      await Trazabilidad.registrarCambio({
        solicitud_id: solicitudId,
        usuario_id: obtenerUsuarioAutenticadoId(req),
        estado_anterior: previousState,
        estado_nuevo: 'Correcciones solicitadas',
        motivo_cambio: comment || 'Un documento requiere correcciones.'
      });
    }

    await crearNotificacion({
      usuarioId: document.usuario_id,
      type: 'comment',
      title: status === 'rejected' ? 'Documento requiere correcciones' : 'Documento validado',
      body: `${document.titulo_propuesta}: ${comment || (status === 'rejected' ? 'Se requiere revisar este documento.' : 'El documento fue validado.')}`,
      link: '/mis-solicitudes',
      eventKey: `document:${documentId}:${status}:${Date.now()}`
    });

    return res.json({ status: 'success', message: 'Revisión del documento guardada.' });
  } catch (error) {
    console.error('Error revisando documento:', error.code || 'error interno');
    return res.status(500).json({ status: 'error', message: 'No fue posible guardar la revisión.' });
  }
};

// ============================================================
// CREAR SOLICITUD
// ============================================================

const createSolicitud = async (
  req,
  res
) => {
  const archivosNuevos =
    obtenerArchivosCargados(
      req
    );

  try {
    const esAdmin =
      esAdminUser(req);

    let usuario_id =
      obtenerUsuarioAutenticadoId(
        req
      );

    if (!usuario_id) {
      return res.status(401).json({
        status:
          'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    // --------------------------------------------------------
    // ADMIN PUEDE CREAR PARA OTRO USUARIO
    // --------------------------------------------------------

    if (
      esAdmin &&
      req.body.usuario_id !==
        undefined &&
      req.body.usuario_id !==
        null &&
      String(
        req.body.usuario_id
      ).trim() !== ''
    ) {
      usuario_id =
        obtenerIdNumerico(
          req.body.usuario_id
        );

      if (!usuario_id) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El identificador del usuario no es válido.'
        });
      }
    }

    let {
      convocatoria_id,
      sede_id,
      num_solicitud,
      titulo_propuesta,
      observaciones,
      sede_vinculacion
    } = req.body;

    // --------------------------------------------------------
    // NORMALIZAR IDS
    // --------------------------------------------------------

    convocatoria_id =
      obtenerIdNumerico(
        convocatoria_id
      );

    if (
      !sede_id &&
      sede_vinculacion
    ) {
      sede_id =
        await resolverSedePorNombre(
          sede_vinculacion
        );

      if (!sede_id) {
        return res.status(400).json({
          status:
            'error',
          message:
            'La sede indicada no existe.'
        });
      }
    } else {
      sede_id =
        obtenerIdNumerico(
          sede_id
        );
    }

    // --------------------------------------------------------
    // CAMPOS OBLIGATORIOS
    // --------------------------------------------------------

    const tituloFinal =
      normalizarTexto(
        titulo_propuesta
      );

    if (
      !usuario_id ||
      !convocatoria_id ||
      !sede_id ||
      !tituloFinal
    ) {
      return res.status(400).json({
        status:
          'error',
        message:
          'Los campos usuario, convocatoria, sede y título son obligatorios.'
      });
    }

    // --------------------------------------------------------
    // REFERENCIAS
    // --------------------------------------------------------

    const referencias =
      await validarReferenciasSolicitud({
        usuarioId:
          usuario_id,
        convocatoriaId:
          convocatoria_id,
        sedeId:
          sede_id
      });

    if (
      !referencias.valido
    ) {
      return res.status(400).json({
        status:
          'error',
        message:
          referencias.mensaje
      });
    }

    // --------------------------------------------------------
    // TÍTULO
    // --------------------------------------------------------

    if (
      tituloFinal.length >
      255
    ) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El título de la propuesta no puede superar los 255 caracteres.'
      });
    }

    // --------------------------------------------------------
    // RADICADO
    // --------------------------------------------------------

    if (
      !num_solicitud ||
      String(
        num_solicitud
      ).trim() === ''
    ) {
      num_solicitud =
        generarRadicadoRandom();
    } else {
      num_solicitud =
        String(
          num_solicitud
        )
          .trim()
          .toUpperCase();

      if (
        num_solicitud.length >
        50
      ) {
        return res.status(400).json({
          status:
            'error',
          message:
            'El número de solicitud no puede superar los 50 caracteres.'
        });
      }
    }

    // --------------------------------------------------------
    // OBSERVACIONES
    // --------------------------------------------------------

    const observacionesFinal =
      normalizarTexto(
        observaciones
      );

    // --------------------------------------------------------
    // ESTADO INICIAL
    // --------------------------------------------------------
    //
    // Nunca tomamos estado desde req.body.
    // --------------------------------------------------------

    const estadoInicial =
      'Borrador';

    // --------------------------------------------------------
    // DOCUMENTOS
    // --------------------------------------------------------

    const urlPresupuesto =
      req.files?.presupuesto?.[0]
        ? `/uploads_private/${req.files.presupuesto[0].filename}`
        : null;

    const urlCronograma =
      req.files?.cronograma?.[0]
        ? `/uploads_private/${req.files.cronograma[0].filename}`
        : null;

    const urlHonestidad =
      req.files?.honestidad?.[0]
        ? `/uploads_private/${req.files.honestidad[0].filename}`
        : null;

    const urlIdentidad =
      req.files?.identidad?.[0]
        ? `/uploads_private/${req.files.identidad[0].filename}`
        : null;

    // --------------------------------------------------------
    // CREAR SOLICITUD
    // --------------------------------------------------------

    const newId =
      await Solicitud.create({
        usuario_id,
        convocatoria_id,
        sede_id,
        num_solicitud,
        titulo_propuesta:
          tituloFinal,
        observaciones:
          observacionesFinal,
        estado:
          estadoInicial,
        presupuesto_url:
          urlPresupuesto,
        cronograma_url:
          urlCronograma,
        honestidad_url:
          urlHonestidad,
        id_url:
          urlIdentidad
      });

    // --------------------------------------------------------
    // INDEXAR DOCUMENTOS
    // --------------------------------------------------------

    if (
      archivosNuevos.length >
      0
    ) {
      const queryDoc = `
        INSERT INTO documentos_solicitud
        (
          solicitud_id,
          nombre_archivo,
          tipo_documento,
          archivo_url
        )
        VALUES (?, ?, ?, ?)
      `;

      for (
        const item of archivosNuevos
      ) {
        const file =
          item.file;

        await db.query(
          queryDoc,
          [
            newId,
            file.originalname,
            item.tipo,
            `/uploads_private/${file.filename}`
          ]
        );
      }
    }

    // --------------------------------------------------------
    // TRAZABILIDAD
    // --------------------------------------------------------

    await Trazabilidad.registrarCambio({
      solicitud_id:
        newId,
      usuario_id,
      estado_anterior:
        null,
      estado_nuevo:
        estadoInicial,
      motivo_cambio:
        'Creación inicial de la solicitud con carga de documentos indexados.'
    });

    return res.status(201).json({
      status:
        'success',
      message:
        'Solicitud y documentos creados exitosamente.',
      data: {
        id:
          newId,
        num_solicitud
      }
    });
  } catch (error) {
    // --------------------------------------------------------
    // LIMPIAR ARCHIVOS SI FALLÓ EL PROCESAMIENTO
    // --------------------------------------------------------

    await eliminarArchivosPrivados(
      archivosNuevos.map(
        (item) =>
          `/uploads_private/${item.file.filename}`
      )
    );

    console.error(
      'Error en createSolicitud:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al crear la solicitud.'
    });
  }
};

// ============================================================
// ACTUALIZAR SOLICITUD
// ============================================================

const updateSolicitud = async (
  req,
  res
) => {
  const archivosNuevos =
    obtenerArchivosCargados(
      req
    );

  try {
    const id =
      obtenerIdNumerico(
        req.params.id
      );

    if (!id) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(400).json({
        status:
          'error',
        message:
          'El identificador de la solicitud no es válido.'
      });
    }

    const logueadoId =
      obtenerUsuarioAutenticadoId(
        req
      );

    if (!logueadoId) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(401).json({
        status:
          'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    const esAdmin =
      esAdminUser(req);

    const solicitudPrevia =
      await Solicitud.getById(
        id
      );

    if (!solicitudPrevia) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(404).json({
        status:
          'error',
        message:
          'Solicitud no encontrada para actualizar.'
      });
    }

    const esDuenio =
      String(
        solicitudPrevia.usuario_id
      ) ===
      String(
        logueadoId
      );

    // --------------------------------------------------------
    // OWNERSHIP
    // --------------------------------------------------------

    if (
      !esAdmin &&
      !esDuenio
    ) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(403).json({
        status:
          'error',
        message:
          'Acceso denegado: no puedes modificar una propuesta ajena.'
      });
    }

    // --------------------------------------------------------
    // USUARIO
    // --------------------------------------------------------

    let usuario_id =
      solicitudPrevia.usuario_id;

    if (
      esAdmin &&
      req.body.usuario_id !==
        undefined &&
      req.body.usuario_id !==
        null &&
      String(
        req.body.usuario_id
      ).trim() !== ''
    ) {
      usuario_id =
        obtenerIdNumerico(
          req.body.usuario_id
        );

      if (!usuario_id) {
        await eliminarArchivosPrivados(
          archivosNuevos.map(
            (item) =>
              `/uploads_private/${item.file.filename}`
          )
        );

        return res.status(400).json({
          status:
            'error',
          message:
            'El identificador del usuario no es válido.'
        });
      }
    }

    // --------------------------------------------------------
    // DATOS PRINCIPALES
    // --------------------------------------------------------

    let {
      convocatoria_id,
      sede_id,
      num_solicitud,
      titulo_propuesta,
      observaciones,
      estado,
      motivo_decision,
      motivo_cambio,
      sede_vinculacion
    } = req.body;

    convocatoria_id =
      convocatoria_id !==
        undefined &&
      convocatoria_id !==
        null &&
      String(
        convocatoria_id
      ).trim() !== ''
        ? obtenerIdNumerico(
            convocatoria_id
          )
        : solicitudPrevia.convocatoria_id;

    // --------------------------------------------------------
    // SEDE
    // --------------------------------------------------------

    if (
      !sede_id &&
      sede_vinculacion
    ) {
      sede_id =
        await resolverSedePorNombre(
          sede_vinculacion
        );

      if (!sede_id) {
        await eliminarArchivosPrivados(
          archivosNuevos.map(
            (item) =>
              `/uploads_private/${item.file.filename}`
          )
        );

        return res.status(400).json({
          status:
            'error',
          message:
            'La sede indicada no existe.'
        });
      }
    } else if (
      sede_id !==
        undefined &&
      sede_id !==
        null &&
      String(
        sede_id
      ).trim() !== ''
    ) {
      sede_id =
        obtenerIdNumerico(
          sede_id
        );
    } else {
      sede_id =
        solicitudPrevia.sede_id ||
        solicitudPrevia.Sede;
    }

    // --------------------------------------------------------
    // VALIDAR REFERENCIAS
    // --------------------------------------------------------

    if (
      !usuario_id ||
      !convocatoria_id ||
      !sede_id
    ) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(400).json({
        status:
          'error',
        message:
          'Los datos de usuario, convocatoria y sede no son válidos.'
      });
    }

    const referencias =
      await validarReferenciasSolicitud({
        usuarioId:
          usuario_id,
        convocatoriaId:
          convocatoria_id,
        sedeId:
          sede_id
      });

    if (
      !referencias.valido
    ) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(400).json({
        status:
          'error',
        message:
          referencias.mensaje
      });
    }

    // --------------------------------------------------------
    // TÍTULO
    // --------------------------------------------------------

    titulo_propuesta =
      normalizarTexto(
        titulo_propuesta
      );

    if (
      !titulo_propuesta
    ) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(400).json({
        status:
          'error',
        message:
          'El título de la propuesta es obligatorio.'
      });
    }

    if (
      titulo_propuesta.length >
      255
    ) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(400).json({
        status:
          'error',
        message:
          'El título de la propuesta no puede superar los 255 caracteres.'
      });
    }

    // --------------------------------------------------------
    // RADICADO
    // --------------------------------------------------------

    if (
      !num_solicitud ||
      String(
        num_solicitud
      ).trim() === ''
    ) {
      num_solicitud =
        solicitudPrevia.codigoPropuesta ||
        solicitudPrevia.num_solicitud;
    } else {
      num_solicitud =
        String(
          num_solicitud
        )
          .trim()
          .toUpperCase();

      if (
        num_solicitud.length >
        50
      ) {
        await eliminarArchivosPrivados(
          archivosNuevos.map(
            (item) =>
              `/uploads_private/${item.file.filename}`
          )
        );

        return res.status(400).json({
          status:
            'error',
          message:
            'El número de solicitud no puede superar los 50 caracteres.'
        });
      }
    }

    // --------------------------------------------------------
    // OBSERVACIONES
    // --------------------------------------------------------

    observaciones =
      normalizarTexto(
        observaciones
      );

    // Si el frontend no envía observaciones, conservamos las
    // existentes.
    if (
      observaciones ===
        null &&
      req.body.observaciones ===
        undefined
    ) {
      observaciones =
        solicitudPrevia.observaciones;
    }

    // --------------------------------------------------------
    // ESTADO
    // --------------------------------------------------------

    const estadoAnterior =
      solicitudPrevia.estado;

    if (!esAdmin) {
      const estadoSolicitado =
        normalizarTexto(
          estado
        );

      if (
        estadoSolicitado &&
        estadoSolicitado !==
          estadoAnterior
      ) {
        await eliminarArchivosPrivados(
          archivosNuevos.map(
            (item) =>
              `/uploads_private/${item.file.filename}`
          )
        );

        return res.status(403).json({
          status:
            'error',
          message:
            'No tienes permisos para cambiar el estado administrativo de la solicitud.'
        });
      }

      estado =
        estadoAnterior;

      motivo_decision =
        solicitudPrevia.motivo_decision;

      motivo_cambio =
        null;
    } else {
      estado =
        normalizarTexto(
          estado
        ) ||
        estadoAnterior;
    }

    if (
      !ESTADOS_VALIDOS.includes(
        estado
      )
    ) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(400).json({
        status:
          'error',
        message:
          'El estado proporcionado no es válido.'
      });
    }

    // --------------------------------------------------------
    // MOTIVO DE DECISIÓN
    // --------------------------------------------------------

    if (!['Rechazado', 'Correcciones solicitadas'].includes(estado)) {
      motivo_decision =
        null;
    } else {
      motivo_decision =
        normalizarTexto(
          motivo_decision
        );

      if (
        motivo_decision &&
        motivo_decision.length >
          5000
      ) {
        await eliminarArchivosPrivados(
          archivosNuevos.map(
            (item) =>
              `/uploads_private/${item.file.filename}`
          )
        );

        return res.status(400).json({
          status:
            'error',
          message:
            'El motivo de decisión no puede superar los 5000 caracteres.'
        });
      }

      if (estado === 'Correcciones solicitadas' && !motivo_decision) {
        return res.status(400).json({
          status: 'error',
          message: 'Indica qué correcciones debe realizar el propietario.'
        });
      }
    }

    // --------------------------------------------------------
    // DOCUMENTOS ACTUALES
    // --------------------------------------------------------

    const urlPresupuesto =
      req.files?.presupuesto?.[0]
        ? `/uploads_private/${req.files.presupuesto[0].filename}`
        : solicitudPrevia.presupuesto_url ||
          solicitudPrevia.presupuesto ||
          null;

    const urlCronograma =
      req.files?.cronograma?.[0]
        ? `/uploads_private/${req.files.cronograma[0].filename}`
        : solicitudPrevia.cronograma_url ||
          solicitudPrevia.cronograma ||
          null;

    const urlHonestidad =
      req.files?.honestidad?.[0]
        ? `/uploads_private/${req.files.honestidad[0].filename}`
        : solicitudPrevia.honestidad_url ||
          solicitudPrevia.honestidad ||
          null;

    const urlIdentidad =
      req.files?.identidad?.[0]
        ? `/uploads_private/${req.files.identidad[0].filename}`
        : solicitudPrevia.id_url ||
          solicitudPrevia.id_documento ||
          null;

    // --------------------------------------------------------
    // ACTUALIZAR SOLICITUD
    // --------------------------------------------------------

    const affectedRows =
      await Solicitud.update(
        id,
        {
          usuario_id,
          convocatoria_id,
          sede_id,
          num_solicitud,
          titulo_propuesta,
          observaciones,
          estado,
          motivo_decision,
          doc_par_1:
            solicitudPrevia.doc_par_1,
          doc_par_2:
            solicitudPrevia.doc_par_2,
          presupuesto_url:
            urlPresupuesto,
          cronograma_url:
            urlCronograma,
          honestidad_url:
            urlHonestidad,
          id_url:
            urlIdentidad
        }
      );

    if (
      affectedRows === 0
    ) {
      await eliminarArchivosPrivados(
        archivosNuevos.map(
          (item) =>
            `/uploads_private/${item.file.filename}`
        )
      );

      return res.status(404).json({
        status:
          'error',
        message:
          'No fue posible actualizar la solicitud.'
      });
    }

    // --------------------------------------------------------
    // INDEXAR DOCUMENTOS NUEVOS
    // --------------------------------------------------------

    if (
      archivosNuevos.length >
      0
    ) {
      const queryDoc = `
        INSERT INTO documentos_solicitud
        (
          solicitud_id,
          nombre_archivo,
          tipo_documento,
          archivo_url,
          version_no
        )
        VALUES (?, ?, ?, ?, ?)
      `;

      for (
        const item of archivosNuevos
      ) {
        if (
          !TIPOS_DOCUMENTO_VALIDOS.includes(
            item.tipo
          )
        ) {
          continue;
        }

        const file = item.file;
        const [versionRows] = await db.query(
          `SELECT id, version_no FROM documentos_solicitud
           WHERE solicitud_id = ? AND tipo_documento = ? AND review_status <> 'replaced'
           ORDER BY version_no DESC LIMIT 1`,
          [id, item.tipo]
        );
        let previousDocument = versionRows[0];
        if (!previousDocument) {
          const legacyPaths = {
            Presupuesto: solicitudPrevia.presupuesto_url || solicitudPrevia.presupuesto,
            Cronograma: solicitudPrevia.cronograma_url || solicitudPrevia.cronograma,
            Honestidad: solicitudPrevia.honestidad_url || solicitudPrevia.honestidad,
            Identidad: solicitudPrevia.id_url || solicitudPrevia.id_documento
          };
          const legacyPath = legacyPaths[item.tipo];
          if (legacyPath) {
            const [legacyResult] = await db.query(
              `INSERT INTO documentos_solicitud
               (solicitud_id, nombre_archivo, tipo_documento, archivo_url, review_status, version_no)
               VALUES (?, ?, ?, ?, 'replaced', 1)`,
              [id, String(legacyPath).split('/').pop(), item.tipo, legacyPath]
            );
            previousDocument = { id: legacyResult.insertId, version_no: 1 };
          }
        }
        const versionNo = Number(previousDocument?.version_no || 0) + 1;
        const [insertResult] = await db.query(
          queryDoc,
          [
            id,
            file.originalname,
            item.tipo,
            `/uploads_private/${file.filename}`,
            versionNo
          ]
        );
        if (previousDocument) {
          await db.query(
            `UPDATE documentos_solicitud
             SET review_status = 'replaced', replaced_by = ? WHERE id = ?`,
            [insertResult.insertId, previousDocument.id]
          );
        }
      }
    }

    // --------------------------------------------------------
    // TRAZABILIDAD
    // --------------------------------------------------------

    if (
      esAdmin &&
      String(
        estadoAnterior
      ) !==
        String(
          estado
        )
    ) {
      await Trazabilidad.registrarCambio({
        solicitud_id:
          id,
        usuario_id:
          logueadoId,
        estado_anterior:
          estadoAnterior,
        estado_nuevo:
          estado,
        motivo_cambio:
          motivo_cambio ||
          'Actualización administrativa del estado de la solicitud.'
      });

      await crearNotificacion({
        usuarioId: solicitudPrevia.usuario_id,
        type: 'comment',
        title: 'Tu solicitud cambió de estado',
        body: `La solicitud "${solicitudPrevia.titulo_propuesta}" ahora está: ${estado}.`,
        link: '/mis-solicitudes',
        eventKey: `solicitud:${id}:estado:${estado}:${Date.now()}`
      });
    }

    return res.status(200).json({
      status:
        'success',
      message:
        'Solicitud actualizada correctamente.'
    });
  } catch (error) {
    // --------------------------------------------------------
    // SI FALLA EL PROCESAMIENTO, BORRAR SOLO LOS ARCHIVOS NUEVOS
    // --------------------------------------------------------

    await eliminarArchivosPrivados(
      archivosNuevos.map(
        (item) =>
          `/uploads_private/${item.file.filename}`
      )
    );

    console.error(
      'Error en updateSolicitud:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al actualizar la solicitud.'
    });
  }
};

// ============================================================
// ELIMINAR SOLICITUD
// ============================================================

const deleteSolicitud = async (
  req,
  res
) => {
  try {
    const id =
      obtenerIdNumerico(
        req.params.id
      );

    if (!id) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El identificador de la solicitud no es válido.'
      });
    }

    const logueadoId =
      obtenerUsuarioAutenticadoId(
        req
      );

    if (!logueadoId) {
      return res.status(401).json({
        status:
          'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    const esAdmin =
      esAdminUser(req);

    const solicitudPrevia =
      await Solicitud.getById(
        id
      );

    if (!solicitudPrevia) {
      return res.status(404).json({
        status:
          'error',
        message:
          'Solicitud no encontrada para eliminar.'
      });
    }

    const esDuenio =
      String(
        solicitudPrevia.usuario_id
      ) ===
      String(
        logueadoId
      );

    if (
      !esAdmin &&
      !esDuenio
    ) {
      return res.status(403).json({
        status:
          'error',
        message:
          'Acceso denegado: no tienes permisos para eliminar esta solicitud.'
      });
    }

    // --------------------------------------------------------
    // GUARDAR REFERENCIAS DE ARCHIVOS
    // --------------------------------------------------------

    const archivosPrivados =
      await obtenerArchivosPrivadosSolicitud(
        id
      );

    // --------------------------------------------------------
    // ELIMINAR REGISTRO
    // --------------------------------------------------------
    //
    // documentos_solicitud y asignacion_evaluaciones se eliminan
    // mediante las restricciones ON DELETE CASCADE de la BD.
    // --------------------------------------------------------

    const affectedRows =
      await Solicitud.delete(
        id
      );

    if (
      affectedRows === 0
    ) {
      return res.status(404).json({
        status:
          'error',
        message:
          'La solicitud no pudo ser eliminada.'
      });
    }

    // --------------------------------------------------------
    // LIMPIAR ARCHIVOS FÍSICOS
    // --------------------------------------------------------

    await eliminarArchivosPrivados(
      archivosPrivados
    );

    return res.status(200).json({
      status:
        'success',
      message:
        'Solicitud eliminada correctamente.'
    });
  } catch (error) {
    console.error(
      'Error en deleteSolicitud:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al eliminar la solicitud.'
    });
  }
};

module.exports = {
  getSolicitudes,
  getMisSolicitudes,
  getSolicitudById,
  getSolicitudTimeline,
  reviewDocument,
  commentDocument,
  createSolicitud,
  updateSolicitud,
  deleteSolicitud
};
