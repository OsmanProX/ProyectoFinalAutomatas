-- ============================================================================
-- Códigos para reiniciar la contraseña (uno vigente por usuario)
-- ----------------------------------------------------------------------------
-- code_hash  : HMAC-SHA256 del código de 6 dígitos (nunca se guarda el código)
-- expires_at : el código vence a los 10 minutos
-- attempts   : intentos fallidos (al llegar a 5 el código se anula)
-- Ejecutar una sola vez:  bun run src/scripts/create-password-resets.js
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_resets (
  user_id     INT          NOT NULL PRIMARY KEY,
  code_hash   CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  attempts    TINYINT      NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
