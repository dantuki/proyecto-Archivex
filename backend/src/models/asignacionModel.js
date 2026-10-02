const db = require('../config/db');

const Asignacion = {
  // ==========================================================
  // OBTENER TODAS LAS ASIGNACIONES
  // ==========================================================

  getAll: async () => {
    const query = `
      SELECT
        a.id AS asignacion_id,
        a.solicitud_id,
        a.evaluador_id,
        a.puntaje,
        a.comentarios,
        a.estado_evaluacion,
        a.archivo_evaluacion,

        s.num_solicitud AS codigoPropuesta,
        s.titulo_propuesta,
        c.fecha_cierre AS fecha_limite,

        u.nombre_completo AS docente_nombre,

        ev.nombre_completo AS evaluador_nombre

      FROM asignacion_evaluaciones a

      JOIN solicitudes s
        ON a.solicitud_id = s.id

      JOIN convocatorias c
        ON s.convocatoria_id = c.id

      JOIN usuarios u
        ON s.usuario_id = u.id

      LEFT JOIN usuarios ev
        ON a.evaluador_id = ev.id

      ORDER BY a.id DESC
    `;

    const [rows] = await db.query(query);

    return rows;
  },

  // ==========================================================
  // OBTENER ASIGNACIÓN POR ID
  // ==========================================================

  getById: async (id) => {
    const query = `
      SELECT
        a.id AS asignacion_id,
        a.solicitud_id,
        a.evaluador_id,
        a.puntaje,
        a.comentarios,
        a.estado_evaluacion,
        a.archivo_evaluacion,

        s.num_solicitud AS codigoPropuesta,
        s.titulo_propuesta,

        u.nombre_completo AS docente_nombre,

        ev.nombre_completo AS evaluador_nombre

      FROM asignacion_evaluaciones a

      JOIN solicitudes s
        ON a.solicitud_id = s.id

      JOIN usuarios u
        ON s.usuario_id = u.id

      LEFT JOIN usuarios ev
        ON a.evaluador_id = ev.id

      WHERE a.id = ?
      LIMIT 1
    `;

    const [rows] = await db.query(
      query,
      [id]
    );

    return rows[0] || null;
  },

  // ==========================================================
  // OBTENER ASIGNACIONES POR EVALUADOR
  // ==========================================================

  getByEvaluadorId: async (evaluadorId) => {
    const query = `
      SELECT
        a.id AS asignacion_id,
        a.solicitud_id,
        a.evaluador_id,
        a.puntaje,
        a.comentarios,
        a.estado_evaluacion,
        a.archivo_evaluacion,

        s.num_solicitud AS codigoPropuesta,
        s.titulo_propuesta,

        c.fecha_cierre AS fecha_limite,

        s.presupuesto_url AS presupuesto,
        s.cronograma_url AS cronograma,
        s.honestidad_url AS honestidad,
        s.id_url AS id_documento,

        u.nombre_completo AS docente_nombre,

        ev.nombre_completo AS evaluador_nombre

      FROM asignacion_evaluaciones a

      JOIN solicitudes s
        ON a.solicitud_id = s.id

      JOIN convocatorias c
        ON s.convocatoria_id = c.id

      JOIN usuarios u
        ON s.usuario_id = u.id

      LEFT JOIN usuarios ev
        ON a.evaluador_id = ev.id

      WHERE a.evaluador_id = ?

      ORDER BY a.id DESC
    `;

    const [rows] = await db.query(
      query,
      [evaluadorId]
    );

    return rows;
  },

  // ==========================================================
  // CREAR ASIGNACIÓN
  // ==========================================================
  //
  // La ruta y el controller restringen esta operación a Admin.
  //
  // Aquí se vuelve a validar:
  //
  // - solicitud válida;
  // - evaluador válido;
  // - existencia de ambos registros;
  // - rol Evaluador;
  // - duplicados.
  // ==========================================================

  create: async (data) => {
    const {
      postulacionId,
      evaluadorId
    } = data || {};

    const solicitudIdNumerico =
      Number.parseInt(
        postulacionId,
        10
      );

    const evaluadorIdNumerico =
      Number.parseInt(
        evaluadorId,
        10
      );

    if (
      !Number.isInteger(
        solicitudIdNumerico
      ) ||
      solicitudIdNumerico <= 0
    ) {
      throw new Error(
        'El identificador de la solicitud no es válido.'
      );
    }

    if (
      !Number.isInteger(
        evaluadorIdNumerico
      ) ||
      evaluadorIdNumerico <= 0
    ) {
      throw new Error(
        'El identificador del evaluador no es válido.'
      );
    }

    // ========================================================
    // VERIFICAR SOLICITUD
    // ========================================================

    const [
      solicitudRows
    ] = await db.query(
      `
        SELECT id
        FROM solicitudes
        WHERE id = ?
        LIMIT 1
      `,
      [solicitudIdNumerico]
    );

    if (
      solicitudRows.length === 0
    ) {
      throw new Error(
        'La solicitud indicada no existe.'
      );
    }

    // ========================================================
    // VERIFICAR EVALUADOR
    // ========================================================

    const [
      evaluadorRows
    ] = await db.query(
      `
        SELECT
          id,
          rol
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      [evaluadorIdNumerico]
    );

    if (
      evaluadorRows.length === 0
    ) {
      throw new Error(
        'El evaluador indicado no existe.'
      );
    }

    const rolEvaluador =
      String(
        evaluadorRows[0].rol || ''
      )
        .trim()
        .toLowerCase();

    if (
      rolEvaluador !== 'evaluador'
    ) {
      throw new Error(
        'El usuario seleccionado no tiene el rol Evaluador.'
      );
    }

    // ========================================================
    // EVITAR DUPLICADOS
    // ========================================================

    const [
      existente
    ] = await db.query(
      `
        SELECT id
        FROM asignacion_evaluaciones
        WHERE solicitud_id = ?
          AND evaluador_id = ?
        LIMIT 1
      `,
      [
        solicitudIdNumerico,
        evaluadorIdNumerico
      ]
    );

    if (
      existente.length > 0
    ) {
      return existente[0].id;
    }

    // ========================================================
    // INSERTAR
    // ========================================================

    const [
      result
    ] = await db.query(
      `
        INSERT INTO asignacion_evaluaciones
        (
          solicitud_id,
          evaluador_id,
          estado_evaluacion
        )
        VALUES
        (
          ?,
          ?,
          'Asignado'
        )
      `,
      [
        solicitudIdNumerico,
        evaluadorIdNumerico
      ]
    );

    return result.insertId;
  },

  // ==========================================================
  // ACTUALIZAR EVALUACIÓN
  // ==========================================================

  updateEvaluacion: async (
    id,
    data
  ) => {
    const {
      puntaje,
      comentarios,
      archivo_evaluacion
    } = data || {};

    const [
      result
    ] = await db.query(
      `
        UPDATE asignacion_evaluaciones
        SET
          puntaje = ?,
          comentarios = ?,
          archivo_evaluacion = ?,
          estado_evaluacion = 'Finalizado'
        WHERE id = ?
      `,
      [
        puntaje,
        comentarios,
        archivo_evaluacion,
        id
      ]
    );

    return result.affectedRows;
  },

  // ==========================================================
  // ELIMINAR ASIGNACIÓN
  // ==========================================================

  delete: async (id) => {
    const [
      result
    ] = await db.query(
      `
        DELETE FROM asignacion_evaluaciones
        WHERE id = ?
      `,
      [id]
    );

    return result.affectedRows;
  }
};

module.exports = Asignacion;