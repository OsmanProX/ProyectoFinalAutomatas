const pool = require('../config/db');

/**
 * Códigos de reinicio de contraseña (tabla password_resets).
 */
class PasswordResetRepository {
  /** Busca el id del usuario por apodo o por correo */
  async findUserIdByIdentifier(identificador) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE nickname = ? OR email = ? LIMIT 1',
      [identificador, identificador]
    );
    return rows[0] ? rows[0].id : null;
  }

  /** Guarda (o reemplaza) el código vigente del usuario */
  async save(userId, codeHash, minutosVigencia) {
    await pool.query(
      `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, NOW())
       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), attempts = 0, created_at = NOW()`,
      [userId, codeHash, minutosVigencia]
    );
  }

  async findByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT user_id, code_hash, attempts,
              (expires_at < NOW()) AS vencido,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) AS segundos
         FROM password_resets WHERE user_id = ?`,
      [userId]
    );
    const r = rows[0];
    return r ? { userId: r.user_id, codeHash: r.code_hash, attempts: r.attempts, expired: Boolean(r.vencido), ageSeconds: Number(r.segundos) } : null;
  }

  async incrementAttempts(userId) {
    await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?', [userId]);
  }

  async delete(userId) {
    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);
  }
}

module.exports = new PasswordResetRepository();
