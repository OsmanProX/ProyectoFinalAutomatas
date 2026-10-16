const roleRepository = require('../repositories/role.repository');

class RoleService {
  async getAll() {
    return await roleRepository.findAll();
  }
}

module.exports = new RoleService();