-- ============================================================================
-- Crear tabla role_menu_permissions
-- Controla que opciones del sidebar puede ver/usar cada rol
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_menu_permissions (
    id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_role  INT UNSIGNED NOT NULL,
    menu_key VARCHAR(50)  NOT NULL,
    active   BIT(1)       NOT NULL DEFAULT b'1',
    PRIMARY KEY (id),
    CONSTRAINT uq_role_menu UNIQUE (id_role, menu_key),
    CONSTRAINT fk_rmp_role FOREIGN KEY (id_role) REFERENCES roles (id) ON DELETE CASCADE
);

-- Permisos por defecto: todos los menus activos para cada rol existente
-- (INSERT IGNORE respeta configuraciones ya guardadas por el admin)
INSERT IGNORE INTO role_menu_permissions (id_role, menu_key, active)
SELECT r.id, m.menu_key, b'1'
FROM roles r
CROSS JOIN (
    SELECT 'inicio'   AS menu_key UNION ALL
    SELECT 'usuarios' UNION ALL
    SELECT 'analisis' UNION ALL
    SELECT 'perfil'   UNION ALL
    SELECT 'roles'
) m;

-- Verificacion
-- SELECT * FROM role_menu_permissions;
