const fs = require('fs');
const path = require('path');

const Convocatoria =
  require('../models/convocatoriaModel');

const db =
  require('../config/db');

const { crearNotificacion } =
  require('./settingsController');

const {
  PUBLIC_DIR
} = require('../config/uploadPaths');

// ============================================================
// CONSTANTES
// ============================================================

const TIPOS_VALIDOS = [
  'General',
  'Mediana'
];

// ============================================================
// UTILIDADES
// ============================================================

const generarCodigoRandom = (
  prefijo = 'CNV'
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
    typeof valor !==
    'string'
  ) {
    return null;
  }

  const texto =
    valor.trim();

  return texto || null;
};

// ============================================================
// VALIDAR FECHA
// ============================================================

const obtenerFechaValida = (
  valor
) => {
  if (
    typeof valor !==
    'string' ||
    !valor.trim()
  ) {
    return null;
  }

  const fecha =
    new Date(
      valor
    );

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return null;
  }

  return fecha;
};

// ============================================================
// VALIDAR PLANTILLAS_URL
// ============================================================
//
// El esquema actual no obliga a que sea una URL absoluta.
//
// Permitimos:
// - https://...
// - http://...
// - rutas relativas que empiecen por /
//
// No permitimos:
// - javascript:
// - data:
// - otros esquemas arbitrarios.
//
// ============================================================

const validarPlantillasUrl = (
  valor
) => {
  if (
    valor ===
      undefined ||
    valor ===
      null ||
    String(valor).trim() ===
      ''
  ) {
    return null;
  }

  if (
    typeof valor !==
    'string'
  ) {
    throw new Error(
      'El campo plantillas_url no es válido.'
    );
  }

  const valorNormalizado =
    valor.trim();

  if (
    valorNormalizado.length >
    500
  ) {
    throw new Error(
      'El campo plantillas_url no puede superar los 500 caracteres.'
    );
  }

  if (
    valorNormalizado.startsWith(
      '/'
    )
  ) {
    return valorNormalizado;
  }

  let url;

  try {
    url =
      new URL(
        valorNormalizado
      );
  } catch {
    throw new Error(
      'El campo plantillas_url debe ser una URL válida o una ruta relativa.'
    );
  }

  if (
    url.protocol !==
      'http:' &&
    url.protocol !==
      'https:'
  ) {
    throw new Error(
      'El campo plantillas_url solo admite HTTP o HTTPS.'
    );
  }

  return valorNormalizado;
};

// ============================================================
// RESOLVER ARCHIVO PÚBLICO
// ============================================================
//
// Solo permitimos nombres físicos simples dentro de PUBLIC_DIR.
// ============================================================

const obtenerRutaArchivoPublico = (
  archivoUrl
) => {
  if (!archivoUrl) {
    return null;
  }

  const valorNormalizado =
    String(
      archivoUrl
    )
      .replace(
        /\\/g,
        '/'
      )
      .replace(
        /^\/+/,
        ''
      );

  const nombreArchivo =
    path.basename(
      valorNormalizado
    );

  if (
    !nombreArchivo ||
    nombreArchivo ===
      '.' ||
    nombreArchivo !==
      valorNormalizado
        .split('/')
        .pop()
  ) {
    return null;
  }

  const root =
    path.resolve(
      PUBLIC_DIR
    );

  const rutaFinal =
    path.resolve(
      root,
      nombreArchivo
    );

  if (
    rutaFinal !== root &&
    !rutaFinal.startsWith(
      `${root}${path.sep}`
    )
  ) {
    return null;
  }

  return rutaFinal;
};

// ============================================================
// ELIMINAR ARCHIVO PÚBLICO
// ============================================================

const eliminarArchivoPublico = async (
  archivoUrl
) => {
  const ruta =
    obtenerRutaArchivoPublico(
      archivoUrl
    );

  if (!ruta) {
    return;
  }

  try {
    await fs.promises.unlink(
      ruta
    );
  } catch (error) {
    if (
      error.code !==
      'ENOENT'
    ) {
      console.error(
        'Error al eliminar PDF público de convocatoria:',
        error
      );
    }
  }
};

// ============================================================
// VALIDAR DATOS PRINCIPALES
// ============================================================

const validarDatosConvocatoria = ({
  codigo,
  titulo,
  descripcion,
  tipo,
  fecha_inicio,
  fecha_cierre,
  presupuesto_max,
  modalidad,
  area_tematica
}) => {
  const tituloFinal =
    normalizarTexto(
      titulo
    );

  const descripcionFinal =
    normalizarTexto(
      descripcion
    );

  const tipoFinal =
    normalizarTexto(
      tipo
    );

  const inicio =
    obtenerFechaValida(
      fecha_inicio
    );

  const cierre =
    obtenerFechaValida(
      fecha_cierre
    );

  if (
    !tituloFinal ||
    !descripcionFinal ||
    !tipoFinal ||
    !fecha_inicio ||
    !fecha_cierre
  ) {
    return {
      valido:
        false,
      mensaje:
        'Los campos titulo, descripcion, tipo, fecha_inicio y fecha_cierre son obligatorios.'
    };
  }

  if (
    tituloFinal.length >
    255
  ) {
    return {
      valido:
        false,
      mensaje:
        'El título no puede superar los 255 caracteres.'
    };
  }

  if (
    tipoFinal.length >
    20 ||
    !TIPOS_VALIDOS.includes(
      tipoFinal
    )
  ) {
    return {
      valido:
        false,
      mensaje:
        'El tipo de convocatoria no es válido.'
    };
  }

  if (
    !inicio ||
    !cierre
  ) {
    return {
      valido:
        false,
      mensaje:
        'Las fechas proporcionadas no son válidas.'
    };
  }

  if (
    cierre <= inicio
  ) {
    return {
      valido:
        false,
      mensaje:
        'La fecha de cierre debe ser posterior a la fecha de inicio.'
    };
  }

  // ----------------------------------------------------------
  // PRESUPUESTO
  // ----------------------------------------------------------

  let presupuestoFinal =
    null;

  if (
    presupuesto_max !==
      undefined &&
    presupuesto_max !==
      null &&
    String(
      presupuesto_max
    ).trim() !== ''
  ) {
    const presupuestoNumero =
      Number(
        presupuesto_max
      );

    if (
      !Number.isFinite(
        presupuestoNumero
      ) ||
      presupuestoNumero < 0
    ) {
      return {
        valido:
          false,
        mensaje:
          'El presupuesto máximo no es válido.'
      };
    }

    presupuestoFinal =
      String(
        presupuesto_max
      ).trim();

    if (
      presupuestoFinal.length >
      100
    ) {
      return {
        valido:
          false,
        mensaje:
          'El presupuesto máximo no puede superar los 100 caracteres.'
      };
    }
  }

  // ----------------------------------------------------------
  // MODALIDAD
  // ----------------------------------------------------------

  const modalidadFinal =
    normalizarTexto(
      modalidad
    );

  if (
    modalidadFinal &&
    modalidadFinal.length >
      100
  ) {
    return {
      valido:
        false,
      mensaje:
        'La modalidad no puede superar los 100 caracteres.'
    };
  }

  // ----------------------------------------------------------
  // ÁREA TEMÁTICA
  // ----------------------------------------------------------

  const areaFinal =
    normalizarTexto(
      area_tematica
    );

  if (
    areaFinal &&
    areaFinal.length >
      100
  ) {
    return {
      valido:
        false,
      mensaje:
        'El área temática no puede superar los 100 caracteres.'
    };
  }

  // ----------------------------------------------------------
  // CÓDIGO
  // ----------------------------------------------------------

  let codigoFinal =
    normalizarTexto(
      codigo
    );

  if (!codigoFinal) {
    codigoFinal =
      generarCodigoRandom();
  } else {
    codigoFinal =
      codigoFinal
        .toUpperCase();

    if (
      codigoFinal.length >
      50
    ) {
      return {
        valido:
          false,
        mensaje:
          'El código no puede superar los 50 caracteres.'
      };
    }
  }

  return {
    valido:
      true,

    datos: {
      codigo:
        codigoFinal,

      titulo:
        tituloFinal,

      descripcion:
        descripcionFinal,

      tipo:
        tipoFinal,

      fecha_inicio,

      fecha_cierre,

      presupuesto_max:
        presupuestoFinal,

      modalidad:
        modalidadFinal,

      area_tematica:
        areaFinal
    }
  };
};

// ============================================================
// GET - LISTAR CONVOCATORIAS
// ============================================================

const getConvocatorias = async (
  req,
  res
) => {
  try {
    const convocatorias =
      await Convocatoria.getAll();

    return res.status(200).json({
      status:
        'success',
      data:
        convocatorias
    });
  } catch (error) {
    console.error(
      'Error en getConvocatorias:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al obtener convocatorias.'
    });
  }
};

// ============================================================
// GET - OBTENER CONVOCATORIA POR ID
// ============================================================

const getConvocatoriaById = async (
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
          'El identificador de la convocatoria no es válido.'
      });
    }

    const convocatoria =
      await Convocatoria.getById(
        id
      );

    if (!convocatoria) {
      return res.status(404).json({
        status:
          'error',
        message:
          'Convocatoria no encontrada.'
      });
    }

    return res.status(200).json({
      status:
        'success',
      data:
        convocatoria
    });
  } catch (error) {
    console.error(
      'Error en getConvocatoriaById:',
      error
    );

    return res.status(500).json({
      status:
        'error',
      message:
        'Error al obtener la convocatoria.'
    });
  }
};

// ============================================================
// POST - CREAR CONVOCATORIA
// ============================================================

const createConvocatoria = async (
  req,
  res
) => {
  let archivoNuevo =
    null;

  try {
    const validacion =
      validarDatosConvocatoria({
        codigo:
          req.body.codigo,
        titulo:
          req.body.titulo,
        descripcion:
          req.body.descripcion,
        tipo:
          req.body.tipo,
        fecha_inicio:
          req.body.fecha_inicio,
        fecha_cierre:
          req.body.fecha_cierre,
        presupuesto_max:
          req.body.presupuesto_max,
        modalidad:
          req.body.modalidad,
        area_tematica:
          req.body.area_tematica
      });

    if (
      !validacion.valido
    ) {
      return res.status(400).json({
        status:
          'error',
        message:
          validacion.mensaje
      });
    }

    const plantillas_url =
      validarPlantillasUrl(
        req.body.plantillas_url
      );

    // --------------------------------------------------------
    // ARCHIVO DE BASES
    // --------------------------------------------------------

    let bases_url =
      null;

    if (req.file) {
      archivoNuevo =
        req.file.filename;

      bases_url =
        `/uploads/${req.file.filename}`;
    }

    // --------------------------------------------------------
    // CREAR
    // --------------------------------------------------------

    const newId =
      await Convocatoria.create({
        ...validacion.datos,
        bases_url,
        plantillas_url
      });

    try {
      const [usuarios] = await db.query(
        `SELECT id FROM usuarios WHERE account_status = 'active'`
      );
      await Promise.all(usuarios.map((usuario) => crearNotificacion({
        usuarioId: usuario.id,
        type: 'convocation',
        title: 'Nueva convocatoria disponible',
        body: `${validacion.datos.titulo} · cierre ${new Date(validacion.datos.fecha_cierre).toLocaleDateString('es-ES')}`,
        link: '/convocatorias_abiertas',
        eventKey: `convocation:${newId}`
      })));
    } catch (notificationError) {
      console.error('No se pudo crear avisos de nueva convocatoria:', notificationError.code || 'error interno');
    }

    return res.status(201).json({
      status:
        'success',
      message:
        'Convocatoria creada exitosamente.',
      data: {
        id:
          newId,
        codigo:
          validacion.datos.codigo,
        titulo:
          validacion.datos.titulo
      }
    });
  } catch (error) {
    if (archivoNuevo) {
      await eliminarArchivoPublico(
        archivoNuevo
      );
    }

    console.error(
      'Error en createConvocatoria:',
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : '';

    const esValidacion =
      mensaje.includes(
        'plantillas_url'
      );

    return res.status(
      esValidacion
        ? 400
        : 500
    ).json({
      status:
        'error',
      message:
        esValidacion
          ? mensaje
          : 'Error al crear la convocatoria.'
    });
  }
};

// ============================================================
// PUT - ACTUALIZAR CONVOCATORIA
// ============================================================

const updateConvocatoria = async (
  req,
  res
) => {
  let archivoNuevo =
    null;

  try {
    const id =
      obtenerIdNumerico(
        req.params.id
      );

    if (!id) {
      if (req.file) {
        await eliminarArchivoPublico(
          req.file.filename
        );
      }

      return res.status(400).json({
        status:
          'error',
        message:
          'El identificador de la convocatoria no es válido.'
      });
    }

    const convocatoriaActual =
      await Convocatoria.getById(
        id
      );

    if (!convocatoriaActual) {
      if (req.file) {
        await eliminarArchivoPublico(
          req.file.filename
        );
      }

      return res.status(404).json({
        status:
          'error',
        message:
          'Convocatoria no encontrada para actualizar.'
      });
    }

    const validacion =
      validarDatosConvocatoria({
        codigo:
          req.body.codigo,
        titulo:
          req.body.titulo,
        descripcion:
          req.body.descripcion,
        tipo:
          req.body.tipo,
        fecha_inicio:
          req.body.fecha_inicio,
        fecha_cierre:
          req.body.fecha_cierre,
        presupuesto_max:
          req.body.presupuesto_max,
        modalidad:
          req.body.modalidad,
        area_tematica:
          req.body.area_tematica
      });

    if (
      !validacion.valido
    ) {
      if (req.file) {
        await eliminarArchivoPublico(
          req.file.filename
        );
      }

      return res.status(400).json({
        status:
          'error',
        message:
          validacion.mensaje
      });
    }

    const plantillas_url =
      validarPlantillasUrl(
        req.body.plantillas_url
      );

    // --------------------------------------------------------
    // BASES
    // --------------------------------------------------------

    let bases_url =
      convocatoriaActual.bases_url ||
      null;

    if (req.file) {
      archivoNuevo =
        req.file.filename;

      bases_url =
        `/uploads/${req.file.filename}`;
    }

    // --------------------------------------------------------
    // ACTUALIZAR
    // --------------------------------------------------------

    const affectedRows =
      await Convocatoria.update(
        id,
        {
          ...validacion.datos,
          bases_url,
          plantillas_url
        }
      );

    if (
      affectedRows === 0
    ) {
      if (archivoNuevo) {
        await eliminarArchivoPublico(
          archivoNuevo
        );
      }

      return res.status(404).json({
        status:
          'error',
        message:
          'Convocatoria no encontrada para actualizar.'
      });
    }

    // --------------------------------------------------------
    // ELIMINAR PDF ANTERIOR
    // --------------------------------------------------------
    //
    // Solo después de confirmar que la BD fue actualizada.
    //

    if (
      archivoNuevo &&
      convocatoriaActual.bases_url &&
      convocatoriaActual.bases_url !==
        bases_url
    ) {
      await eliminarArchivoPublico(
        convocatoriaActual.bases_url
      );
    }

    return res.status(200).json({
      status:
        'success',
      message:
        'Convocatoria modificada correctamente.'
    });
  } catch (error) {
    if (archivoNuevo) {
      await eliminarArchivoPublico(
        archivoNuevo
      );
    }

    console.error(
      'Error en updateConvocatoria:',
      error
    );

    const mensaje =
      error instanceof Error
        ? error.message
        : '';

    const esValidacion =
      mensaje.includes(
        'plantillas_url'
      );

    return res.status(
      esValidacion
        ? 400
        : 500
    ).json({
      status:
        'error',
      message:
        esValidacion
          ? mensaje
          : 'Error al actualizar la convocatoria.'
    });
  }
};

// ============================================================
// DELETE - ELIMINAR CONVOCATORIA
// ============================================================

const deleteConvocatoria = async (
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
          'El identificador de la convocatoria no es válido.'
      });
    }

    const convocatoria =
      await Convocatoria.getById(
        id
      );

    if (!convocatoria) {
      return res.status(404).json({
        status:
          'error',
        message:
          'Convocatoria no encontrada para eliminar.'
      });
    }

    // --------------------------------------------------------
    // ELIMINAR REGISTRO
    // --------------------------------------------------------

    const affectedRows =
      await Convocatoria.delete(
        id
      );

    if (
      affectedRows === 0
    ) {
      return res.status(404).json({
        status:
          'error',
        message:
          'Convocatoria no encontrada para eliminar.'
      });
    }

    // --------------------------------------------------------
    // LIMPIAR PDF
    // --------------------------------------------------------

    if (
      convocatoria.bases_url
    ) {
      await eliminarArchivoPublico(
        convocatoria.bases_url
      );
    }

    return res.status(200).json({
      status:
        'success',
      message:
        'Convocatoria eliminada correctamente.'
    });
  } catch (error) {
    console.error(
      'Error en deleteConvocatoria:',
      error
    );

    return res.status(500).json({
      status:
        'error',
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