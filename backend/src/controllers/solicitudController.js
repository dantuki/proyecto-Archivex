const Solicitud = require('../models/solicitudModel');
const Trazabilidad = require('../models/trazabilidadModel');
const db = require('../config/db');

// ============================================================
// UTILIDADES
// ============================================================

const generarRadicadoRandom = (prefijo = 'SOL') => {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let resultado = '';

  for (let i = 0; i < 5; i++) {
    resultado += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }

  return `${prefijo}-${resultado}`;
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

const obtenerUsuarioAutenticadoId = (req) => {
  return (
    req.user?.id ||
    req.user?.usuario_id ||
    req.user?.id_usuario ||
    req.user?.userId
  );
};

// ============================================================
// OBTENER SOLICITUDES GENERALES
// ============================================================

const getSolicitudes = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado.'
      });
    }

    const logueadoId = obtenerUsuarioAutenticadoId(req);
    const esAdmin = esAdminUser(req);

    if (esAdmin) {
      const solicitudes = await Solicitud.getAll();

      return res.status(200).json({
        status: 'success',
        data: solicitudes
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

    const [solicitudes] = await db.query(query, [logueadoId]);

    return res.status(200).json({
      status: 'success',
      data: solicitudes
    });
  } catch (error) {
    console.error('Error en getSolicitudes:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener las solicitudes'
    });
  }
};

// ============================================================
// OBTENER MIS SOLICITUDES
// ============================================================

const getMisSolicitudes = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado.'
      });
    }

    const logueadoId = obtenerUsuarioAutenticadoId(req);
    const esAdmin = esAdminUser(req);

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

      queryParams.push(logueadoId);
    }

    const [solicitudes] = await db.query(query, queryParams);

    return res.status(200).json({
      status: 'success',
      data: solicitudes
    });
  } catch (error) {
    console.error('Error en getMisSolicitudes:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener tus solicitudes'
    });
  }
};

// ============================================================
// OBTENER SOLICITUD POR ID
// ============================================================

const getSolicitudById = async (req, res) => {
  try {
    const { id } = req.params;
    const logueadoId = obtenerUsuarioAutenticadoId(req);

    const solicitud = await Solicitud.getById(id);

    if (!solicitud) {
      return res.status(404).json({
        status: 'error',
        message: 'Solicitud no encontrada'
      });
    }

    const esAdmin = esAdminUser(req);
    const esDuenio =
      String(solicitud.usuario_id) === String(logueadoId);

    if (!esAdmin && !esDuenio) {
      return res.status(403).json({
        status: 'error',
        message:
          'Acceso denegado: No tienes permiso para ver esta solicitud'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: solicitud
    });
  } catch (error) {
    console.error('Error en getSolicitudById:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener la solicitud'
    });
  }
};

// ============================================================
// CREAR SOLICITUD
// ============================================================

const createSolicitud = async (req, res) => {
  try {
    let usuario_id = obtenerUsuarioAutenticadoId(req);
    const esAdmin = esAdminUser(req);

    // Solo Admin puede crear una solicitud para otro usuario.
    // Un usuario normal siempre queda asociado a su propia identidad.
    if (esAdmin && req.body.usuario_id) {
      usuario_id = req.body.usuario_id;
    }

    let {
      convocatoria_id,
      sede_id,
      num_solicitud,
      titulo_propuesta,
      observaciones,
      sede_vinculacion
    } = req.body;

    if (!sede_id && sede_vinculacion) {
      try {
        const [rows] = await db.query(
          'SELECT id FROM sedes WHERE nombre_sede = ?',
          [sede_vinculacion]
        );

        if (rows && rows.length > 0) {
          sede_id = rows[0].id;
        }
      } catch (error) {
        console.error(
          'No se pudo consultar la sede:',
          error.message
        );

        const sedesMap = {
          Apartadó: 1,
          Arauca: 2,
          Barrancabermeja: 3,
          Bogotá: 4,
          Bucaramanga: 5,
          Cali: 6,
          Cartago: 7,
          'El Espinal': 8,
          Ibagué: 9,
          Medellín: 10,
          Montería: 11,
          Neiva: 12,
          Pasto: 13,
          Pereira: 14,
          Popayán: 15,
          Quibdó: 16,
          'Santa Marta': 17,
          Villavicencio: 18
        };

        sede_id = sedesMap[sede_vinculacion] || 1;
      }
    }

    if (
      !usuario_id ||
      !convocatoria_id ||
      !sede_id ||
      !titulo_propuesta
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Los campos usuario_id, convocatoria_id, sede_id (o sede_vinculacion) y titulo_propuesta son obligatorios'
      });
    }

    if (!num_solicitud || num_solicitud.trim() === '') {
      num_solicitud = generarRadicadoRandom();
    } else {
      num_solicitud = num_solicitud.trim().toUpperCase();
    }

    // ========================================================
    // V11 — ESTADO INICIAL CONTROLADO POR EL BACKEND
    // ========================================================
    //
    // El cliente NO puede crear directamente una solicitud como:
    //
    // Aprobado
    // Rechazado
    // En Evaluación
    //
    // Toda solicitud nueva inicia como Borrador.
    //

    const estadoInicial = 'Borrador';

    // ========================================================
    // DOCUMENTOS
    // ========================================================

    const urlPresupuesto =
      req.files && req.files['presupuesto']
        ? '/uploads_private/' +
          req.files['presupuesto'][0].filename
        : null;

    const urlCronograma =
      req.files && req.files['cronograma']
        ? '/uploads_private/' +
          req.files['cronograma'][0].filename
        : null;

    const urlHonestidad =
      req.files && req.files['honestidad']
        ? '/uploads_private/' +
          req.files['honestidad'][0].filename
        : null;

    const urlIdentidad =
      req.files && req.files['identidad']
        ? '/uploads_private/' +
          req.files['identidad'][0].filename
        : null;

    const newId = await Solicitud.create({
      usuario_id,
      convocatoria_id,
      sede_id,
      num_solicitud,
      titulo_propuesta,
      observaciones,
      estado: estadoInicial,
      presupuesto_url: urlPresupuesto,
      cronograma_url: urlCronograma,
      honestidad_url: urlHonestidad,
      id_url: urlIdentidad
    });

    // ========================================================
    // REGISTRO DE DOCUMENTOS
    // ========================================================

    const filesToUpload = [];

    if (req.files) {
      if (
        req.files['presupuesto'] &&
        req.files['presupuesto'][0]
      ) {
        filesToUpload.push({
          file: req.files['presupuesto'][0],
          tipo: 'Presupuesto'
        });
      }

      if (
        req.files['cronograma'] &&
        req.files['cronograma'][0]
      ) {
        filesToUpload.push({
          file: req.files['cronograma'][0],
          tipo: 'Cronograma'
        });
      }

      if (
        req.files['honestidad'] &&
        req.files['honestidad'][0]
      ) {
        filesToUpload.push({
          file: req.files['honestidad'][0],
          tipo: 'Honestidad'
        });
      }

      if (
        req.files['identidad'] &&
        req.files['identidad'][0]
      ) {
        filesToUpload.push({
          file: req.files['identidad'][0],
          tipo: 'Identidad'
        });
      }
    }

    if (filesToUpload.length > 0) {
      const queryDoc = `
        INSERT INTO documentos_solicitud
          (solicitud_id, nombre_archivo, tipo_documento, archivo_url)
        VALUES (?, ?, ?, ?)
      `;

      for (const item of filesToUpload) {
        const file = item.file;

        const urlArchivo =
          '/uploads_private/' + file.filename;

        await db.query(queryDoc, [
          newId,
          file.originalname,
          item.tipo,
          urlArchivo
        ]);
      }
    }

    // ========================================================
    // TRAZABILIDAD
    // ========================================================

    await Trazabilidad.registrarCambio({
      solicitud_id: newId,
      usuario_id,
      estado_anterior: null,
      estado_nuevo: estadoInicial,
      motivo_cambio:
        'Creación inicial de la solicitud con carga de documentos indexados.'
    });

    return res.status(201).json({
      status: 'success',
      message:
        'Solicitud y documentos creados exitosamente',
      data: {
        id: newId,
        num_solicitud
      }
    });
  } catch (error) {
    console.error('Error en createSolicitud:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al crear la solicitud'
    });
  }
};

// ============================================================
// ACTUALIZAR SOLICITUD
// ============================================================

const updateSolicitud = async (req, res) => {
  try {
    const { id } = req.params;

    const logueadoId = obtenerUsuarioAutenticadoId(req);
    const esAdmin = esAdminUser(req);

    const solicitudPrevia = await Solicitud.getById(id);

    if (!solicitudPrevia) {
      return res.status(404).json({
        status: 'error',
        message:
          'Solicitud no encontrada para actualizar'
      });
    }

    const esDuenio =
      String(solicitudPrevia.usuario_id) ===
      String(logueadoId);

    // Solo el dueño o un Admin pueden modificar.
    if (!esAdmin && !esDuenio) {
      return res.status(403).json({
        status: 'error',
        message:
          'Acceso denegado: No puedes modificar una propuesta ajena'
      });
    }

    let usuario_id = solicitudPrevia.usuario_id;

    // Solo Admin puede reasignar una solicitud a otro usuario.
    if (esAdmin && req.body.usuario_id) {
      usuario_id = req.body.usuario_id;
    }

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

    // ========================================================
    // V11 — PROTECCIÓN DE ESTADO ADMINISTRATIVO
    // ========================================================
    //
    // El cliente no puede cambiar libremente el estado.
    //
    // Admin:
    //   puede cambiarlo.
    //
    // No Admin:
    //   puede actualizar los demás datos de su propia solicitud,
    //   pero NO puede cambiar el estado ni el motivo de decisión.
    //
    // Si intenta mandar un estado diferente al actual,
    // rechazamos la operación con 403.
    //

    if (!esAdmin) {
      const estadoSolicitado =
        typeof estado === 'string'
          ? estado.trim()
          : estado;

      const estadoActual =
        typeof solicitudPrevia.estado === 'string'
          ? solicitudPrevia.estado.trim()
          : solicitudPrevia.estado;

      if (
        estadoSolicitado !== undefined &&
        estadoSolicitado !== null &&
        estadoSolicitado !== '' &&
        String(estadoSolicitado).toLowerCase() !==
          String(estadoActual).toLowerCase()
      ) {
        return res.status(403).json({
          status: 'error',
          message:
            'No tienes permisos para cambiar el estado administrativo de la solicitud.'
        });
      }

      // Aunque el cliente intente enviar otros valores,
      // el backend conserva el estado real almacenado.
      estado = solicitudPrevia.estado;
      motivo_decision = solicitudPrevia.motivo_decision;
      motivo_cambio = null;
    } else {
      // Admin debe conservar el estado actual si no envía uno.
      if (
        estado === undefined ||
        estado === null ||
        String(estado).trim() === ''
      ) {
        estado = solicitudPrevia.estado;
      }
    }

    // ========================================================
    // SEDE
    // ========================================================

    if (!sede_id && sede_vinculacion) {
      try {
        const [rows] = await db.query(
          'SELECT id FROM sedes WHERE nombre_sede = ?',
          [sede_vinculacion]
        );

        if (rows && rows.length > 0) {
          sede_id = rows[0].id;
        }
      } catch (error) {
        console.error(
          'No se pudo consultar la sede:',
          error.message
        );

        const sedesMap = {
          Apartadó: 1,
          Arauca: 2,
          Barrancabermeja: 3,
          Bogotá: 4,
          Bucaramanga: 5,
          Cali: 6,
          Cartago: 7,
          'El Espinal': 8,
          Ibagué: 9,
          Medellín: 10,
          Montería: 11,
          Neiva: 12,
          Pasto: 13,
          Pereira: 14,
          Popayán: 15,
          Quibdó: 16,
          'Santa Marta': 17,
          Villavicencio: 18
        };

        sede_id = sedesMap[sede_vinculacion] || 1;
      }
    }

    if (
      !convocatoria_id ||
      !sede_id ||
      !estado ||
      !titulo_propuesta
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Todos los campos principales son requeridos para actualizar'
      });
    }

    if (!num_solicitud || num_solicitud.trim() === '') {
      num_solicitud = solicitudPrevia.num_solicitud;
    } else {
      num_solicitud = num_solicitud.trim().toUpperCase();
    }

    // ========================================================
    // DOCUMENTOS
    // ========================================================

    const urlPresupuesto =
      req.files && req.files['presupuesto']
        ? '/uploads_private/' +
          req.files['presupuesto'][0].filename
        : solicitudPrevia.presupuesto_url;

    const urlCronograma =
      req.files && req.files['cronograma']
        ? '/uploads_private/' +
          req.files['cronograma'][0].filename
        : solicitudPrevia.cronograma_url;

    const urlHonestidad =
      req.files && req.files['honestidad']
        ? '/uploads_private/' +
          req.files['honestidad'][0].filename
        : solicitudPrevia.honestidad_url;

    const urlIdentidad =
      req.files && req.files['identidad']
        ? '/uploads_private/' +
          req.files['identidad'][0].filename
        : solicitudPrevia.id_url;

    const affectedRows = await Solicitud.update(id, {
      usuario_id,
      convocatoria_id,
      sede_id,
      num_solicitud,
      titulo_propuesta,
      observaciones,
      estado,
      motivo_decision,
      doc_par_1: solicitudPrevia.doc_par_1,
      doc_par_2: solicitudPrevia.doc_par_2,
      presupuesto_url: urlPresupuesto,
      cronograma_url: urlCronograma,
      honestidad_url: urlHonestidad,
      id_url: urlIdentidad
    });

    // ========================================================
    // REGISTRO DE DOCUMENTOS
    // ========================================================

    const filesToUpload = [];

    if (req.files) {
      if (
        req.files['presupuesto'] &&
        req.files['presupuesto'][0]
      ) {
        filesToUpload.push({
          file: req.files['presupuesto'][0],
          tipo: 'Presupuesto'
        });
      }

      if (
        req.files['cronograma'] &&
        req.files['cronograma'][0]
      ) {
        filesToUpload.push({
          file: req.files['cronograma'][0],
          tipo: 'Cronograma'
        });
      }

      if (
        req.files['honestidad'] &&
        req.files['honestidad'][0]
      ) {
        filesToUpload.push({
          file: req.files['honestidad'][0],
          tipo: 'Honestidad'
        });
      }

      if (
        req.files['identidad'] &&
        req.files['identidad'][0]
      ) {
        filesToUpload.push({
          file: req.files['identidad'][0],
          tipo: 'Identidad'
        });
      }
    }

    if (filesToUpload.length > 0) {
      const queryDoc = `
        INSERT INTO documentos_solicitud
          (solicitud_id, nombre_archivo, tipo_documento, archivo_url)
        VALUES (?, ?, ?, ?)
      `;

      for (const item of filesToUpload) {
        const file = item.file;

        const urlArchivo =
          '/uploads_private/' + file.filename;

        await db.query(queryDoc, [
          id,
          file.originalname,
          item.tipo,
          urlArchivo
        ]);
      }
    }

    // ========================================================
    // TRAZABILIDAD
    // ========================================================

    if (
      affectedRows > 0 ||
      filesToUpload.length > 0
    ) {
      if (
        esAdmin &&
        String(solicitudPrevia.estado) !==
          String(estado)
      ) {
        await Trazabilidad.registrarCambio({
          solicitud_id: id,
          usuario_id: logueadoId,
          estado_anterior: solicitudPrevia.estado,
          estado_nuevo: estado,
          motivo_cambio:
            motivo_cambio ||
            'Actualización o transición de estado de la propuesta con anexos.'
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Solicitud actualizada correctamente'
    });
  } catch (error) {
    console.error('Error en updateSolicitud:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al actualizar la solicitud'
    });
  }
};

// ============================================================
// ELIMINAR SOLICITUD
// ============================================================

const deleteSolicitud = async (req, res) => {
  try {
    const { id } = req.params;

    const logueadoId = obtenerUsuarioAutenticadoId(req);
    const esAdmin = esAdminUser(req);

    const solicitudPrevia = await Solicitud.getById(id);

    if (!solicitudPrevia) {
      return res.status(404).json({
        status: 'error',
        message:
          'Solicitud no encontrada para eliminar'
      });
    }

    const esDuenio =
      String(solicitudPrevia.usuario_id) ===
      String(logueadoId);

    if (!esAdmin && !esDuenio) {
      return res.status(403).json({
        status: 'error',
        message:
          'Acceso denegado: No tienes permisos para eliminar esta solicitud'
      });
    }

    await Solicitud.delete(id);

    return res.status(200).json({
      status: 'success',
      message: 'Solicitud eliminada correctamente'
    });
  } catch (error) {
    console.error('Error en deleteSolicitud:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al eliminar la solicitud'
    });
  }
};

module.exports = {
  getSolicitudes,
  getMisSolicitudes,
  getSolicitudById,
  createSolicitud,
  updateSolicitud,
  deleteSolicitud
};