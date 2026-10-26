const pool = require('../config/db');

/**
 * Registro de envíos de WhatsApp (tabla whatsapp_log) y su estado de entrega.
 * - Cada envío se guarda con el id del mensaje que devuelve el proveedor.
 * - El estado se actualiza SOLO cuando Wawp avisa por webhook (message.ack):
 *   no se consulta a Wawp periódicamente (sin polling).
 * - No se guarda el texto del mensaje y el teléfono se guarda enmascarado.
 * La tabla se crea sola la primera vez (también está en sql/create_whatsapp_log.sql).
 */
const CREAR_TABLA = `
  CREATE TABLE IF NOT EXISTS whatsapp_log (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     INT          NULL,
    tipo        VARCHAR(30)  NOT NULL,
    proveedor   VARCHAR(20)  NOT NULL,
    destino     VARCHAR(30)  NULL,
    message_id  VARCHAR(150) NULL,
    estado      VARCHAR(20)  NOT NULL,
    ack         TINYINT      NULL,
    error       VARCHAR(40)  NULL,
    created_at  DATETIME     NOT NULL,
    updated_at  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_whatsapp_log_mensaje (message_id),
    KEY idx_whatsapp_log_fecha (created_at)
  )`;

let tablaLista = null;

class WhatsappLogRepository {
  ensureTable() {
    if (!tablaLista) {
      tablaLista = pool.query(CREAR_TABLA).catch((err) => {
        tablaLista = null;
        throw err;
      });
    }
    return tablaLista;
  }

  async insert(r) {
    await this.ensureTable();
    await pool.query(
      `INSERT INTO whatsapp_log (user_id, tipo, proveedor, destino, message_id, estado, ack, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [r.userId, r.tipo, r.proveedor, r.destino, r.messageId, r.estado, r.error]
    );
  }

  /**
   * Actualiza el estado con el aviso del webhook. Solo avanza (enviado -> entregado -> leído);
   * un aviso viejo que llega tarde no regresa el estado. Un error (-1) siempre se registra.
   * @returns {Promise<number>} filas actualizadas
   */
  async updateAck(messageId, ack, estado) {
    await this.ensureTable();
    const corto = String(messageId).split('_').pop();
    const [resultado] = await pool.query(
      `UPDATE whatsapp_log
       SET ack = ?, estado = ?, updated_at = UTC_TIMESTAMP()
       WHERE (message_id = ? OR message_id LIKE ?)
         AND (ack IS NULL OR ack < ? OR ? < 0)`,
      [ack, estado, messageId, `%\\_${corto.replace(/[%_\\]/g, '')}`, ack, ack]
    );
    return resultado.affectedRows || 0;
  }

  async find({ limite = 50 } = {}) {
    await this.ensureTable();
    const max = Math.min(Math.max(Number(limite) || 50, 1), 500);
    const [rows] = await pool.query(
      `SELECT id, user_id, tipo, proveedor, destino, message_id, estado, ack, error,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_utc,
              DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_utc
       FROM whatsapp_log ORDER BY id DESC LIMIT ${max}`
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      tipo: r.tipo,
      proveedor: r.proveedor,
      destino: r.destino,
      messageId: r.message_id,
      estado: r.estado,
      ack: r.ack,
      error: r.error,
      createdAt: new Date(r.created_utc),
      updatedAt: new Date(r.updated_utc)
    }));
  }
}

module.exports = new WhatsappLogRepository();
