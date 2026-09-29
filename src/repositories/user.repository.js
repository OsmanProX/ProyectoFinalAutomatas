const pool = require('../config/db');
const User = require('../models/User');

class UserRepository {
  async findByNickname(nickname) {
    const [rows] = await pool.query('SELECT * FROM users WHERE nickname = ?', [nickname]);
    return User.fromRow(rows[0]);
  }

  async findWithPhoto(nickname) {
    const [rows] = await pool.query(
      'SELECT id, full_name, nickname, state, role, notification_method, photo FROM users WHERE nickname = ?',
      [nickname]
    );
    return User.fromRow(rows[0]);
  }

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return User.fromRow(rows[0]);
  }

  async findAll() {
    const [rows] = await pool.query(
      'SELECT id, full_name, nickname, role, notification_method, state, create_at FROM users ORDER BY create_at DESC'
    );
    return User.fromRows(rows);
  }

  async create(user) {
    const [result] = await pool.query(
      'INSERT INTO users (full_name, nickname, password, state, role, notification_method, photo, email, phone, birth_date) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)',
      [
        user.fullName,
        user.nickname,
        user.password,
        user.role,
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
