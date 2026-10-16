const pool = require('../config/db');

/**
 * La columna roles.active es BIT(1); mysql2 la devuelve como Buffer.
 */
function bitToBool(value) {
  if (value === null || value === undefined) return false;
  if (Buffer.isBuffer(value)) return value[0] === 1;
  return value === 1 || value === true || value === '1';
}

class RoleRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      active: bitToBool(row.active)
    };
  }

  async findAll() {
    const [rows] = await pool.query(
      'SELECT id, name, description, active FROM roles ORDER BY id'
    );
    return rows.map(r => this.mapRow(r));
  }

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, description, active FROM roles WHERE id = ?',
      [id]
    );
    return this.mapRow(rows[0]);
  }

  /**
   * Rol por defecto para registros nuevos: ANALISTA
   * (acepta tambien la escritura vieja "analitico" por compatibilidad).
   */
  async findRegisterRole() {
    const [rows] = await pool.query(
      "SELECT id, name, description, active FROM roles WHERE UPPER(name) IN ('ANALISTA', 'ANALITICO') ORDER BY id LIMIT 1"
    );
    return this.mapRow(rows[0]);
  }
}

module.exports = new RoleRepository();