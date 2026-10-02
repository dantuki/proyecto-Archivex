const jwt =
  require('jsonwebtoken');

const db =
  require('../config/db');

const {
  ADMIN_EMAIL
} =
  require('../config/securityConfig');

// ============================================================
// CONFIGURACIÓN JWT
// ============================================================
//
// El secreto es obligatorio y nunca tiene fallback.
// ============================================================

const JWT_SECRET =
  process.env.JWT_SECRET;

if (
  typeof JWT_SECRET !==
    'string' ||
  JWT_SECRET.trim().length <
    32
) {
  throw new Error(
    'JWT_SECRET no está definido o es demasiado corto. Configura una variable JWT_SECRET segura en backend/.env.'
  );
}

const JWT_ALGORITHMS = [
  'HS256'
];

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================================
//
// El token debe llegar mediante:
//
// Authorization: Bearer <token>
//
// No se aceptan tokens provenientes de:
//
// - query string;
// - parámetros de URL;
// - body;
// - cookies no configuradas.
//
// ============================================================

const verificarToken = async (
  req,
  res,
  next
) => {
  const authHeader =
    req.headers.authorization;

  if (
    typeof authHeader !==
      'string' ||
    !authHeader.trim()
  ) {
    return res.status(401).json({
      status:
        'error',

      message:
        'No autenticado: se requiere un token de acceso.'
    });
  }

  const partes =
    authHeader
      .trim()
      .split(/\s+/);

  if (
    partes.length !==
      2 ||
    partes[0].toLowerCase() !==
      'bearer'
  ) {
    return res.status(401).json({
      status:
        'error',

      message:
        'Formato de autorización inválido.'
    });
  }

  const token =
    partes[1];

  if (
    !token ||
    token ===
      'null' ||
    token ===
      'undefined'
  ) {
    return res.status(401).json({
      status:
        'error',

      message:
        'No autenticado: token inválido.'
    });
  }

  try {
    const verified =
      jwt.verify(
        token,
        JWT_SECRET,
        {
          algorithms:
            JWT_ALGORITHMS
        }
      );

    if (
      !verified ||
      (
        verified.id ===
          undefined &&
        verified.sub ===
          undefined
      )
    ) {
      return res.status(401).json({
        status:
          'error',

        message:
          'Token inválido: identidad ausente.'
      });
    }

    const usuarioId =
      verified.id ??
      verified.sub;

    const rol =
      verified.rol ??
      verified.role;

    if (
      !rol ||
      typeof rol !==
        'string'
    ) {
      return res.status(401).json({
        status:
          'error',

        message:
          'Token inválido: rol ausente.'
      });
    }

    const usuarioIdNumerico =
      Number(
        usuarioId
      );

    if (
      !Number.isInteger(
        usuarioIdNumerico
      ) ||
      usuarioIdNumerico <=
        0
    ) {
      return res.status(401).json({
        status:
          'error',

        message:
          'Token inválido: identificador de usuario no válido.'
      });
    }

    const rolNormalizado =
      rol.trim();

    const emailNormalizado =
      typeof verified.email ===
        'string'
        ? verified.email
            .trim()
            .toLowerCase()
        : '';

    // ========================================================
    // DEFENSA ADICIONAL PARA EL ADMINISTRADOR
    // ========================================================
    //
    // ArchiveX tiene un único Administrador permitido.
    //
    // Si un JWT afirma ser Admin pero pertenece a otro correo,
    // el token no se acepta.
    //
    // Esto agrega una segunda barrera además de la validación
    // realizada durante el login y en la base de datos.
    // ========================================================

    const esRolAdmin =
      rolNormalizado
        .toLowerCase() ===
        'admin' ||
      rolNormalizado
        .toLowerCase() ===
        'administrador';

    if (
      esRolAdmin &&
      emailNormalizado !==
        ADMIN_EMAIL
    ) {
      return res.status(403).json({
        status:
          'error',

        message:
          'La cuenta administrativa no está autorizada.'
      });
    }

    if (typeof verified.sid === 'string' && verified.sid) {
      const [sessions] = await db.query(
        `
          SELECT id
          FROM login_sessions
          WHERE id = ?
            AND usuario_id = ?
            AND revoked_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
          LIMIT 1
        `,
        [verified.sid, usuarioIdNumerico]
      );

      if (sessions.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Esta sesión fue cerrada o expiró.'
        });
      }

      await db.query(
        'UPDATE login_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?',
        [verified.sid]
      );
    }

    req.user = {
      ...verified,

      id:
        usuarioIdNumerico,

      rol:
        rolNormalizado,

      email:
        emailNormalizado || verified.email
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      status:
        'error',

      message:
        'Token inválido o expirado.'
    });
  }
};

module.exports =
  verificarToken;
