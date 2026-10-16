const pool = require('../config/db');

/**
 * Datos que el propio usuario puede cambiar desde Gestión de Perfil.
 * (Solo se actualizan filas; la estructura de la tabla users no cambia.)
 */
class ProfileRepository {
  async findPasswordHash(userId) {
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    return rows[0] ? rows[0].password : null;
  }

  async updatePassword(userId, hash) {
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
  }

  /** Foto ORIGINAL (la que usa el login facial) */
  async updateOriginalPhoto(userId, photo) {
    await pool.query('UPDATE users SET photo = ? WHERE id = ?', [photo, userId]);
  }
}

module.exports = new ProfileRepository();
