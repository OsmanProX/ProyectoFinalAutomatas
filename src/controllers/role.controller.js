const roleService = require('../services/role.service');
const { getTranslation } = require('../utils/i18n');

class RoleController {
  async getRoles(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    try {
      const roles = await roleService.getAll();
      res.render('roles', {
        t,
        lang,
        roles,
        ok: req.query.ok === '1',
        error: req.query.error || null
      });
    } catch (err) {
      console.error('Error al obtener roles:', err);
      res.render('roles', { t, lang, roles: [], ok: false, error: 'server' });
    }
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
}

module.exports = new RoleController();