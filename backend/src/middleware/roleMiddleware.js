/**
 * Middleware de autorización por roles.
 *
 * IMPORTANTE:
 * El rol utilizado para autorizar SIEMPRE proviene de req.user,
 * que previamente debe haber sido construido por authMiddleware
 * a partir de un JWT válido.
 *
 * Nunca se debe utilizar req.body.rol, req.query.rol,
 * req.params.rol ni ningún valor enviado por el cliente
 * como fuente de autoridad.
 */

const normalizarRol = (rol) => {
  const valor = String(rol || '').trim().toLowerCase();

  if (valor === 'administrador') {
    return 'admin';
  }

  return valor;
};

const requireRole = (...rolesPermitidos) => {
  const permitidosNormalizados = rolesPermitidos.map(normalizarRol);

  return (req, res, next) => {
    if (!req.user || !req.user.id || !req.user.rol) {
      return res.status(401).json({
        status: 'error',
        message: 'No autenticado: se requiere una sesión válida.'
      });
    }

    const rolUsuario = normalizarRol(req.user.rol);

    if (!permitidosNormalizados.includes(rolUsuario)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para realizar esta acción.'
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  normalizarRol
};