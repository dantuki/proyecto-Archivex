const Solicitud = require('../models/solicitudModel');
const db = require('../config/db');

// ============================================================
// UTILIDADES
// ============================================================

const obtenerUsuarioAutenticadoId = (req) => {
  return (
    req.user?.id ||
    req.user?.usuario_id ||
    req.user?.id_usuario ||
    req.user?.userId
  );
};

const obtenerRol = (req) => {
  const rolRaw =
    req.user?.rol ||
    req.user?.role ||
    req.user?.id_rol ||
    req.user?.tipo ||
    req.user?.tipo_usuario;

  return String(rolRaw || '').trim().toLowerCase();
};

const esAdminUser = (req) => {
  const rol = obtenerRol(req);

  return (
    rol === 'admin' ||
    rol === 'administrador' ||
    rol === '1'
  );
};

// ============================================================
// 1. RADICAR PROPUESTA DE INVESTIGACIÓN
// ============================================================
//
// La identidad del usuario sale del JWT.
// No confiamos en un usuario enviado por el frontend.
//
// Los archivos ya son procesados por:
// Multer → validación MIME → validación de magic bytes
//
// El controller únicamente utiliza los archivos que ya fueron
// aceptados por el middleware.
// ============================================================

const createPostulacion = async (req, res) => {
  try {
    const {
      codigoPropuesta,
      titulo_propuesta,
      sede,
      convocatoriaId,
      observaciones
    } = req.body;

    const usuarioId =
      obtenerUsuarioAutenticadoId(req);

    const archivos = req.files;

    if (!usuarioId) {
      return res.status(401).json({
        status: 'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    // ========================================================
    // ARCHIVOS OBLIGATORIOS
    // ========================================================

    if (
      !archivos ||
      !archivos.presupuesto ||
      !archivos.cronograma ||
      !archivos.honestidad ||
      !archivos.identidad
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Los 4 archivos PDF (Presupuesto, Cronograma, Declaración de Honestidad y Documento de Identidad) son obligatorios.'
      });
    }

    const presupuesto = archivos.presupuesto[0];
    const cronograma = archivos.cronograma[0];
    const honestidad = archivos.honestidad[0];
    const identidad = archivos.identidad[0];

    if (
      !presupuesto ||
      !cronograma ||
      !honestidad ||
      !identidad
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Los documentos obligatorios no fueron procesados correctamente.'
      });
    }

    // ========================================================
    // DATOS OBLIGATORIOS
    // ========================================================

    if (
      !titulo_propuesta ||
      !sede ||
      !convocatoriaId
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'El título, la convocatoria y la sede son campos obligatorios.'
      });
    }

    // ========================================================
    // CÓDIGO DE PROPUESTA
    // ========================================================

    const finalCodigoPropuesta =
      codigoPropuesta ||
      `ArchiveX-${Date.now()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    // ========================================================
    // RUTAS DE ARCHIVOS
    // ========================================================
    //
    // Multer ya genera nombres controlados por el servidor.
    //
    // No usamos originalname ni extname().
    //
    // La carpeta privada se representa explícitamente como:
    //
    // uploads_private/archivo.pdf
    //

    const presupuesto_url =
      `uploads_private/${presupuesto.filename}`;

    const cronograma_url =
      `uploads_private/${cronograma.filename}`;

    const honestidad_url =
      `uploads_private/${honestidad.filename}`;

    const id_url =
      `uploads_private/${identidad.filename}`;

    // ========================================================
    // CREAR SOLICITUD
    // ========================================================
    //
    // El estado "Radicado" pertenece al flujo específico de
    // esta operación de radicación.
    //
    // No se acepta un estado desde req.body.
    //

    const nuevaSolicitudId =
      await Solicitud.create({
        usuario_id: usuarioId,
        convocatoria_id: parseInt(
          convocatoriaId,
          10
        ),
        sede_id: parseInt(sede, 10),
        num_solicitud: finalCodigoPropuesta,
        titulo_propuesta,
        observaciones:
          observaciones || null,
        estado: 'Radicado',
        presupuesto_url,
        cronograma_url,
        honestidad_url,
        id_url
      });

    return res.status(201).json({
      status: 'success',
      message:
        'Propuesta radicada exitosamente en la base de datos con sus 4 documentos.',
      data: {
        id: nuevaSolicitudId,
        codigoPropuesta:
          finalCodigoPropuesta,
        titulo_propuesta,
        usuarioId,
        archivos: {
          presupuesto_url,
          cronograma_url,
          honestidad_url,
          id_url
        }
      }
    });
  } catch (error) {
    console.error(
      'Error al radicar postulación:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al procesar la radicación de la propuesta.'
    });
  }
};

// ============================================================
// 2. OBTENER HISTORIAL DEL USUARIO AUTENTICADO
// ============================================================

const getPostulacionesByUser = async (req, res) => {
  try {
    const usuarioId =
      obtenerUsuarioAutenticadoId(req);

    if (!usuarioId) {
      return res.status(401).json({
        status: 'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    const solicitudes =
      await Solicitud.getByUserId(usuarioId);

    return res.status(200).json({
      status: 'success',
      data: solicitudes
    });
  } catch (error) {
    console.error(
      'Error al obtener solicitudes del usuario:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener tus solicitudes.'
    });
  }
};

// ============================================================
// 3. OBTENER TODAS LAS POSTULACIONES
// ============================================================
//
// Esta operación es administrativa.
//
// El backend vuelve a comprobar el rol aunque la ruta ya tenga
// requireRole(). Esto proporciona defensa en profundidad.
// ============================================================

const getPostulacionesAdmin = async (req, res) => {
  try {
    if (!esAdminUser(req)) {
      return res.status(403).json({
        status: 'error',
        message:
          'Acceso denegado. No tienes permisos para visualizar la bandeja global de postulaciones.'
      });
    }

    const query = `
      SELECT
        s.id,
        s.num_solicitud AS codigoPropuesta,
        s.titulo_propuesta,
        s.presupuesto_url AS presupuesto,
        s.cronograma_url AS cronograma,
        s.honestidad_url AS honestidad,
        s.id_url AS id_documento,
        s.estado,
        s.motivo_decision,
        s.created_at AS fecha_radicacion,
        s.observaciones,
        s.sede_id AS sede,
        se.nombre_sede AS nombre_sede,
        u.nombre_completo AS docente_nombre,
        u.email AS docente_correo
      FROM solicitudes s
      LEFT JOIN sedes se
        ON s.sede_id = se.id
      LEFT JOIN usuarios u
        ON s.usuario_id = u.id
      ORDER BY s.id DESC
    `;

    const [rows] = await db.query(query);

    // --------------------------------------------------------
    // Normalización de rutas
    // --------------------------------------------------------
    //
    // Las nuevas rutas de documentos privados ya se almacenan
    // como uploads_private/...
    //
    // Las rutas antiguas pueden seguir existiendo como
    // uploads/..., por lo que conservamos ambos formatos.
    //

    const normalizarRutaArchivo = (
      filePath
    ) => {
      if (!filePath) {
        return null;
      }

      return String(filePath)
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');
    };

    const result = rows.map((row) => ({
      ...row,

      presupuesto:
        normalizarRutaArchivo(
          row.presupuesto
        ),

      cronograma:
        normalizarRutaArchivo(
          row.cronograma
        ),

      honestidad:
        normalizarRutaArchivo(
          row.honestidad
        ),

      id_documento:
        normalizarRutaArchivo(
          row.id_documento
        )
    }));

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error(
      'Error al consultar solicitudes desde administración:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al cargar la bandeja de postulaciones.'
    });
  }
};

// ============================================================
// 4. ACTUALIZAR ESTADO DE UNA PROPUESTA
// ============================================================
//
// Esta operación es exclusivamente administrativa.
//
// El cliente puede proponer un estado, pero el backend:
//
// 1. verifica autenticación;
// 2. verifica rol Admin;
// 3. valida que el estado exista en la whitelist;
// 4. ejecuta la actualización.
// ============================================================

const updateEstadoPostulacion = async (req, res) => {
  try {
    if (!esAdminUser(req)) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permisos para modificar el estado de una propuesta.'
      });
    }

    const { id } = req.params;

    const {
      estado,
      motivo_decision
    } = req.body;

    const estadosValidos = [
      'Borrador',
      'Radicado',
      'En Evaluación',
      'Aprobado',
      'Rechazado'
    ];

    if (
      !estado ||
      !estadosValidos.includes(estado)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'El estado proporcionado no es válido para el flujo de evaluación de ArchiveX.'
      });
    }

    // El motivo solo tiene sentido cuando la propuesta
    // es rechazada.
    const motivoFinal =
      estado === 'Rechazado'
        ? (
            typeof motivo_decision === 'string'
              ? motivo_decision.trim()
              : null
          )
        : null;

    const affectedRows =
      await Solicitud.updateEstado(
        id,
        estado,
        motivoFinal
      );

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message:
          'No se encontró la propuesta solicitada para modificar su estado.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        `El estado de la propuesta ha sido actualizado exitosamente a: ${estado}.`
    });
  } catch (error) {
    console.error(
      'Error al actualizar estado de propuesta:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error interno en el servidor al intentar modificar el estado.'
    });
  }
};

module.exports = {
  createPostulacion,
  getPostulacionesByUser,
  getPostulacionesAdmin,
  updateEstadoPostulacion
};