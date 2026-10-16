-- ============================================================================
-- Crear tabla roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL,
    description VARCHAR(255) NULL,
    active      BIT(1)       NOT NULL DEFAULT b'1',
    PRIMARY KEY (id),
    CONSTRAINT uq_roles_name UNIQUE (name)
);

-- Datos iniciales
INSERT INTO roles (id, name, description, active) VALUES
(1, 'ADMIN',      'Gestión de usuarios, roles y parametrizaciones del sistema, perfil', b'1'),
(2, 'SUPERVISOR', 'Dashboard de ventas, entregas, perfil',                              b'1'),
(4, 'ANALISTA',   'Análisis, gestión de perfil',                                        b'1');

-- Verificacion
-- SELECT * FROM roles;
