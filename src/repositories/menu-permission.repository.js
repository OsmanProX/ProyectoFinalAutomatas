const pool = require('../config/db');

function bitToBool(value) {
  if (value === null || value === undefined) return false;
  if (Buffer.isBuffer(value)) return value[0] === 1;
  return value === 1 || value === true || value === '1';
}

class MenuPermissionRepository {
  async findByRole(idRole) {
    const [rows] = await pool.query(
      'SELECT menu_key, active FROM role_menu_permissions WHERE id_role = ?',
      [idRole]
    );
    const permissions = {};
    rows.forEach(row => {
      permissions[row.menu_key] = bitToBool(row.active);
    });
    return permissions;
  }

  async findAllGrouped() {
    const [rows] = await pool.query(
      'SELECT id_role, menu_key, active FROM role_menu_permissions ORDER BY id_role'
    );
    const result = {};
    rows.forEach(row => {
      if (!result[row.id_role]) result[row.id_role] = {};
      result[row.id_role][row.menu_key] = bitToBool(row.active);
    });
    return result;
  }

  async setPermission(idRole, menuKey, active) {
    await pool.query(
      `INSERT INTO role_menu_permissions (id_role, menu_key, active)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE active = VALUES(active)`,
      [idRole, menuKey, active ? 1 : 0]
    );
  }

  async ensureDefaults(idRole, menuKeys) {
    for (const key of menuKeys) {
      await pool.query(
        'INSERT IGNORE INTO role_menu_permissions (id_role, menu_key, active) VALUES (?, ?, b\'1\')',
        [idRole, key]
      );
    }
  }
}

module.exports = new MenuPermissionRepository();
