const Sede =
  require('../models/sedeModel');

// ============================================================
// UTILIDADES
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

const normalizarNombreSede = (
  valor
) => {
  if (
    typeof valor !==
    'string'
  ) {
    return null;
  }

  const nombre =
    valor.trim();

  if (!nombre) {
    return null;
  }

  return nombre;
};

const errorEsDuplicado = (
  error
) => {
  return (
    error?.code ===
      'ER_DUP_ENTRY' ||
    error?.errno ===
      1062
  );
};

// ============================================================
// 1. OBTENER TODAS LAS SEDES
// ============================================================
//
// Esta operación es pública.
// ============================================================

const getSedes = async (
  req,
  res
) => {
  try {
    const sedes =
      await Sede.getAll();

    return res.status(200).json({
      status:
        'success',
      data:
        sedes
    });
  } catch (error) {
    console.error(
      'Error al obtener las sedes:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al obtener las sedes.'
    });
  }
};

// ============================================================
// 2. OBTENER UNA SEDE POR ID
// ============================================================
//
// Esta operación es pública.
// ============================================================

const getSedeById = async (
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
          'El identificador de la sede no es válido.'
      });
    }

    const sede =
      await Sede.getById(
        id
      );

    if (!sede) {
      return res.status(404).json({
        status:
          'error',
        message:
          'La sede solicitada no existe.'
      });
    }

    return res.status(200).json({
      status:
        'success',
      data:
        sede
    });
  } catch (error) {
    console.error(
      'Error al obtener la sede:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al obtener la sede.'
    });
  }
};

// ============================================================
// 3. CREAR UNA NUEVA SEDE
// ============================================================
//
// La ruta ya limita esta operación a Admin.
//
// El controller vuelve a validarlo como defensa en profundidad.
// ============================================================

const createSede = async (
  req,
  res
) => {
  try {
    const rol =
      String(
        req.user?.rol || ''
      )
        .trim()
        .toLowerCase();

    const esAdmin =
      rol === 'admin' ||
      rol === 'administrador';

    if (!esAdmin) {
      return res.status(403).json({
        status:
          'error',
        message:
          'No tienes permisos para crear sedes.'
      });
    }

    const nombreSede =
      normalizarNombreSede(
        req.body?.nombre_sede
      );

    if (!nombreSede) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El nombre de la sede es obligatorio.'
      });
    }

    // Según schema.sql:
    // nombre_sede VARCHAR(100) UNIQUE NOT NULL
    if (
      nombreSede.length >
      100
    ) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El nombre de la sede no puede superar los 100 caracteres.'
      });
    }

    const newId =
      await Sede.create(
        nombreSede
      );

    return res.status(201).json({
      status:
        'success',
      message:
        'Sede creada con éxito.',
      data: {
        id:
          newId,
        nombre_sede:
          nombreSede
      }
    });
  } catch (error) {
    console.error(
      'Error al crear sede:',
      error
    );

    if (
      errorEsDuplicado(
        error
      )
    ) {
      return res.status(409).json({
        status:
          'error',
        message:
          'Ya existe una sede con ese nombre.'
      });
    }

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al registrar la nueva sede.'
    });
  }
};

// ============================================================
// 4. MODIFICAR UNA SEDE EXISTENTE
// ============================================================
//
// Solo Admin puede realizar esta operación.
// ============================================================

const updateSede = async (
  req,
  res
) => {
  try {
    const rol =
      String(
        req.user?.rol || ''
      )
        .trim()
        .toLowerCase();

    const esAdmin =
      rol === 'admin' ||
      rol === 'administrador';

    if (!esAdmin) {
      return res.status(403).json({
        status:
          'error',
        message:
          'No tienes permisos para modificar sedes.'
      });
    }

    const id =
      obtenerIdNumerico(
        req.params.id
      );

    if (!id) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El identificador de la sede no es válido.'
      });
    }

    const nombreSede =
      normalizarNombreSede(
        req.body?.nombre_sede
      );

    if (!nombreSede) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El nuevo nombre de la sede es obligatorio.'
      });
    }

    if (
      nombreSede.length >
      100
    ) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El nombre de la sede no puede superar los 100 caracteres.'
      });
    }

    const affectedRows =
      await Sede.update(
        id,
        nombreSede
      );

    if (
      affectedRows === 0
    ) {
      return res.status(404).json({
        status:
          'error',
        message:
          'Sede no encontrada para actualizar.'
      });
    }

    return res.status(200).json({
      status:
        'success',
      message:
        'Sede actualizada con éxito.'
    });
  } catch (error) {
    console.error(
      'Error al actualizar sede:',
      error
    );

    if (
      errorEsDuplicado(
        error
      )
    ) {
      return res.status(409).json({
        status:
          'error',
        message:
          'Ya existe otra sede con ese nombre.'
      });
    }

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al actualizar la sede.'
    });
  }
};

// ============================================================
// 5. ELIMINAR UNA SEDE
// ============================================================
//
// Solo Admin puede realizar esta operación.
//
// Si la BD impide eliminarla porque existen solicitudes
// relacionadas, devolvemos un conflicto controlado.
// ============================================================

const deleteSede = async (
  req,
  res
) => {
  try {
    const rol =
      String(
        req.user?.rol || ''
      )
        .trim()
        .toLowerCase();

    const esAdmin =
      rol === 'admin' ||
      rol === 'administrador';

    if (!esAdmin) {
      return res.status(403).json({
        status:
          'error',
        message:
          'No tienes permisos para eliminar sedes.'
      });
    }

    const id =
      obtenerIdNumerico(
        req.params.id
      );

    if (!id) {
      return res.status(400).json({
        status:
          'error',
        message:
          'El identificador de la sede no es válido.'
      });
    }

    const affectedRows =
      await Sede.delete(
        id
      );

    if (
      affectedRows === 0
    ) {
      return res.status(404).json({
        status:
          'error',
        message:
          'Sede no encontrada para eliminar.'
      });
    }

    return res.status(200).json({
      status:
        'success',
      message:
        'Sede eliminada correctamente.'
    });
  } catch (error) {
    console.error(
      'Error al eliminar sede:',
      error
    );

    // Restricción de clave foránea:
    // solicitudes.sede_id -> sedes.id ON DELETE RESTRICT
    if (
      error?.code ===
        'ER_ROW_IS_REFERENCED_2' ||
      error?.errno ===
        1217 ||
      error?.errno ===
        1451
    ) {
      return res.status(409).json({
        status:
          'error',
        message:
          'No se puede eliminar esta sede porque existen solicitudes relacionadas.'
      });
    }

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al eliminar la sede.'
    });
  }
};

module.exports = {
  getSedes,
  getSedeById,
  createSede,
  updateSede,
  deleteSede
};