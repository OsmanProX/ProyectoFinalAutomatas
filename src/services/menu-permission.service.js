const menuPermissionRepository = require('../repositories/menu-permission.repository');
const roleRepository = require('../repositories/role.repository');
const { MENU_ITEMS, MENU_KEYS } = require('../config/constants');

class MenuPermissionService {
  async getRolePermissions(idRole) {
    if (!idRole || isNaN(idRole)) return null;
    return await menuPermissionRepository.findByRole(Number(idRole));
  }

  async getAllGrouped() {
    return await menuPermissionRepository.findAllGrouped();
  }

  async saveRolePermissions(idRole, activeKeys) {
    if (!idRole || isNaN(idRole)) {
      return { success: false, error: 'invalid_id' };
    }

    const role = await roleRepository.findById(Number(idRole));
    if (!role) {
      return { success: false, error: 'role_not_found' };
    }

    // No permitir modificar permisos del rol ADMIN (se bloquearia el acceso a esta pagina)
    if (role.name.toUpperCase() === 'ADMIN') {
      return { success: false, error: 'cannot_modify_admin' };
    }

    if (!Array.isArray(activeKeys)) {
      return { success: false, error: 'invalid_payload' };
    }

    const invalid = activeKeys.filter(key => !MENU_KEYS.includes(key));
    if (invalid.length > 0) {
      return { success: false, error: 'invalid_keys' };
    }

    for (const item of MENU_ITEMS) {
      // 'roles' solo lo ve ADMIN; 'inicio' siempre esta disponible, no se modifica aqui
      if (item.key === 'roles' || item.key === 'inicio') continue;
      const active = activeKeys.includes(item.key);
      await menuPermissionRepository.setPermission(Number(idRole), item.key, active);
    }

    return { success: true };
  }

  async ensureDefaultsForRole(idRole) {
    await menuPermissionRepository.ensureDefaults(idRole, MENU_KEYS);
  }
}

module.exports = new MenuPermissionService();
