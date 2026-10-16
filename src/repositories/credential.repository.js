const pool = require('../config/db');

/**
 * Credenciales (constancia de inscripción con QR) de los usuarios.
 */
class CredentialRepository {
  /** Crea o reemplaza la credencial del usuario (el QR anterior deja de servir) */
  async save(userId, credentialCode, qrTokenEnc) {
    await pool.query(
      `INSERT INTO user_credentials (user_id, credential_code, qr_token_enc, issued_at, sent_channel, sent_at)
       VALUES (?, ?, ?, NOW(), NULL, NULL)
       ON DUPLICATE KEY UPDATE qr_token_enc = VALUES(qr_token_enc), issued_at = NOW(), sent_channel = NULL, sent_at = NULL`,
      [userId, credentialCode, qrTokenEnc]
    );
  }

  async findByUserId(userId) {
    const [rows] = await pool.query(
      'SELECT user_id, credential_code, qr_token_enc, issued_at, sent_channel, sent_at FROM user_credentials WHERE user_id = ?',
      [userId]
    );
    const r = rows[0];
    return r ? {
      userId: r.user_id,
      credentialCode: r.credential_code,
      qrTokenEnc: r.qr_token_enc,
      issuedAt: r.issued_at,
      sentChannel: r.sent_channel,
      sentAt: r.sent_at
    } : null;
  }

  async markSent(userId, channel) {
    await pool.query('UPDATE user_credentials SET sent_channel = ?, sent_at = NOW() WHERE user_id = ?', [channel, userId]);
  }
}

module.exports = new CredentialRepository();
