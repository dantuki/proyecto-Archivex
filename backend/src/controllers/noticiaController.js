const Noticia = require('../models/noticiaModel');

const fs = require('fs');
const path = require('path');

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
// RESOLVER RUTA FÍSICA DE ARCHIVO PRIVADO
// ============================================================
//
// Los registros antiguos pueden contener:
//
// /uploads/archivo.pdf
// uploads_private/archivo.pdf
// /uploads_private/archivo.pdf
//
// Esta función permite localizar el archivo de forma segura
// cuando sea necesario eliminarlo.
//
// IMPORTANTE:
// Nunca utilizamos directamente texto del cliente como una
// ruta de archivo.
// ============================================================

const obtenerRutaArchivoPrivado = (archivoUrl) => {
  if (!archivoUrl) {
    return null;
  }

  const nombreArchivo = path.basename(
    String(archivoUrl)
  );

  if (!nombreArchivo || nombreArchivo === '.') {
    return null;
  }

  const privateRoot = path.resolve(
    path.join(__dirname, '../../uploads_private')
  );

  const rutaArchivo = path.resolve(
    privateRoot,
    nombreArchivo
  );

  if (
    !rutaArchivo.startsWith(
      privateRoot + path.sep
    )
  ) {
    return null;
  }

  return rutaArchivo;
};

// ============================================================
// GET NOTICIAS DE UN USUARIO
// ============================================================
//
// Admin:
//   puede consultar noticias de cualquier usuario.
//
// Usuario normal:
//   solamente sus propias noticias.
// ============================================================

const getNoticiasUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    const usuarioAutenticadoId =
      obtenerUsuarioAutenticadoId(req);

    if (
      !esAdminUser(req) &&
      String(usuarioAutenticadoId) !== String(usuarioId)
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes autorización para consultar estas noticias.'
      });
    }

    const data =
      await Noticia.getAllByUsuario(usuarioId);

    return res.json({
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
// CREAR NOTICIA
// ============================================================
//
// La identidad del autor procede del JWT.
//
// Usuario normal:
//   usuario_id = req.user.id
//
// Admin:
//   puede crear para otro usuario si el frontend lo requiere
//   y envía usuario_id explícitamente.
// ============================================================

const crearNoticia = async (req, res) => {
  try {
    let usuario_id =
      obtenerUsuarioAutenticadoId(req);

    if (
      esAdminUser(req) &&
      req.body.usuario_id
    ) {
      usuario_id = req.body.usuario_id;
    }

    const {
      titulo,
      contenido,
      fecha
    } = req.body;

    if (!usuario_id || !titulo || !contenido) {
      return res.status(400).json({
        status: 'error',
        message:
          'Los campos usuario, título y contenido son obligatorios.'
      });
    }

    let archivo_url = null;

    if (req.file) {
      archivo_url =
        `uploads_private/${req.file.filename}`;
    }

    const id = await Noticia.create({
      usuario_id,
      titulo,
      contenido,
      archivo_url,
      fecha
    });

    return res.status(201).json({
      status: 'success',
      id
    });
  } catch (error) {
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
// ACTUALIZAR NOTICIA
// ============================================================
//
// Admin:
//   puede modificar cualquier noticia.
//
// Usuario normal:
//   únicamente una noticia propia.
//
// ============================================================

const actualizarNoticia = async (req, res) => {
  try {
    const { id } = req.params;

    const noticiaActual =
      await Noticia.getById(id);

    if (!noticiaActual) {
      return res.status(404).json({
        status: 'error',
        message:
          'Registro no encontrado.'
      });
    }

    const usuarioAutenticadoId =
      obtenerUsuarioAutenticadoId(req);

    const esPropietario =
      String(noticiaActual.usuario_id) ===
      String(usuarioAutenticadoId);

    if (
      !esAdminUser(req) &&
      !esPropietario
    ) {
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

    let archivo_url =
      noticiaActual.archivo_url;

    // --------------------------------------------------------
    // NUEVO ARCHIVO
    // --------------------------------------------------------

    if (req.file) {
      if (noticiaActual.archivo_url) {
        const rutaVieja =
          obtenerRutaArchivoPrivado(
            noticiaActual.archivo_url
          );

        if (
          rutaVieja &&
          fs.existsSync(rutaVieja)
        ) {
          fs.unlinkSync(rutaVieja);
        }
      }

      archivo_url =
        `uploads_private/${req.file.filename}`;
    }

    await Noticia.update(id, {
      titulo,
      contenido,
      archivo_url,
      fecha
    });

    return res.json({
      status: 'success',
      message:
        'Registro actualizado correctamente'
    });
  } catch (error) {
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
// ELIMINAR NOTICIA
// ============================================================
//
// Admin:
//   puede eliminar cualquier noticia.
//
// Usuario normal:
//   solamente una noticia propia.
// ============================================================

const eliminarNoticia = async (req, res) => {
  try {
    const { id } = req.params;

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

    const esPropietario =
      String(noticia.usuario_id) ===
      String(usuarioAutenticadoId);

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
    // ELIMINAR ARCHIVO
    // --------------------------------------------------------

    if (noticia.archivo_url) {
      const rutaArchivo =
        obtenerRutaArchivoPrivado(
          noticia.archivo_url
        );

      if (
        rutaArchivo &&
        fs.existsSync(rutaArchivo)
      ) {
        fs.unlinkSync(rutaArchivo);
      }
    }

    await Noticia.delete(id);

    return res.json({
      status: 'success',
      message:
        'Registro eliminado correctamente'
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