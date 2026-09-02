const pool = require('../config/db');
const User = require('../models/User');

class UserRepository {
  async findByUsername(username) {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    return User.fromRow(rows[0]);
  }

  async findWithPhoto(username) {
    const [rows] = await pool.query(
      'SELECT id, full_name, username, state, photo FROM users WHERE username = ?',
      [username]
    );
    return User.fromRow(rows[0]);
  }

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return User.fromRow(rows[0]);
  }

  async findAll() {
    const [rows] = await pool.query('SELECT id, full_name, username, state, create_at FROM users');
    return User.fromRows(rows);
  }

  async create(fullName, username, password) {
    const [result] = await pool.query(
      'INSERT INTO users (full_name, username, password, state) VALUES (?, ?, ?, 1)',
      [fullName, username, password]
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
