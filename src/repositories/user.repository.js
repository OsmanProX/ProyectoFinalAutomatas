const pool = require('../config/db');
const User = require('../models/User');
const { INITIAL_USER_STATE } = require('../config/constants');

const SELECT_WITH_ROLE = `
  SELECT u.*, r.name AS role_name, r.active AS role_active
  FROM users u
  LEFT JOIN roles r ON r.id = u.id_Roles
`;

class UserRepository {
  async findByNickname(nickname) {
    const [rows] = await pool.query(`${SELECT_WITH_ROLE} WHERE u.nickname = ?`, [nickname]);
    return User.fromRow(rows[0]);
  }

  async findByEmail(email, comparisonEmail) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR REPLACE(email, ".", "") = ? LIMIT 1',
      [email, comparisonEmail]
    );
    return rows.length > 0;
  }

  async findWithPhoto(nickname) {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.nickname, u.state, u.role, u.id_Roles, u.notification_method, u.photo,
              r.name AS role_name, r.active AS role_active
       FROM users u
       LEFT JOIN roles r ON r.id = u.id_Roles
       WHERE u.nickname = ?`,
      [nickname]
    );
    return User.fromRow(rows[0]);
  }

  async findById(id) {
    const [rows] = await pool.query(`${SELECT_WITH_ROLE} WHERE u.id = ?`, [id]);
    return User.fromRow(rows[0]);
  }

  async findAll() {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.nickname, u.notification_method, u.state, u.create_at,
              r.name AS role_name, r.active AS role_active
       FROM users u
       LEFT JOIN roles r ON r.id = u.id_Roles
       ORDER BY u.create_at DESC`
    );
    return User.fromRows(rows);
  }

  /**
   * Lista para la pagina Usuarios: incluye la foto original (Base64) de la tabla users.
   */
  async findAllWithPhoto() {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.nickname, u.photo, u.id_Roles,
              r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.id_Roles
       ORDER BY u.id`
    );
    return rows.map(row => ({
      id: row.id,
      fullName: row.full_name,
      nickname: row.nickname,
      photo: row.photo || null,
      idRole: row.id_Roles,
      roleName: row.role_name || null
    }));
  }

  async updateRole(id, idRole) {
    await pool.query('UPDATE users SET id_Roles = ? WHERE id = ?', [idRole, id]);
  }

  async create(user) {
    const [result] = await pool.query(
      'INSERT INTO users (full_name, nickname, password, state, id_Roles, notification_method, photo, email, phone, birth_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        user.fullName,
        user.nickname,
        user.password,
        user.state !== undefined ? user.state : INITIAL_USER_STATE,
        user.idRole,
        user.notificationMethod,
        user.photo || null,
        user.email,
        user.phone || null,
        user.birthDate || null
      ]
    );
    return result.insertId;
  }

  async updateState(id, state) {
    await pool.query('UPDATE users SET state = ? WHERE id = ?', [state, id]);
  }

  async delete(id) {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = new UserRepository();