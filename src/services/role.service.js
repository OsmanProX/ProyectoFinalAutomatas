const roleRepository = require('../repositories/role.repository');

class RoleService {
  async getAll() {
    return await roleRepository.findAll();
  }

  async toggleActive(id) {
    if (!id || isNaN(id)) {
      return { success: false, error: 'invalid_id' };
    }

    const role = await roleRepository.findById(id);
    if (!role) {
      return { success: false, error: 'role_not_found' };
    }

    // No permitir desactivar el rol ADMIN: se bloquearia el acceso a esta misma pagina
    if (role.name.toUpperCase() === 'ADMIN' && role.active) {
      return { success: false, error: 'cannot_deactivate_admin' };
    }

    const newState = !role.active;
    await roleRepository.setActive(id, newState);
    return { success: true, active: newState };
  }
}

module.exports = new RoleService();