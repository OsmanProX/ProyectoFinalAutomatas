const pool = require('../config/db');

/**
 * Bitácora de accesos (tabla login_audit).
 * La tabla se crea sola la primera vez (también está en sql/create_login_audit.sql).
 * Las fechas se guardan en UTC (UTC_TIMESTAMP) y se leen como texto ISO para que
 * la hora sea la misma sin importar en qué servidor corra la app.
 */
const CREAR_TABLA = `
  CREATE TABLE IF NOT EXISTS login_audit (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    user_id       INT          NULL,
    nickname      VARCHAR(100) NULL,
    method        VARCHAR(20)  NOT NULL,
    success       TINYINT(1)   NOT NULL,
    detail        VARCHAR(40)  NULL,
    ip            VARCHAR(45)  NULL,
    forwarded_for VARCHAR(255) NULL,
    user_agent    VARCHAR(255) NULL,
    created_at    DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_login_audit_fecha (created_at),
    KEY idx_login_audit_usuario (user_id)
  )`;

let tablaLista = null;

class LoginAuditRepository {
  ensureTable() {
    if (!tablaLista) {
      tablaLista = pool.query(CREAR_TABLA).catch((err) => {
        tablaLista = null; // se reintenta en la próxima llamada
        throw err;
      });
    }
    return tablaLista;
  }

  async insert(registro) {
    await this.ensureTable();
    await pool.query(
      `INSERT INTO login_audit (user_id, nickname, method, success, detail, ip, forwarded_for, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [registro.userId, registro.nickname, registro.method, registro.success ? 1 : 0,
        registro.detail, registro.ip, registro.forwardedFor, registro.userAgent]
    );
  }

  /**
   * @param {{ nickname?: string, method?: string, success?: boolean, desde?: Date, hasta?: Date, limite?: number }} filtros
   */
  async find(filtros = {}) {
    await this.ensureTable();
    const condiciones = [];
    const valores = [];
    if (filtros.nickname) { condiciones.push('nickname LIKE ?'); valores.push(`%${filtros.nickname}%`); }
    if (filtros.method) { condiciones.push('method = ?'); valores.push(filtros.method); }
    if (typeof filtros.success === 'boolean') { condiciones.push('success = ?'); valores.push(filtros.success ? 1 : 0); }
    if (filtros.desde) { condiciones.push('created_at >= ?'); valores.push(aTextoUtc(filtros.desde)); }
    if (filtros.hasta) { condiciones.push('created_at < ?'); valores.push(aTextoUtc(filtros.hasta)); }
    const limite = Math.min(Math.max(Number(filtros.limite) || 200, 1), 1000);

    const [rows] = await pool.query(
      `SELECT id, user_id, nickname, method, success, detail, ip, forwarded_for, user_agent,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_utc
       FROM login_audit
       ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
       ORDER BY id DESC
       LIMIT ${limite}`,
      valores
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      nickname: r.nickname,
      method: r.method,
      success: r.success === 1 || r.success === true,
      detail: r.detail,
      ip: r.ip,
      forwardedFor: r.forwarded_for,
      userAgent: r.user_agent,
      createdAt: new Date(r.created_utc)
    }));
  }
}

/** Date -> "aaaa-mm-dd hh:mm:ss" en UTC (para comparar con created_at) */
function aTextoUtc(fecha) {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = new LoginAuditRepository();
