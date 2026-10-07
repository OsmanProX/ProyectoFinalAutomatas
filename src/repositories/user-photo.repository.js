const pool = require('../config/db');

/**
 * Fotografías del usuario.
 *  - Original:   users.photo        (login facial)
 *  - Modificada: user_photos.photo_modified (barra de estado y credencial)
 */
class UserPhotoRepository {
  /** Crea o reemplaza la foto modificada del usuario */
  async saveModified(userId, photoModified) {
    await pool.query(
      `INSERT INTO user_photos (user_id, photo_modified) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE photo_modified = VALUES(photo_modified)`,
      [userId, photoModified]
    );
  }

  /** @returns {{ original: string|null, modified: string|null } | null} */
  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT u.photo AS original, p.photo_modified AS modified
         FROM users u
         LEFT JOIN user_photos p ON p.user_id = u.id
        WHERE u.id = ?`,
      [userId]
    );
    return rows[0] || null;
  }
}

module.exports = new UserPhotoRepository();
