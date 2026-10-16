-- ============================================================================
-- Migracion: tabla roles + users.id_role (FK) + eliminar photo_edit
-- Ejecutar en MySQL Workbench: seleccionar el esquema y correr este script
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Crear tabla roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL,
    description VARCHAR(255) NULL,
    active      BIT(1)       NOT NULL DEFAULT b'1',
    PRIMARY KEY (id),
    CONSTRAINT uq_roles_name UNIQUE (name)
);

-- ----------------------------------------------------------------------------
-- 2. Insertar los roles que ya existen como enum
-- ----------------------------------------------------------------------------
INSERT INTO roles (id, name, description, active) VALUES
(1, 'ADMIN',      'Gestión de usuarios, roles y parametrizaciones del sistema, perfil', b'1'),
(2, 'SUPERVISOR', 'Dashboard de ventas, entregas, perfil',                              b'1'),
(4, 'ANALISTA',   'Análisis, gestión de perfil',                                        b'1');

-- ----------------------------------------------------------------------------
-- 3. Agregar columna id_role en users (NULL temporalmente para la migracion)
-- ----------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN id_role INT UNSIGNED NULL AFTER nickname;

-- ----------------------------------------------------------------------------
-- 4. Migrar datos: mapear el enum viejo (admin/supervisor/analitico)
--    al id del rol nuevo (ADMIN=1, SUPERVISOR=2, ANALISTA=4)
-- ----------------------------------------------------------------------------
UPDATE users SET id_role = 1 WHERE role = 'admin';
UPDATE users SET id_role = 2 WHERE role = 'supervisor';
UPDATE users SET id_role = 4 WHERE role = 'analitico';

-- ----------------------------------------------------------------------------
-- 5. Respaldo: usuarios sin mapeo quedan como ANALISTA
-- ----------------------------------------------------------------------------
UPDATE users SET id_role = 4 WHERE id_role IS NULL;

-- ----------------------------------------------------------------------------
-- 6. id_role pasa a NOT NULL
-- ----------------------------------------------------------------------------
ALTER TABLE users
    MODIFY COLUMN id_role INT UNSIGNED NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. Agregar llave foranea users.id_role -> roles.id
-- ----------------------------------------------------------------------------
ALTER TABLE users
    ADD CONSTRAINT fk_users_role
    FOREIGN KEY (id_role) REFERENCES roles(id);

-- ----------------------------------------------------------------------------
-- 8. Eliminar columna role (enum vieja)
-- ----------------------------------------------------------------------------
ALTER TABLE users DROP COLUMN role;

-- ----------------------------------------------------------------------------
-- 9. Eliminar columna photo_edit (ya no se usa)
-- ----------------------------------------------------------------------------
ALTER TABLE users DROP COLUMN photo_edit;

-- ----------------------------------------------------------------------------
-- Verificacion:
--   SELECT * FROM roles;
--   SELECT u.id, u.nickname, r.name AS role
--   FROM users u INNER JOIN roles r ON r.id = u.id_role;
-- ----------------------------------------------------------------------------
