-- ============================================================================
-- Fotografía MODIFICADA del usuario (filtros / stickers / marcos)
-- ----------------------------------------------------------------------------
-- users.photo           -> foto ORIGINAL recortada (se usa para el login facial)
-- user_photos.photo_*   -> foto MODIFICADA (barra de estado del sitio y credencial)
--
-- Se usa una tabla aparte para NO alterar la estructura de la tabla users,
-- que es compartida por todos los sitios del proyecto.
-- Ejecutar en MySQL Workbench sobre el mismo esquema donde está users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_photos (
  user_id         INT          NOT NULL PRIMARY KEY,
  photo_modified  MEDIUMTEXT   NOT NULL,               -- imagen en formato data URL (JPEG)
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Si aparece el error 3780 (tipos incompatibles en la llave foránea), revise el
-- tipo de users.id con:  SHOW COLUMNS FROM users;  y use el mismo en user_id
-- (por ejemplo INT UNSIGNED).
--
-- Nota: si la columna users.photo es de tipo TEXT (máximo 64 KB) las fotos pueden
-- no caber. Verifique con SHOW COLUMNS FROM users; y, de acuerdo con el grupo,
-- cámbiela a MEDIUMTEXT:
--   ALTER TABLE users MODIFY COLUMN photo MEDIUMTEXT NULL;
