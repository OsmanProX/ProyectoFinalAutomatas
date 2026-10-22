-- Bitácora de accesos (auditoría de login): quién, cómo, cuándo y desde dónde.
-- La aplicación también la crea sola al primer registro (login-audit.repository.js).
-- Las fechas se guardan en UTC.
CREATE TABLE IF NOT EXISTS login_audit (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  user_id       INT          NULL,          -- usuario (si se identificó)
  nickname      VARCHAR(100) NULL,          -- apodo escrito o del usuario
  method        VARCHAR(20)  NOT NULL,      -- password | rostro | qr | api | logout
  success       TINYINT(1)   NOT NULL,      -- 1 = correcto, 0 = fallido
  detail        VARCHAR(40)  NULL,          -- motivo (invalid_credentials, face_not_match, recaptcha...)
  ip            VARCHAR(45)  NULL,          -- IPv4 o IPv6
  forwarded_for VARCHAR(255) NULL,          -- encabezado X-Forwarded-For (detrás de proxy)
  user_agent    VARCHAR(255) NULL,          -- navegador y sistema operativo
  created_at    DATETIME     NOT NULL,      -- UTC
  PRIMARY KEY (id),
  KEY idx_login_audit_fecha (created_at),
  KEY idx_login_audit_usuario (user_id)
);

-- Consulta de ejemplo: intentos fallidos de los últimos 7 días
-- SELECT nickname, method, detail, ip, created_at FROM login_audit
-- WHERE success = 0 AND created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY ORDER BY id DESC;
