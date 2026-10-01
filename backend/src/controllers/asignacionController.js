const fs = require('fs');
const path = require('path');

const Asignacion = require('../models/asignacionModel');

const {
  PRIVATE_DIR
} = require('../config/uploadPaths');

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

const obtenerIdNumerico = (valor) => {
  const id = Number.parseInt(valor, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

const eliminarArchivoPrivadoSeguro = async (rutaArchivo) => {
  if (!rutaArchivo) {
    return;
  }

  try {
    const nombreArchivo = path.basename(
      String(rutaArchivo)
    );

    if (
      !nombreArchivo ||
      nombreArchivo !== String(rutaArchivo)
        .replace(/\\/g, '/')
        .split('/')
        .pop()
    ) {
      return;
    }

    const rutaFinal = path.resolve(
      PRIVATE_DIR,
      nombreArchivo
    );

    const directorioPrivado =
      path.resolve(PRIVATE_DIR);

    if (
      rutaFinal !== directorioPrivado &&
      !rutaFinal.startsWith(
        `${directorioPrivado}${path.sep}`
      )
    ) {
      return;
    }

    await fs.promises.unlink(rutaFinal);
  } catch (error) {
    // ENOENT significa que el archivo ya no existe.
    if (error.code !== 'ENOENT') {
      console.error(
        'No fue posible eliminar el archivo privado:',
        error
      );
    }
  }
};

// ============================================================
// 1. GET GENERAL
// ============================================================
//
// Admin:
//   puede consultar todas.
//
// Evaluador:
//   solamente consulta sus propias asignaciones.
//
// La ruta ya está protegida mediante requireRole(), pero se
// mantiene lógica adicional aquí como defensa en profundidad.
// ============================================================

const getAsignaciones = async (req, res) => {
  try {
    const esAdmin = esAdminUser(req);

    if (!esAdmin) {
      const usuarioId =
        obtenerUsuarioAutenticadoId(req);

      if (!usuarioId) {
        return res.status(401).json({
          status: 'error',
          message:
            'No se pudo identificar al usuario autenticado.'
        });
      }

      const asignaciones =
        await Asignacion.getByEvaluadorId(
          usuarioId
        );

      return res.status(200).json({
        status: 'success',
        data: asignaciones
      });
    }

    const asignaciones =
      await Asignacion.getAll();

    return res.status(200).json({
      status: 'success',
      data: asignaciones
    });
  } catch (error) {
    console.error(
      'Error en getAsignaciones:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener las asignaciones.'
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
//   solamente puede consultar una asignación cuyo
//   evaluador_id coincida con su identidad autenticada.
// ============================================================

const getAsignacionById = async (req, res) => {
  try {
    const id = obtenerIdNumerico(
      req.params.id
    );

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message:
          'El identificador de la asignación no es válido.'
      });
    }

    const asignacion =
      await Asignacion.getById(id);

    if (!asignacion) {
      return res.status(404).json({
        status: 'fail',
        message:
          'Asignación no encontrada.'
      });
    }

    const esAdmin = esAdminUser(req);

    if (!esAdmin) {
      const usuarioId =
        obtenerUsuarioAutenticadoId(req);

      if (!usuarioId) {
        return res.status(401).json({
          status: 'error',
          message:
            'No se pudo identificar al usuario autenticado.'
        });
      }

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
    console.error(
      'Error en getAsignacionById:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener la asignación.'
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
//
// /evaluador/999
//
// el backend compara ese ID contra req.user.id.
// ============================================================

const getAsignacionesByEvaluador = async (
  req,
  res
) => {
  try {
    const evaluadorId =
      obtenerIdNumerico(
        req.params.evaluadorId
      );

    if (!evaluadorId) {
      return res.status(400).json({
        status: 'error',
        message:
          'El identificador del evaluador no es válido.'
      });
    }

    const esAdmin = esAdminUser(req);

    const usuarioId =
      obtenerUsuarioAutenticadoId(req);

    if (!usuarioId) {
      return res.status(401).json({
        status: 'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

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
      await Asignacion.getByEvaluadorId(
        evaluadorId
      );

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
// Esta operación está restringida a Admin desde las rutas.
//
// Se mantiene una comprobación adicional por defensa en
// profundidad.
// ============================================================

const asignarEvaluador = async (
  req,
  res
) => {
  try {
    if (!esAdminUser(req)) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permisos para asignar evaluadores.'
      });
    }

    if (
      !req.body ||
      typeof req.body !== 'object'
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Los datos de la asignación no son válidos.'
      });
    }

    if (
      Array.isArray(req.body) ||
      Object.keys(req.body).length === 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Debes proporcionar los datos de la asignación.'
      });
    }

    const id =
      await Asignacion.create(req.body);

    return res.status(201).json({
      status: 'success',
      id
    });
  } catch (error) {
    console.error(
      'Error en asignarEvaluador:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al asignar el evaluador.'
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
// El archivo se almacena en PRIVATE_DIR.
//
// Si la actualización de BD falla después de guardar un archivo
// nuevo, se intenta eliminar el archivo para evitar residuos
// privados huérfanos.
// ============================================================

const calificar = async (
  req,
  res
) => {
  const id =
    obtenerIdNumerico(req.params.id);

  if (!id) {
    if (req.file) {
      await eliminarArchivoPrivadoSeguro(
        req.file.filename
      );
    }

    return res.status(400).json({
      status: 'error',
      message:
        'El identificador de la asignación no es válido.'
    });
  }

  const {
    puntaje,
    comentarios
  } = req.body;

  try {
    const asignacionExistente =
      await Asignacion.getById(id);

    if (!asignacionExistente) {
      if (req.file) {
        await eliminarArchivoPrivadoSeguro(
          req.file.filename
        );
      }

      return res.status(404).json({
        status: 'fail',
        message:
          'Asignación no encontrada.'
      });
    }

    // --------------------------------------------------------
    // OWNERSHIP
    // --------------------------------------------------------

    const esAdmin =
      esAdminUser(req);

    if (!esAdmin) {
      const usuarioId =
        obtenerUsuarioAutenticadoId(req);

      if (!usuarioId) {
        if (req.file) {
          await eliminarArchivoPrivadoSeguro(
            req.file.filename
          );
        }

        return res.status(401).json({
          status: 'error',
          message:
            'No se pudo identificar al usuario autenticado.'
        });
      }

      if (
        String(asignacionExistente.evaluador_id) !==
        String(usuarioId)
      ) {
        if (req.file) {
          await eliminarArchivoPrivadoSeguro(
            req.file.filename
          );
        }

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

    const archivoNuevo =
      req.file
        ? `uploads_private/${req.file.filename}`
        : null;

    const rutaArchivoActualizada =
      archivoNuevo ||
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
      puntajeFinal =
        Number(puntaje);

      if (
        !Number.isFinite(puntajeFinal)
      ) {
        if (req.file) {
          await eliminarArchivoPrivadoSeguro(
            req.file.filename
          );
        }

        return res.status(400).json({
          status: 'error',
          message:
            'El puntaje proporcionado no es válido.'
        });
      }

      // El sistema trabaja habitualmente con un porcentaje
      // de evaluación. Se restringe a un intervalo seguro.
      if (
        puntajeFinal < 0 ||
        puntajeFinal > 100
      ) {
        if (req.file) {
          await eliminarArchivoPrivadoSeguro(
            req.file.filename
          );
        }

        return res.status(400).json({
          status: 'error',
          message:
            'El puntaje debe estar entre 0 y 100.'
        });
      }
    }

    // --------------------------------------------------------
    // COMENTARIOS
    // --------------------------------------------------------

    let comentariosFinal = null;

    if (
      comentarios !== undefined &&
      comentarios !== null
    ) {
      if (
        typeof comentarios !== 'string'
      ) {
        if (req.file) {
          await eliminarArchivoPrivadoSeguro(
            req.file.filename
          );
        }

        return res.status(400).json({
          status: 'error',
          message:
            'Los comentarios proporcionados no son válidos.'
        });
      }

      comentariosFinal =
        comentarios.trim();

      if (
        comentariosFinal.length > 5000
      ) {
        if (req.file) {
          await eliminarArchivoPrivadoSeguro(
            req.file.filename
          );
        }

        return res.status(400).json({
          status: 'error',
          message:
            'Los comentarios no pueden superar los 5000 caracteres.'
        });
      }
    }

    // --------------------------------------------------------
    // ACTUALIZACIÓN
    // --------------------------------------------------------

    const affectedRows =
      await Asignacion.updateEvaluacion(
        id,
        {
          puntaje: puntajeFinal,
          comentarios:
            comentariosFinal,
          archivo_evaluacion:
            rutaArchivoActualizada
        }
      );

    if (affectedRows === 0) {
      if (req.file) {
        await eliminarArchivoPrivadoSeguro(
          req.file.filename
        );
      }

      return res.status(400).json({
        status: 'fail',
        message:
          'No se pudieron actualizar los datos de la evaluación.'
      });
    }

    // --------------------------------------------------------
    // LIMPIAR ARCHIVO ANTERIOR
    // --------------------------------------------------------
    //
    // Solo se elimina el archivo anterior cuando:
    //
    // - existe uno nuevo;
    // - la actualización en BD tuvo éxito;
    // - el anterior es diferente al nuevo.
    //
    // Esto evita borrar accidentalmente el archivo actualmente
    // almacenado si no hubo reemplazo.
    //

    if (
      archivoNuevo &&
      asignacionExistente.archivo_evaluacion &&
      asignacionExistente.archivo_evaluacion !==
        archivoNuevo
    ) {
      await eliminarArchivoPrivadoSeguro(
        asignacionExistente.archivo_evaluacion
          .replace(/^uploads_private\//, '')
      );
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Evaluación registrada con éxito.'
    });
  } catch (error) {
    if (req.file) {
      await eliminarArchivoPrivadoSeguro(
        req.file.filename
      );
    }

    console.error(
      'Error en calificar:',
      error
    );

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
//
// La autorización está aplicada en rutas y se vuelve a
// comprobar aquí como defensa en profundidad.
// ============================================================

const deleteAsignacion = async (
  req,
  res
) => {
  try {
    if (!esAdminUser(req)) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permisos para eliminar asignaciones.'
      });
    }

    const id =
      obtenerIdNumerico(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message:
          'El identificador de la asignación no es válido.'
      });
    }

    const asignacionExistente =
      await Asignacion.getById(id);

    if (!asignacionExistente) {
      return res.status(404).json({
        status: 'fail',
        message:
          'Asignación no encontrada para eliminar.'
      });
    }

    const affectedRows =
      await Asignacion.delete(id);

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'fail',
        message:
          'Asignación no encontrada para eliminar.'
      });
    }

    // --------------------------------------------------------
    // LIMPIAR ACTA PRIVADA
    // --------------------------------------------------------

    if (
      asignacionExistente.archivo_evaluacion
    ) {
      await eliminarArchivoPrivadoSeguro(
        asignacionExistente.archivo_evaluacion
          .replace(/^uploads_private\//, '')
      );
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Asignación eliminada correctamente.'
    });
  } catch (error) {
    console.error(
      'Error en deleteAsignacion:',
      error
    );

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