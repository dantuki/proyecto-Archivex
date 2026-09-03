const Convocatoria = require('../models/convocatoriaModel');

// ============================================================
// UTILIDADES
// ============================================================

const generarCodigoRandom = (prefijo = 'CNV') => {
  const caracteres =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let resultado = '';

  for (let i = 0; i < 5; i++) {
    resultado += caracteres.charAt(
      Math.floor(
        Math.random() * caracteres.length
      )
    );
  }

  return `${prefijo}-${resultado}`;
};

// ============================================================
// GET - LISTAR CONVOCATORIAS
// ============================================================

const getConvocatorias = async (req, res) => {
  try {
    const convocatorias =
      await Convocatoria.getAll();

    return res.status(200).json({
      status: 'success',
      data: convocatorias
    });
  } catch (error) {
    console.error(
      'Error en getConvocatorias:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener convocatorias.'
    });
  }
};

// ============================================================
// GET - OBTENER CONVOCATORIA POR ID
// ============================================================

const getConvocatoriaById = async (req, res) => {
  try {
    const { id } = req.params;

    const convocatoria =
      await Convocatoria.getById(id);

    if (!convocatoria) {
      return res.status(404).json({
        status: 'error',
        message:
          'Convocatoria no encontrada.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: convocatoria
    });
  } catch (error) {
    console.error(
      'Error en getConvocatoriaById:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener la convocatoria.'
    });
  }
};

// ============================================================
// POST - CREAR CONVOCATORIA
// ============================================================
//
// Solo Admin puede llegar hasta este controller porque la ruta
// ya exige:
//
// verificarToken
// requireRole('Admin')
//
// Las bases de convocatoria:
//
// - son públicas por diseño;
// - se almacenan en /uploads;
// - el nombre físico lo genera el servidor;
// - la extensión no viene del nombre original;
// - el archivo ya pasó por Multer + magic bytes antes de llegar
//   aquí.
//
// No confiamos en bases_url enviado por el cliente.
// ============================================================

const createConvocatoria = async (req, res) => {
  try {
    let {
      codigo,
      titulo,
      descripcion,
      tipo,
      fecha_inicio,
      fecha_cierre,
      presupuesto_max,
      modalidad,
      area_tematica,
      plantillas_url
    } = req.body;

    // ========================================================
    // VALIDACIONES BÁSICAS
    // ========================================================

    if (
      !titulo ||
      !descripcion ||
      !tipo ||
      !fecha_inicio ||
      !fecha_cierre
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Los campos titulo, descripcion, tipo, fecha_inicio y fecha_cierre son obligatorios.'
      });
    }

    if (
      new Date(fecha_cierre) <=
      new Date(fecha_inicio)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'La fecha de cierre debe ser posterior a la fecha de inicio.'
      });
    }

    if (
      presupuesto_max !== undefined &&
      presupuesto_max !== null &&
      presupuesto_max !== ''
    ) {
      const presupuestoNumero =
        Number(presupuesto_max);

      if (
        Number.isNaN(presupuestoNumero) ||
        presupuestoNumero < 0
      ) {
        return res.status(400).json({
          status: 'error',
          message:
            'El presupuesto máximo no es válido.'
        });
      }

      presupuesto_max = presupuestoNumero;
    }

    // ========================================================
    // CÓDIGO
    // ========================================================

    if (
      !codigo ||
      String(codigo).trim() === ''
    ) {
      codigo = generarCodigoRandom();
    } else {
      codigo = String(codigo)
        .trim()
        .toUpperCase();
    }

    // ========================================================
    // ARCHIVO DE BASES
    // ========================================================
    //
    // IMPORTANTE:
    //
    // NO utilizamos:
    // req.body.bases_url
    //
    // La ruta se construye exclusivamente a partir del archivo
    // que Multer aceptó y cuyo nombre fue generado por el servidor.
    //

    let bases_url = null;

    if (req.file) {
      bases_url =
        `/uploads/${req.file.filename}`;
    }

    const newId =
      await Convocatoria.create({
        codigo,
        titulo,
        descripcion,
        tipo,
        fecha_inicio,
        fecha_cierre,
        presupuesto_max,
        modalidad,
        area_tematica,
        bases_url,
        plantillas_url
      });

    return res.status(201).json({
      status: 'success',
      message:
        'Convocatoria creada exitosamente',
      data: {
        id: newId,
        codigo,
        titulo
      }
    });
  } catch (error) {
    console.error(
      'Error en createConvocatoria:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al crear la convocatoria.'
    });
  }
};

// ============================================================
// PUT - ACTUALIZAR CONVOCATORIA
// ============================================================
//
// Si se sube un nuevo PDF:
//
// req.file
//    ↓
// /uploads/<nombre generado por servidor>
//
// Si no se sube archivo:
//
// se conserva el bases_url existente.
//
// Esto evita que un cliente pueda cambiar bases_url arbitrariamente.
// ============================================================

const updateConvocatoria = async (req, res) => {
  try {
    const { id } = req.params;

    let {
      codigo,
      titulo,
      descripcion,
      tipo,
      fecha_inicio,
      fecha_cierre,
      presupuesto_max,
      modalidad,
      area_tematica,
      plantillas_url
    } = req.body;

    // ========================================================
    // VALIDACIONES
    // ========================================================

    if (
      !titulo ||
      !descripcion ||
      !tipo ||
      !fecha_inicio ||
      !fecha_cierre
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'Todos los campos principales son requeridos para actualizar.'
      });
    }

    if (
      new Date(fecha_cierre) <=
      new Date(fecha_inicio)
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'La fecha de cierre debe ser posterior a la fecha de inicio.'
      });
    }

    if (
      presupuesto_max !== undefined &&
      presupuesto_max !== null &&
      presupuesto_max !== ''
    ) {
      const presupuestoNumero =
        Number(presupuesto_max);

      if (
        Number.isNaN(presupuestoNumero) ||
        presupuestoNumero < 0
      ) {
        return res.status(400).json({
          status: 'error',
          message:
            'El presupuesto máximo no es válido.'
        });
      }

      presupuesto_max = presupuestoNumero;
    }

    // ========================================================
    // CÓDIGO
    // ========================================================

    if (
      !codigo ||
      String(codigo).trim() === ''
    ) {
      codigo = generarCodigoRandom();
    } else {
      codigo = String(codigo)
        .trim()
        .toUpperCase();
    }

    // ========================================================
    // RECUPERAR CONVOCATORIA ACTUAL
    // ========================================================
    //
    // Necesitamos conservar el PDF actual si no se sube otro.
    //

    const convocatoriaActual =
      await Convocatoria.getById(id);

    if (!convocatoriaActual) {
      return res.status(404).json({
        status: 'error',
        message:
          'Convocatoria no encontrada para actualizar.'
      });
    }

    // ========================================================
    // BASES
    // ========================================================

    let bases_url =
      convocatoriaActual.bases_url || null;

    if (req.file) {
      bases_url =
        `/uploads/${req.file.filename}`;
    }

    // ========================================================
    // ACTUALIZACIÓN
    // ========================================================

    const affectedRows =
      await Convocatoria.update(id, {
        codigo,
        titulo,
        descripcion,
        tipo,
        fecha_inicio,
        fecha_cierre,
        presupuesto_max,
        modalidad,
        area_tematica,
        bases_url,
        plantillas_url
      });

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message:
          'Convocatoria no encontrada para actualizar.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Convocatoria modificada correctamente'
    });
  } catch (error) {
    console.error(
      'Error en updateConvocatoria:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al actualizar la convocatoria.'
    });
  }
};

// ============================================================
// DELETE - ELIMINAR CONVOCATORIA
// ============================================================
//
// La ruta ya exige Admin.
// ============================================================

const deleteConvocatoria = async (req, res) => {
  try {
    const { id } = req.params;

    const affectedRows =
      await Convocatoria.delete(id);

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message:
          'Convocatoria no encontrada para eliminar.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Convocatoria eliminada correctamente'
    });
  } catch (error) {
    console.error(
      'Error en deleteConvocatoria:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al eliminar la convocatoria.'
    });
  }
};

module.exports = {
  getConvocatorias,
  getConvocatoriaById,
  createConvocatoria,
  updateConvocatoria,
  deleteConvocatoria
};