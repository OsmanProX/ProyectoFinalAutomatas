const userService = require('../services/user.service');
const roleRepository = require('../repositories/role.repository');
const { getTranslation } = require('../utils/i18n');
const { DashboardDTO } = require('../dto');

// Roles que se pueden asignar desde la pagina Usuarios
const ASSIGNABLE_ROLES = ['ADMIN', 'SUPERVISOR', 'ANALISTA'];

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
      if (this.esElMismo(req)) {
        console.warn('Un ADMIN intentó cambiar el estado de su propia cuenta');
        return res.redirect('/users/dashboard');
      }
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
      if (this.esElMismo(req)) {
        console.warn('Un ADMIN intentó borrar su propia cuenta');
        return res.redirect('/users/dashboard');
      }
      const result = await userService.deleteUser(req.params.id);
      if (!result.success) {
        console.error('No se pudo eliminar:', result.error);
      }
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
    }
    res.redirect('/users/dashboard');
  }

  /**
   * Pagina Usuarios: lista nombre, nickname, rol y foto original (Base64).
   */
  async getUsers(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    let users = [];
    let roles = [];
    try {
      users = await userService.getUsersWithPhoto();
    } catch (err) {
      console.error('Error al obtener usuarios:', err);
    }
    try {
      const allRoles = await roleRepository.findAll();
      roles = allRoles.filter(r => ASSIGNABLE_ROLES.includes(r.name.toUpperCase()));
    } catch (err) {
      console.error('Error al obtener roles:', err);
    }

    res.render('users', {
      t,
      lang,
      users,
      roles,
      error: req.query.error || null,
      ok: req.query.ok === '1'
    });
  }

  /** true si la fila que se edita es la del usuario que tiene la sesión */
  esElMismo(req) {
    const actual = req.session && req.session.user;
    return Boolean(actual) && Number(actual.id) === Number(req.params.id);
  }

  /**
   * Guarda los cambios de la fila en Gestion de usuarios:
   * rol (ADMIN, SUPERVISOR o ANALISTA) y, si viene en el cuerpo, estado (1/0).
   */
  async updateRole(req, res) {
    try {
      const idRole = req.body.idRole;

      // El ADMIN no puede desactivarse ni quitarse el rol ADMIN a sí mismo
      // (se quedaría sin acceso a Gestión de usuarios)
      if (this.esElMismo(req)) {
        const rolNuevo = await roleRepository.findById(Number(idRole));
        const dejaDeSerAdmin = !rolNuevo || String(rolNuevo.name).toUpperCase() !== 'ADMIN';
        const seDesactiva = req.body.state !== undefined && Number(req.body.state) === 0;
        if (dejaDeSerAdmin || seDesactiva) {
          return res.status(400).json({ success: false, error: 'self_change' });
        }
      }

      const result = await userService.updateUserRole(req.params.id, idRole);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      let state = null;
      if (req.body.state !== undefined) {
        const stateResult = await userService.setUserState(req.params.id, req.body.state);
        if (!stateResult.success) {
          return res.status(400).json({ success: false, error: stateResult.error });
        }
        state = stateResult.state;
      }

      return res.json({ success: true, roleName: result.roleName, state });
    } catch (err) {
      console.error('Error al actualizar rol del usuario:', err);
      return res.status(500).json({ success: false, error: 'server' });
    }
  }
}

module.exports = new UserController();
