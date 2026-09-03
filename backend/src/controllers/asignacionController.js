const Asignacion = require('../models/asignacionModel');

// ============================================================
// UTILIDADES
// ============================================================

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
// 1. GET GENERAL
// ============================================================
//
// Esta ruta está protegida desde asignacionRoutes.js.
//
// Admin:
//   puede consultar todas.
//
// Evaluador:
//   la ruta existe por compatibilidad, pero el acceso a los
//   datos debe mantenerse restringido por el diseño del sistema.
//
// ============================================================

const getAsignaciones = async (req, res) => {
  try {
    const esAdmin = esAdminUser(req);

    if (!esAdmin) {
      const usuarioId = obtenerUsuarioAutenticadoId(req);

      const asignaciones =
        await Asignacion.getByEvaluadorId(usuarioId);

      return res.status(200).json({
        status: 'success',
        data: asignaciones
      });
    }

    const asignaciones = await Asignacion.getAll();

    return res.status(200).json({
      status: 'success',
      data: asignaciones
    });
  } catch (error) {
    console.error('Error en getAsignaciones:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener las asignaciones.'
    });
  }
};

// ============================================================
// 2. GET ESPECÍFICO POR ID
// ============================================================
//
// Admin:
//   puede consultar cualquier asignación.
//
// Evaluador:
//   solamente puede consultar una asignación cuyo evaluador_id
//   coincida con su identidad autenticada.
//
// IMPORTANTE:
//   No confiamos en un evaluadorId enviado por el frontend.
// ============================================================

const getAsignacionById = async (req, res) => {
  try {
    const asignacion =
      await Asignacion.getById(req.params.id);

    if (!asignacion) {
      return res.status(404).json({
        status: 'fail',
        message: 'Asignación no encontrada'
      });
    }

    const esAdmin = esAdminUser(req);

    if (!esAdmin) {
      const usuarioId = obtenerUsuarioAutenticadoId(req);

      if (
        String(asignacion.evaluador_id) !==
        String(usuarioId)
      ) {
        return res.status(403).json({
          status: 'error',
          message:
            'No tienes permiso para consultar esta asignación.'
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      data: asignacion
    });
  } catch (error) {
    console.error('Error en getAsignacionById:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener la asignación.'
    });
  }
};

// ============================================================
// 3. GET ASIGNACIONES POR EVALUADOR
// ============================================================
//
// Admin:
//   puede consultar las asignaciones de cualquier evaluador.
//
// Evaluador:
//   solamente puede consultar sus propias asignaciones.
//
// Aunque el cliente mande:
//   /evaluador/999
//
// el backend compara ese ID contra req.user.id.
// ============================================================

const getAsignacionesByEvaluador = async (req, res) => {
  try {
    const { evaluadorId } = req.params;

    const esAdmin = esAdminUser(req);
    const usuarioId = obtenerUsuarioAutenticadoId(req);

    if (
      !esAdmin &&
      String(usuarioId) !== String(evaluadorId)
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'No puedes consultar asignaciones de otro evaluador.'
      });
    }

    const asignaciones =
      await Asignacion.getByEvaluadorId(evaluadorId);

    return res.status(200).json({
      status: 'success',
      data: asignaciones
    });
  } catch (error) {
    console.error(
      'Error en getAsignacionesByEvaluador:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener las asignaciones del evaluador.'
    });
  }
};

// ============================================================
// 4. CREAR ASIGNACIÓN
// ============================================================
//
// Esta operación ya está restringida a Admin desde
// asignacionRoutes.js.
//
// Por eso el Admin puede enviar el evaluador_id que corresponda
// según el flujo administrativo.
// ============================================================

const asignarEvaluador = async (req, res) => {
  try {
    const id = await Asignacion.create(req.body);

    return res.status(201).json({
      status: 'success',
      id
    });
  } catch (error) {
    console.error('Error en asignarEvaluador:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error al asignar el evaluador.'
    });
  }
};

// ============================================================
// 5. CALIFICAR
// ============================================================
//
// Admin:
//   puede calificar/modificar cualquier asignación.
//
// Evaluador:
//   solamente puede calificar la asignación que realmente
//   está asociada a su usuario autenticado.
//
// El archivo se genera con nombre seguro por Multer.
//
// IMPORTANTE:
// uploadMiddleware.js ya utiliza PRIVATE_DIR.
// Por eso la URL almacenada debe ser:
//
// uploads_private/<archivo>
//
// ============================================================

const calificar = async (req, res) => {
  const { id } = req.params;

  const {
    puntaje,
    comentarios
  } = req.body;

  try {
    const asignacionExistente =
      await Asignacion.getById(id);

    if (!asignacionExistente) {
      return res.status(404).json({
        status: 'fail',
        message: 'Asignación no encontrada'
      });
    }

    // --------------------------------------------------------
    // OWNERSHIP
    // --------------------------------------------------------

    const esAdmin = esAdminUser(req);

    if (!esAdmin) {
      const usuarioId =
        obtenerUsuarioAutenticadoId(req);

      if (
        String(asignacionExistente.evaluador_id) !==
        String(usuarioId)
      ) {
        return res.status(403).json({
          status: 'error',
          message:
            'No puedes calificar una asignación que no te pertenece.'
        });
      }
    }

    // --------------------------------------------------------
    // ARCHIVO DE EVALUACIÓN
    // --------------------------------------------------------

    const archivo_evaluacion = req.file
      ? `uploads_private/${req.file.filename}`
      : null;

    // Si no se sube uno nuevo, conservamos el anterior.
    const rutaArchivoActualizada =
      archivo_evaluacion ||
      asignacionExistente.archivo_evaluacion ||
      null;

    // --------------------------------------------------------
    // PUNTAJE
    // --------------------------------------------------------

    let puntajeFinal = null;

    if (
      puntaje !== undefined &&
      puntaje !== null &&
      String(puntaje).trim() !== ''
    ) {
      puntajeFinal = Number.parseInt(
        puntaje,
        10
      );

      if (Number.isNaN(puntajeFinal)) {
        return res.status(400).json({
          status: 'error',
          message: 'El puntaje proporcionado no es válido.'
        });
      }
    }

    // --------------------------------------------------------
    // ACTUALIZACIÓN
    // --------------------------------------------------------

    const affectedRows =
      await Asignacion.updateEvaluacion(id, {
        puntaje: puntajeFinal,
        comentarios:
          comentarios !== undefined
            ? String(comentarios).trim()
            : null,
        archivo_evaluacion:
          rutaArchivoActualizada
      });

    if (affectedRows === 0) {
      return res.status(400).json({
        status: 'fail',
        message:
          'No se pudieron actualizar los datos de la evaluación.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Evaluación registrada con éxito'
    });
  } catch (error) {
    console.error('Error en calificar:', error);

    return res.status(500).json({
      status: 'error',
      message:
        'Error al registrar la calificación.'
    });
  }
};

// ============================================================
// 6. DELETE
// ============================================================
//
// Solo Admin puede eliminar asignaciones.
// La autorización ya está aplicada en las rutas.
// ============================================================

const deleteAsignacion = async (req, res) => {
  try {
    const affectedRows =
      await Asignacion.delete(req.params.id);

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'fail',
        message:
          'Asignación no encontrada para eliminar'
      });
    }

    return res.json({
      status: 'success',
      message:
        'Asignación eliminada correctamente'
    });
  } catch (error) {
    console.error('Error en deleteAsignacion:', error);

    return res.status(500).json({
      status: 'error',
      message:
        'Error al eliminar la asignación.'
    });
  }
};

module.exports = {
  getAsignaciones,
  getAsignacionById,
  getAsignacionesByEvaluador,
  asignarEvaluador,
  calificar,
  deleteAsignacion
};