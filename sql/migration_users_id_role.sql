-- ============================================================================
-- Migracion: users.role (enum) -> users.id_role (FK a roles.id)
-- Requisito: la tabla roles ya debe existir con los 3 roles insertados
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Agregar columna id_role (NULL temporalmente para la migracion)
-- ----------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN id_role INT UNSIGNED NULL AFTER nickname;

-- ----------------------------------------------------------------------------
-- 2. Migrar datos: enum viejo -> id del rol nuevo
--    admin      -> 1 (ADMIN)
--    supervisor -> 2 (SUPERVISOR)
--    analitico  -> 4 (ANALISTA)
-- ----------------------------------------------------------------------------
UPDATE users SET id_role = 1 WHERE role = 'admin';
UPDATE users SET id_role = 2 WHERE role = 'supervisor';
UPDATE users SET id_role = 4 WHERE role = 'analitico';

-- ----------------------------------------------------------------------------
-- 3. Respaldo: usuarios sin mapeo quedan como ANALISTA (4)
-- ----------------------------------------------------------------------------
UPDATE users SET id_role = 4 WHERE id_role IS NULL;

-- ----------------------------------------------------------------------------
-- 4. id_role pasa a NOT NULL
-- ----------------------------------------------------------------------------
ALTER TABLE users
    MODIFY COLUMN id_role INT UNSIGNED NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. Agregar llave foranea users.id_role -> roles.id
-- ----------------------------------------------------------------------------
ALTER TABLE users
    ADD CONSTRAINT fk_users_role
    FOREIGN KEY (id_role) REFERENCES roles(id);

-- ----------------------------------------------------------------------------
-- 6. Eliminar columna role (enum vieja)
-- ----------------------------------------------------------------------------
ALTER TABLE users DROP COLUMN role;

-- ----------------------------------------------------------------------------
-- 7. Eliminar columna photo_edit (ya no se usa)
-- ----------------------------------------------------------------------------
ALTER TABLE users DROP COLUMN photo_edit;

-- ----------------------------------------------------------------------------
-- Verificacion:
--   SELECT u.id, u.nickname, r.name AS rol
--   FROM users u INNER JOIN roles r ON r.id = u.id_role;
-- ----------------------------------------------------------------------------
