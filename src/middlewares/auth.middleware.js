function authMiddleware(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login');
}

/**
 * Solo usuarios con rol ADMIN (nombre del rol en la tabla roles).
 */
function adminOnly(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) {
    return res.redirect('/login');
  }
  const roleName = (user.role || '').toString().toUpperCase();
  if (roleName === 'ADMIN') {
    return next();
  }
  return res.redirect('/users/dashboard');
}

/**
 * Bloquea el acceso a opciones del sistema cuando el rol del usuario
 * fue desactivado desde "Roles y Permisos".
 * Depende de res.locals.user.role_active (lo refresca app.js en cada request).
 */
function activeRoleMiddleware(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  if (res.locals.user && res.locals.user.role_active === false) {
    return res.redirect('/users/dashboard');
  }
  return next();
}

/**
 * Bloquea el acceso a una seccion del menu si el rol del usuario
 * no tiene ese menu activo en role_menu_permissions.
 * Depende de res.locals.menuPermissions (lo refresca app.js en cada request).
 */
function menuPermissionMiddleware(menuKey) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    const perms = res.locals.menuPermissions;
    // Si no hay permisos cargados, no se restringe (compatibilidad)
    if (!perms || perms[menuKey] === undefined) {
      return next();
    }
    if (perms[menuKey] === false) {
      return res.redirect('/users/dashboard');
    }
    return next();
  };
}

module.exports = { authMiddleware, adminOnly, activeRoleMiddleware, menuPermissionMiddleware };
