const Usuario = require('../models/usuarioModel');
const bcrypt = require('bcrypt');
const pool = require('../config/db.js');

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ROLES_VALIDOS = [
  'Admin',
  'Profesor',
  'Docente',
  'Evaluador'
];

// ============================================================
// UTILIDADES
// ============================================================

const esAdminUser = (req) => {
  const rol = String(
    req.user?.rol || ''
  )
    .trim()
    .toLowerCase();

  return (
    rol === 'admin' ||
    rol === 'administrador'
  );
};

const usuarioSeguro = (usuario) => {
  if (
    !usuario ||
    typeof usuario !== 'object'
  ) {
    return usuario;
  }

  const {
    password,
    contrasena,
    ...datosSeguros
  } = usuario;

  return datosSeguros;
};

// ============================================================
// GET /api/usuarios
// ============================================================

const getUsuarios = async (req, res) => {
  try {
    const usuarios =
      await Usuario.getAll();

    const usuariosSeguros =
      Array.isArray(usuarios)
        ? usuarios.map(usuarioSeguro)
        : [];

    return res.status(200).json({
      status: 'success',
      data: usuariosSeguros
    });
  } catch (error) {
    console.error(
      'Error al obtener usuarios:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener los usuarios.'
    });
  }
};

// ============================================================
// GET /api/usuarios/:id
// ============================================================

const getUsuarioById = async (req, res) => {
  try {
    const idSolicitado =
      String(req.params.id);

    const idAutenticado =
      String(req.user?.id);

    if (
      !esAdminUser(req) &&
      idAutenticado !== idSolicitado
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permiso para consultar este usuario.'
      });
    }

    const usuario =
      await Usuario.getById(req.params.id);

    if (!usuario) {
      return res.status(404).json({
        status: 'fail',
        message:
          'Usuario no encontrado.'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: usuarioSeguro(usuario)
    });
  } catch (error) {
    console.error(
      'Error al obtener usuario por ID:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener el usuario.'
    });
  }
};

// ============================================================
// GET /api/usuarios/evaluadores
// ============================================================

const getEvaluadores = async (req, res) => {
  try {
    const evaluadores =
      await Usuario.getEvaluadores();

    const evaluadoresSeguros =
      Array.isArray(evaluadores)
        ? evaluadores.map(usuarioSeguro)
        : [];

    return res.status(200).json({
      status: 'success',
      data: evaluadoresSeguros
    });
  } catch (error) {
    console.error(
      'Error al obtener evaluadores:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al obtener los evaluadores.'
    });
  }
};

// ============================================================
// POST /api/usuarios/registro
// ============================================================
//
// Solo Admin puede llegar aquí.
// ============================================================

const registrarUsuario = async (req, res) => {
  try {
    if (!esAdminUser(req)) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permisos para crear usuarios.'
      });
    }

    const {
      contrasena,
      password,
      rol,
      ...datosUsuario
    } = req.body;

    const contrasenaOriginal =
      typeof contrasena === 'string' &&
      contrasena.trim()
        ? contrasena
        : typeof password === 'string' &&
            password.trim()
          ? password
          : null;

    if (
      !datosUsuario.nombre_completo ||
      !datosUsuario.email
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'El nombre completo y el correo electrónico son obligatorios.'
      });
    }

    if (!contrasenaOriginal) {
      return res.status(400).json({
        status: 'error',
        message:
          'La contraseña es obligatoria.'
      });
    }

    const rolFinal =
      ROLES_VALIDOS.includes(rol)
        ? rol
        : 'Profesor';

    const emailNormalizado =
      String(datosUsuario.email)
        .trim()
        .toLowerCase();

    const [usuarioExistente] =
      await pool.query(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        [emailNormalizado]
      );

    if (
      usuarioExistente.length > 0
    ) {
      return res.status(409).json({
        status: 'error',
        message:
          'El correo electrónico ya está registrado.'
      });
    }

    const passwordHash =
      await bcrypt.hash(
        contrasenaOriginal,
        10
      );

    const datosFinales = {
      ...datosUsuario,
      email: emailNormalizado,
      rol: rolFinal,
      password: passwordHash
    };

    if (!datosFinales.cedula) {
      datosFinales.cedula =
        `CC-${Date.now()
          .toString()
          .slice(-8)}`;
    }

    const id =
      await Usuario.create(datosFinales);

    // Mantener sincronizada la tabla login.
    await pool.query(
      `
        INSERT INTO login
        (
          usuario_id,
          email,
          password
        )
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          password = VALUES(password)
      `,
      [
        id,
        emailNormalizado,
        passwordHash
      ]
    );

    return res.status(201).json({
      status: 'success',
      message:
        'Usuario creado correctamente.',
      id
    });
  } catch (error) {
    console.error(
      'Error al registrar usuario:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al registrar el usuario.'
    });
  }
};

// ============================================================
// PUT /api/usuarios/:id
// ============================================================

const updateUsuario = async (req, res) => {
  try {
    const id =
      String(req.params.id);

    const idAutenticado =
      String(req.user?.id);

    const esAdmin =
      esAdminUser(req);

    const esDuenio =
      idAutenticado === id;

    // --------------------------------------------------------
    // OWNERSHIP
    // --------------------------------------------------------

    if (
      !esAdmin &&
      !esDuenio
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permiso para modificar este usuario.'
      });
    }

    // --------------------------------------------------------
    // LISTA BLANCA
    // --------------------------------------------------------

    const CAMPOS_PERMITIDOS = [
      'cedula',
      'nombre_completo',
      'email',
      'telefono',
      'direccion',
      'nivel_educativo',
      'carrera_titulo',
      'fecha_nacimiento'
    ];

    const datosActualizar = {};

    for (
      const campo of CAMPOS_PERMITIDOS
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          campo
        )
      ) {
        datosActualizar[campo] =
          req.body[campo];
      }
    }

    // --------------------------------------------------------
    // EMAIL
    // --------------------------------------------------------

    if (
      typeof datosActualizar.email ===
      'string'
    ) {
      datosActualizar.email =
        datosActualizar.email
          .trim()
          .toLowerCase();
    }

    // --------------------------------------------------------
    // ROL
    // --------------------------------------------------------
    //
    // Solo Admin puede modificar el rol.
    //

    if (
      esAdmin &&
      req.body.rol !== undefined
    ) {
      if (
        !ROLES_VALIDOS.includes(
          req.body.rol
        )
      ) {
        return res.status(400).json({
          status: 'error',
          message:
            'Rol no válido.'
        });
      }

      datosActualizar.rol =
        req.body.rol;
    }

    // --------------------------------------------------------
    // CONTRASEÑA
    // --------------------------------------------------------

    const contrasenaSolicitada =
      typeof req.body.contrasena ===
      'string'
        ? req.body.contrasena
        : null;

    if (
      contrasenaSolicitada !== null
    ) {
      if (
        !contrasenaSolicitada.trim()
      ) {
        return res.status(400).json({
          status: 'error',
          message:
            'La nueva contraseña no puede estar vacía.'
        });
      }

      datosActualizar.password =
        await bcrypt.hash(
          contrasenaSolicitada,
          10
        );
    }

    // --------------------------------------------------------
    // FOTO PÚBLICA
    // --------------------------------------------------------

    if (
      req.files?.foto &&
      req.files.foto[0]
    ) {
      datosActualizar.foto_url =
        `/uploads/${req.files.foto[0].filename}`;
    }

    // --------------------------------------------------------
    // CERTIFICADO PRIVADO
    // --------------------------------------------------------

    if (
      req.files?.certificado &&
      req.files.certificado[0]
    ) {
      datosActualizar.certificado_url =
        `/uploads_private/${req.files.certificado[0].filename}`;
    }

    // --------------------------------------------------------
    // EVITAR UPDATE VACÍO
    // --------------------------------------------------------

    if (
      Object.keys(datosActualizar)
        .length === 0
    ) {
      return res.status(400).json({
        status: 'error',
        message:
          'No se proporcionaron cambios válidos.'
      });
    }

    // --------------------------------------------------------
    // ACTUALIZAR USUARIO
    // --------------------------------------------------------

    const affectedRows =
      await Usuario.update(
        req.params.id,
        datosActualizar
      );

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'fail',
        message:
          'Usuario no encontrado para actualizar.'
      });
    }

    // --------------------------------------------------------
    // SINCRONIZAR LOGIN
    // --------------------------------------------------------

    if (
      datosActualizar.email ||
      datosActualizar.password
    ) {
      const usuarioActual =
        await Usuario.getById(
          req.params.id
        );

      if (!usuarioActual) {
        return res.status(404).json({
          status: 'fail',
          message:
            'El usuario actualizado no fue encontrado.'
        });
      }

      const emailLogin =
        usuarioActual.email ||
        datosActualizar.email;

      const passwordLogin =
        datosActualizar.password ||
        usuarioActual.password;

      await pool.query(
        `
          UPDATE login
          SET
            email = ?,
            password = ?
          WHERE usuario_id = ?
        `,
        [
          emailLogin,
          passwordLogin,
          req.params.id
        ]
      );
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Usuario actualizado correctamente.'
    });
  } catch (error) {
    console.error(
      'Error al actualizar usuario:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al actualizar el usuario.'
    });
  }
};

// ============================================================
// DELETE /api/usuarios/:id
// ============================================================

const deleteUsuario = async (req, res) => {
  try {
    if (!esAdminUser(req)) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permisos para eliminar usuarios.'
      });
    }

    const affectedRows =
      await Usuario.delete(
        req.params.id
      );

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'fail',
        message:
          'Usuario no encontrado para eliminar.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message:
        'Usuario eliminado correctamente.'
    });
  } catch (error) {
    console.error(
      'Error al eliminar usuario:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'Error al eliminar el usuario.'
    });
  }
};

// ============================================================
// DELETE /api/usuarios/mantenimiento/purgar-todo
// ============================================================

const limpiarTablaDesarrollo = async (
  req,
  res
) => {
  try {
    if (!esAdminUser(req)) {
      return res.status(403).json({
        status: 'error',
        message:
          'No tienes permisos para ejecutar esta operación.'
      });
    }

    if (
      String(
        process.env.NODE_ENV || ''
      ).toLowerCase() === 'production'
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'Esta operación está deshabilitada en producción.'
      });
    }

    await Usuario.truncate();

    return res.status(200).json({
      status: 'success',
      message:
        'Tabla de usuarios purgada correctamente en entorno de desarrollo.'
    });
  } catch (error) {
    console.error(
      'Error al purgar usuarios:',
      error
    );

    return res.status(500).json({
      status: 'error',
      message:
        'No fue posible completar la operación.'
    });
  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  getEvaluadores,
  registrarUsuario,
  updateUsuario,
  deleteUsuario,
  limpiarTablaDesarrollo
};