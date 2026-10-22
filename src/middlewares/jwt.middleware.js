const jwtService = require('../services/jwt.service');
const userRepository = require('../repositories/user.repository');
const menuPermissionRepository = require('../repositories/menu-permission.repository');

/**
 * ============================================================================
 * MIDDLEWARES JWT para la API (/api)
 * ============================================================================
 * Las rutas web siguen usando la sesión (cookie). La API usa el encabezado:
 *     Authorization: Bearer <token>
 * El token se obtiene con POST /api/auth/login.
 * Las respuestas de error son JSON claras y sin detalles internos.
 * ============================================================================
 */
const RE_BEARER = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

const MENSAJES = {
  token_requerido: 'Falta el token. Envía el encabezado Authorization: Bearer <token> (se obtiene en POST /api/auth/login).',
  token_invalido: 'El token no es válido.',
  token_expirado: 'El token expiró. Inicia sesión de nuevo en POST /api/auth/login.',
  token_revocado: 'El token ya fue cerrado (logout). Inicia sesión de nuevo.',
  usuario_inactivo: 'El usuario no existe o está inactivo.',
  rol_inactivo: 'Tu rol está desactivado. Contacta al administrador.',
  sin_permiso: 'Tu rol no tiene permiso para esta opción.',
  error_servidor: 'No se pudo validar el acceso. Intenta de nuevo.'
};

function responderError(res, status, error) {
  if (status === 401) {
    res.set('WWW-Authenticate', error === 'token_requerido' ? 'Bearer' : 'Bearer error="invalid_token"');
  }
  return res.status(status).json({ success: false, error, message: MENSAJES[error] || MENSAJES.error_servidor });
}

/** Exige un token válido y carga el usuario ACTUAL desde la base de datos (req.apiUser) */
async function jwtAuth(req, res, next) {
  const coincidencia = RE_BEARER.exec(req.get('authorization') || '');
  if (!coincidencia) return responderError(res, 401, 'token_requerido');

  let payload;
  try {
    payload = jwtService.verify(coincidencia[1]);
  } catch (err) {
    return responderError(res, 401, err.code || 'token_invalido');
  }

  try {
    // Si el admin desactiva al usuario, su token deja de servir de inmediato
    const user = await userRepository.findById(Number(payload.sub));
    if (!user || !user.isActive()) return responderError(res, 401, 'usuario_inactivo');
    req.apiUser = user;
    req.tokenPayload = payload;
    return next();
  } catch (err) {
    console.error('Error al validar el token JWT:', err.message);
    return responderError(res, 500, 'error_servidor');
  }
}

/** Bloquea si el rol del usuario fue desactivado en "Roles y Permisos" */
function requireActiveRole(req, res, next) {
  if (!req.apiUser) return responderError(res, 401, 'token_requerido');
  if (req.apiUser.roleActive === false) return responderError(res, 403, 'rol_inactivo');
  return next();
}

/** Igual que en la web: respeta los permisos de menú del rol (role_menu_permissions) */
function requireMenu(menuKey) {
  return async (req, res, next) => {
    if (!req.apiUser) return responderError(res, 401, 'token_requerido');
    if (!req.apiUser.idRole) return next();
    try {
      const permisos = await menuPermissionRepository.findByRole(req.apiUser.idRole);
      if (permisos && permisos[menuKey] === false) return responderError(res, 403, 'sin_permiso');
      return next();
    } catch (err) {
      // Si la tabla aún no existe no se restringe (mismo criterio que la web)
      return next();
    }
  };
}

/** Solo ciertos roles, por nombre (ADMIN, SUPERVISOR, ANALISTA...) */
function requireRole(...roles) {
  const permitidos = roles.map((r) => r.toUpperCase());
  return (req, res, next) => {
    if (!req.apiUser) return responderError(res, 401, 'token_requerido');
    const rol = String(req.apiUser.roleDisplayName() || '').toUpperCase();
    if (!permitidos.includes(rol)) return responderError(res, 403, 'sin_permiso');
    return next();
  };
}

module.exports = { jwtAuth, requireActiveRole, requireMenu, requireRole };
