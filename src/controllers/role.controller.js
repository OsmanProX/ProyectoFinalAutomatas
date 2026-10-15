const roleService = require('../services/role.service');
const menuPermissionService = require('../services/menu-permission.service');
const { MENU_ITEMS } = require('../config/constants');
const { getTranslation } = require('../utils/i18n');

class RoleController {
  async getRoles(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    let roles = [];
    try {
      roles = await roleService.getAll();
    } catch (err) {
      console.error('Error al obtener roles:', err);
      return res.render('roles', {
        t, lang, roles: [], menuPermissions: {}, menuItems: MENU_ITEMS,
        ok: false, error: 'server', saved: false
      });
    }

    let menuPermissions = {};
    try {
      menuPermissions = await menuPermissionService.getAllGrouped();
    } catch (err) {
      console.warn('No se pudieron cargar permisos de menu (tabla role_menu_permissions puede no existir):', err.message);
    }

    res.render('roles', {
      t,
      lang,
      roles,
      menuPermissions,
      menuItems: MENU_ITEMS,
      ok: req.query.ok === '1',
      error: req.query.error || null,
      saved: req.query.saved === '1'
    });
  }

  async toggleActive(req, res) {
    try {
      const result = await roleService.toggleActive(req.params.id);
      if (!result.success) {
        return res.redirect('/roles?error=' + result.error);
      }
      return res.redirect('/roles?ok=1');
    } catch (err) {
      console.error('Error al cambiar estado del rol:', err);
      return res.redirect('/roles?error=server');
    }
  }

  async getPermissions(req, res) {
    try {
      const permissions = await menuPermissionService.getRolePermissions(req.params.id);
      return res.json({ success: true, permissions });
    } catch (err) {
      console.error('Error al obtener permisos:', err);
      return res.status(500).json({ success: false, error: 'server' });
    }
  }

  async savePermissions(req, res) {
    try {
      const { activeKeys } = req.body;
      const result = await menuPermissionService.saveRolePermissions(req.params.id, activeKeys);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('Error al guardar permisos:', err);
      return res.status(500).json({ success: false, error: 'server' });
    }
  }
}

module.exports = new RoleController();
