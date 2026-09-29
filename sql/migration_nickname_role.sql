-- ============================================================================
-- Migracion: nickname como identidad de acceso + rol + metodo de notificacion
-- Ejecutar en MySQL Workbench: seleccionar el esquema y correr este script
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Los usuarios sin apodo heredan su username actual (antes de eliminarlo)
-- ----------------------------------------------------------------------------
UPDATE users
SET nickname = username
WHERE nickname IS NULL OR TRIM(nickname) = '';

-- ----------------------------------------------------------------------------
-- 2. Los que siguen sin apodo no se pueden migrar, se eliminan
-- ----------------------------------------------------------------------------
DELETE FROM users
WHERE nickname IS NULL OR TRIM(nickname) = '';

-- ----------------------------------------------------------------------------
-- 3. nickname pasa a ser obligatorio
-- ----------------------------------------------------------------------------
ALTER TABLE users
  MODIFY COLUMN nickname VARCHAR(45) NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. nickname es la nueva identidad de acceso
-- ----------------------------------------------------------------------------
ALTER TABLE users
  ADD CONSTRAINT uq_users_nickname UNIQUE (nickname);

-- ----------------------------------------------------------------------------
-- 5. Se elimina username
--    MySQL elimina solo el indice unico de esta columna.
--    Si aparece error 1091, ejecuta antes: ALTER TABLE users DROP INDEX UNI;
-- ----------------------------------------------------------------------------
ALTER TABLE users
  DROP COLUMN username;

-- ----------------------------------------------------------------------------
-- 6. Rol (NOT NULL, 3 valores permitidos)
--    admin       = Administrador
--    supervisor  = Supervisor
--    analitico   = Analitico
-- ----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN role ENUM('admin', 'supervisor', 'analitico') NOT NULL DEFAULT 'analitico' AFTER nickname;

-- ----------------------------------------------------------------------------
-- 7. Metodo de notificacion (NOT NULL, 3 valores permitidos)
--    whatsapp           = Solo WhatsApp
--    correo_electronico = Solo Correo Electronico
--    ambos              = Ambos tipos
-- ----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN notification_method ENUM('whatsapp', 'correo_electronico', 'ambos') NOT NULL DEFAULT 'correo_electronico' AFTER role;

-- ----------------------------------------------------------------------------
-- 8. Verificacion: SHOW COLUMNS FROM users;
-- ----------------------------------------------------------------------------
