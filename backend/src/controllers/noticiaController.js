const Noticia = require('../models/noticiaModel');

const fs = require('fs');
const path = require('path');

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

  return String(rolRaw || '')
    .trim()
    .toLowerCase();
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
// VALIDAR ID NUMÉRICO
// ============================================================

const obtenerIdNumerico = (valor) => {
  const id = Number.parseInt(
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
// RESOLVER RUTA FÍSICA DE ARCHIVO PRIVADO
// ============================================================
//
// Los registros pueden contener:
//
// uploads_private/archivo.pdf
// /uploads_private/archivo.pdf
//
// También pueden existir registros antiguos que hayan utilizado
// uploads/archivo.pdf.
//
// Esta función SOLO permite resolver archivos cuyo nombre físico
// esté dentro de PRIVATE_DIR.
//
// Nunca utilizamos directamente una ruta enviada por el cliente
// para acceder al sistema de archivos.
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
    nombreArchivo !== valorNormalizado.split('/').pop()
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
    rutaArchivo !== privateRoot &&
    !rutaArchivo.startsWith(
      `${privateRoot}${path.sep}`
    )
  ) {
    return null;
  }

  return rutaArchivo;
};

// ============================================================
// ELIMINAR ARCHIVO PRIVADO DE FORMA SEGURA
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
    if (error.code !== 'ENOENT') {
      console.error(
        'Error al eliminar archivo privado:',
        error
      );
    }
  }
};

// ============================================================
// 1. GET NOTICIAS DE UN USUARIO
// ============================================================
//
// Admin:
//   puede consultar noticias de cualquier usuario.
//
// Usuario normal:
//   solamente sus propias noticias.
// ============================================================

const getNoticiasUsuario = async (
  req,
  res
) => {
  try {
    const usuarioId =
      obtenerIdNumerico(
        req.params.usuarioId
      );

    if (!usuarioId) {
      return res.status(400).json({
        status: 'error',
        message:
          'El identificador del usuario no es válido.'
      });
    }

    const usuarioAutenticadoId =
      obtenerUsuarioAutenticadoId(req);

    if (
      !usuarioAutenticadoId
    ) {
      return res.status(401).json({
        status: 'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    if (
      !esAdminUser(req) &&
      String(usuarioAutenticadoId) !==
        String(usuarioId)
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes autorización para consultar estas noticias.'
      });
    }

    const data =
      await Noticia.getAllByUsuario(
        usuarioId
      );

    return res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    console.error(
      'Error en getNoticiasUsuario:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener las noticias.'
    });
  }
};

// ============================================================
// 2. CREAR NOTICIA
// ============================================================
//
// La identidad del autor procede del JWT.
//
// Usuario normal:
//   usuario_id = req.user.id
//
// Admin:
//   puede crear para otro usuario mediante usuario_id.
//
// Nunca permitimos que un usuario normal suplante otro
// usuario mediante req.body.usuario_id.
// ============================================================

const crearNoticia = async (
  req,
  res
) => {
  let archivoCreado = null;

  try {
    let usuario_id =
      obtenerUsuarioAutenticadoId(req);

    if (
      !usuario_id
    ) {
      return res.status(401).json({
        status: 'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    if (
      esAdminUser(req) &&
      req.body.usuario_id !== undefined &&
      req.body.usuario_id !== null &&
      String(req.body.usuario_id).trim() !== ''
    ) {
      usuario_id =
        obtenerIdNumerico(
          req.body.usuario_id
        );

      if (!usuario_id) {
        return res.status(400).json({
          status: 'error',
          message:
            'El identificador del usuario no es válido.'
        });
      }
    }

    const {
      titulo,
      contenido,
      fecha
    } = req.body;

    // --------------------------------------------------------
    // VALIDAR TÍTULO
    // --------------------------------------------------------

    if (
      typeof titulo !== 'string' ||
      titulo.trim().length === 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'El título es obligatorio.'
      });
    }

    const tituloFinal =
      titulo.trim();

    if (
      tituloFinal.length > 255
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'El título no puede superar los 255 caracteres.'
      });
    }

    // --------------------------------------------------------
    // VALIDAR CONTENIDO
    // --------------------------------------------------------

    if (
      typeof contenido !== 'string' ||
      contenido.trim().length === 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'El contenido es obligatorio.'
      });
    }

    const contenidoFinal =
      contenido.trim();

    // --------------------------------------------------------
    // VALIDAR FECHA
    // --------------------------------------------------------

    if (
      typeof fecha !== 'string' ||
      fecha.trim().length === 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'La fecha es obligatoria.'
      });
    }

    const fechaFinal =
      fecha.trim();

    // La BD espera una fecha DATE.
    // Se exige formato YYYY-MM-DD.
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        fechaFinal
      )
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'La fecha debe tener el formato YYYY-MM-DD.'
      });
    }

    // --------------------------------------------------------
    // ARCHIVO
    // --------------------------------------------------------

    let archivo_url = null;

    if (req.file) {
      archivoCreado =
        req.file.filename;

      archivo_url =
        `uploads_private/${req.file.filename}`;
    }

    // --------------------------------------------------------
    // CREAR
    // --------------------------------------------------------

    const id =
      await Noticia.create({
        usuario_id,
        titulo: tituloFinal,
        contenido: contenidoFinal,
        archivo_url,
        fecha: fechaFinal
      });

    return res.status(201).json({
      status: 'success',
      id
    });
  } catch (error) {
    // Si la BD falla después de guardar el archivo, lo limpiamos.
    if (archivoCreado) {
      await eliminarArchivoPrivado(
        archivoCreado
      );
    }

    console.error(
      'Error en crearNoticia:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al crear la noticia.'
    });
  }
};

// ============================================================
// 3. ACTUALIZAR NOTICIA
// ============================================================
//
// Admin:
//   puede modificar cualquier noticia.
//
// Usuario normal:
//   únicamente una noticia propia.
//
// El archivo anterior NO se elimina hasta que la actualización
// de la BD haya sido exitosa.
// ============================================================

const actualizarNoticia = async (
  req,
  res
) => {
  let archivoNuevo = null;

  try {
    const id =
      obtenerIdNumerico(
        req.params.id
      );

    if (!id) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(400).json({
        status: 'error',
        message:
          'El identificador de la noticia no es válido.'
      });
    }

    const noticiaActual =
      await Noticia.getById(id);

    if (!noticiaActual) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(404).json({
        status: 'error',
        message:
          'Registro no encontrado.'
      });
    }

    const usuarioAutenticadoId =
      obtenerUsuarioAutenticadoId(req);

    if (
      !usuarioAutenticadoId
    ) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(401).json({
        status: 'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    const esPropietario =
      String(noticiaActual.usuario_id) ===
      String(usuarioAutenticadoId);

    // --------------------------------------------------------
    // OWNERSHIP
    // --------------------------------------------------------

    if (
      !esAdminUser(req) &&
      !esPropietario
    ) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(403).json({
        status: 'error',
        message:
          'No puedes modificar una noticia que no te pertenece.'
      });
    }

    const {
      titulo,
      contenido,
      fecha
    } = req.body;

    // --------------------------------------------------------
    // VALIDAR TÍTULO
    // --------------------------------------------------------

    if (
      typeof titulo !== 'string' ||
      titulo.trim().length === 0
    ) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(400).json({
        status: 'error',
        message:
          'El título es obligatorio.'
      });
    }

    const tituloFinal =
      titulo.trim();

    if (
      tituloFinal.length > 255
    ) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(400).json({
        status: 'error',
        message:
          'El título no puede superar los 255 caracteres.'
      });
    }

    // --------------------------------------------------------
    // VALIDAR CONTENIDO
    // --------------------------------------------------------

    if (
      typeof contenido !== 'string' ||
      contenido.trim().length === 0
    ) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(400).json({
        status: 'error',
        message:
          'El contenido es obligatorio.'
      });
    }

    const contenidoFinal =
      contenido.trim();

    // --------------------------------------------------------
    // VALIDAR FECHA
    // --------------------------------------------------------

    if (
      typeof fecha !== 'string' ||
      fecha.trim().length === 0
    ) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(400).json({
        status: 'error',
        message:
          'La fecha es obligatoria.'
      });
    }

    const fechaFinal =
      fecha.trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        fechaFinal
      )
    ) {
      if (req.file) {
        await eliminarArchivoPrivado(
          req.file.filename
        );
      }

      return res.status(400).json({
        status: 'error',
        message:
          'La fecha debe tener el formato YYYY-MM-DD.'
      });
    }

    // --------------------------------------------------------
    // ARCHIVO
    // --------------------------------------------------------

    let archivo_url =
      noticiaActual.archivo_url ||
      null;

    if (req.file) {
      archivoNuevo =
        req.file.filename;

      archivo_url =
        `uploads_private/${req.file.filename}`;
    }

    // --------------------------------------------------------
    // ACTUALIZAR BD
    // --------------------------------------------------------

    await Noticia.update(
      id,
      {
        titulo: tituloFinal,
        contenido: contenidoFinal,
        archivo_url,
        fecha: fechaFinal
      }
    );

    // --------------------------------------------------------
    // ELIMINAR ARCHIVO ANTERIOR
    // --------------------------------------------------------
    //
    // Solo después de confirmar la actualización de BD.
    //

    if (
      archivoNuevo &&
      noticiaActual.archivo_url &&
      noticiaActual.archivo_url !== archivo_url
    ) {
      await eliminarArchivoPrivado(
        noticiaActual.archivo_url
      );
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Registro actualizado correctamente.'
    });
  } catch (error) {
    // Si se creó un archivo nuevo pero falló la actualización,
    // eliminamos solamente el archivo nuevo.
    if (archivoNuevo) {
      await eliminarArchivoPrivado(
        archivoNuevo
      );
    }

    console.error(
      'Error en actualizarNoticia:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al actualizar la noticia.'
    });
  }
};

// ============================================================
// 4. ELIMINAR NOTICIA
// ============================================================
//
// Admin:
//   puede eliminar cualquier noticia.
//
// Usuario normal:
//   solamente una noticia propia.
//
// Primero se elimina el registro de BD.
// El archivo se limpia posteriormente para evitar que una falla
// de archivo bloquee la eliminación lógica de la noticia.
// ============================================================

const eliminarNoticia = async (
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
        status: 'error',
        message:
          'El identificador de la noticia no es válido.'
      });
    }

    const noticia =
      await Noticia.getById(id);

    if (!noticia) {
      return res.status(404).json({
        status: 'error',
        message:
          'Registro no encontrado.'
      });
    }

    const usuarioAutenticadoId =
      obtenerUsuarioAutenticadoId(req);

    if (
      !usuarioAutenticadoId
    ) {
      return res.status(401).json({
        status: 'error',
        message:
          'No se pudo identificar al usuario autenticado.'
      });
    }

    const esPropietario =
      String(noticia.usuario_id) ===
      String(usuarioAutenticadoId);

    // --------------------------------------------------------
    // OWNERSHIP
    // --------------------------------------------------------

    if (
      !esAdminUser(req) &&
      !esPropietario
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'No puedes eliminar una noticia que no te pertenece.'
      });
    }

    // --------------------------------------------------------
    // ELIMINAR REGISTRO DE BD
    // --------------------------------------------------------

    await Noticia.delete(id);

    // --------------------------------------------------------
    // LIMPIAR ARCHIVO
    // --------------------------------------------------------

    if (noticia.archivo_url) {
      await eliminarArchivoPrivado(
        noticia.archivo_url
      );
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Registro eliminado correctamente.'
    });
  } catch (error) {
    console.error(
      'Error en eliminarNoticia:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al eliminar la noticia.'
    });
  }
};

module.exports = {
  getNoticiasUsuario,
  crearNoticia,
  actualizarNoticia,
  eliminarNoticia
};