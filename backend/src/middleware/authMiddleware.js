const jwt = require('jsonwebtoken');

/**
 * Secret obligatorio para firmar y verificar JWT.
 *
 * Nunca utilizamos un valor por defecto o hardcodeado.
 * Si JWT_SECRET no existe, la aplicación debe fallar de forma segura.
 */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim().length < 32) {
  throw new Error(
    'JWT_SECRET no está definido o es demasiado corto. ' +
    'Configura una variable JWT_SECRET segura en backend/.env.'
  );
}

/**
 * Middleware de autenticación.
 *
 * Obtiene el token exclusivamente desde:
 * Authorization: Bearer <token>
 *
 * Si el token es válido, construye req.user utilizando
 * únicamente la información firmada dentro del JWT.
 */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: 'error',
      message: 'No autenticado: se requiere un token de acceso.'
    });
  }

  const partes = authHeader.trim().split(/\s+/);

  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      status: 'error',
      message: 'Formato de autorización inválido.'
    });
  }

  const token = partes[1];

  if (
    !token ||
    token === 'null' ||
    token === 'undefined'
  ) {
    return res.status(401).json({
      status: 'error',
      message: 'No autenticado: token inválido.'
    });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    });

    if (!verified || (!verified.id && !verified.sub)) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido: identidad ausente.'
      });
    }

    const usuarioId = verified.id ?? verified.sub;
    const rol = verified.rol ?? verified.role;

    if (!rol) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido: rol ausente.'
      });
    }

    req.user = {
      ...verified,
      id: usuarioId,
      rol
    };

    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Token inválido o expirado.'
    });
  }
};

module.exports = verificarToken;