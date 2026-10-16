-- ============================================================================
-- Credencial / constancia de inscripción del usuario (PDF con código QR)
-- ----------------------------------------------------------------------------
-- credential_code : número visible en la credencial (ej. LFA-2026-00016)
-- qr_token_enc    : secreto del código QR CIFRADO con AES-256-GCM (nunca en texto plano)
-- El QR sirve para iniciar sesión; al generar una credencial nueva, el QR anterior
-- deja de funcionar.
-- Ejecutar una sola vez:  bun run src/scripts/create-user-credentials.js
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id          INT           NOT NULL PRIMARY KEY,
  credential_code  VARCHAR(20)   NOT NULL UNIQUE,
  qr_token_enc     VARCHAR(255)  NOT NULL,
  issued_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_channel     VARCHAR(20)   NULL,                 -- correo_electronico | whatsapp | ambos
  sent_at          DATETIME      NULL,
  CONSTRAINT fk_user_credentials_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
