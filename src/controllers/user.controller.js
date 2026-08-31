const userService = require('../services/user.service');
const { getTranslation } = require('../utils/i18n');
const { DashboardDTO } = require('../dto');

class UserController {
  async getDashboard(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    try {
      const users = await userService.getAllUsers();
      const dashboardDTO = new DashboardDTO(users);
      const data = dashboardDTO.toJSON();
      res.render('dashboard', { t, lang, ...data });
    } catch (err) {
      console.error('Error al obtener usuarios:', err);
      res.render('dashboard', { t, lang, users: [], count: 0, activeCount: 0, inactiveCount: 0 });
    }
  }

  async toggleUserState(req, res) {
    try {
      const result = await userService.toggleState(req.params.id);
      if (!result.success) {
        console.error('No se pudo cambiar estado:', result.error);
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err);
    }
    res.redirect('/users/dashboard');
  }

  async deleteUser(req, res) {
    try {
      const result = await userService.deleteUser(req.params.id);
      if (!result.success) {
        console.error('No se pudo eliminar:', result.error);
      }
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
    }
    res.redirect('/users/dashboard');
  }
}

module.exports = new UserController();
