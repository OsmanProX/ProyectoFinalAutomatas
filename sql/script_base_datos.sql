-- ============================================================================
-- PROYECTO FINAL - LENGUAJES FORMALES Y AUTÓMATAS (UMG 2026)
-- Script de base de datos: estructura completa + datos base (roles y permisos)
-- ============================================================================
-- Motor: MySQL 8.0 (base actual 8.0.37) o MariaDB 10.x · Motor de tablas: InnoDB
-- No incluye datos de usuarios reales (correos, teléfonos, fotos ni contraseñas).
-- Uso (MySQL Workbench): crear/seleccionar el esquema y ejecutar todo el script.
--   CREATE DATABASE IF NOT EXISTS automatas2026 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE automatas2026;
-- Orden de creación según las llaves foráneas:
--   roles -> users -> role_menu_permissions, user_credentials, user_photos,
--   password_resets -> login_audit, whatsapp_log (sin FK: bitácoras)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. ROLES: ADMIN, SUPERVISOR, ANALISTA (se activan/desactivan en "Roles y Permisos")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(45)  NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `active`      BIT(1)       NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. USERS: registro unificado de usuarios
--    password = hash bcrypt · photo = foto ORIGINAL (login facial, data URL)
--    state: 0 = inactivo (recién registrado), 1 = activo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name`           VARCHAR(150) NOT NULL,
  `password`            VARCHAR(200) NOT NULL,
  `state`               TINYINT(1)   NOT NULL DEFAULT '0' COMMENT '0=Inactive, 1=Active',
  `photo`               LONGTEXT     NOT NULL,
  `photo_edit`          LONGTEXT,
  `email`               VARCHAR(255) DEFAULT NULL,
  `phone`               VARCHAR(20)  DEFAULT NULL,
  `birth_date`          DATE         DEFAULT NULL,
  `nickname`            VARCHAR(150) DEFAULT NULL,
  `role`                ENUM('admin','supervisor','analitico') NOT NULL DEFAULT 'analitico' COMMENT 'Legado: el rol vigente es id_Roles',
  `id_Roles`            INT          NOT NULL,
  `notification_method` ENUM('whatsapp','correo_electronico','ambos') NOT NULL DEFAULT 'correo_electronico',
  `create_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emal_UNIQUE` (`email`),
  KEY `FK_id_Roles_idx` (`id_Roles`),
  CONSTRAINT `FK_id_Roles` FOREIGN KEY (`id_Roles`) REFERENCES `roles` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. ROLE_MENU_PERMISSIONS: qué opciones del menú ve cada rol
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_menu_permissions` (
  `id`       INT         NOT NULL AUTO_INCREMENT,
  `id_role`  INT         NOT NULL,
  `menu_key` VARCHAR(50) NOT NULL,
  `active`   BIT(1)      NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_menu` (`id_role`, `menu_key`),
  CONSTRAINT `fk_rmp_role` FOREIGN KEY (`id_role`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. USER_CREDENTIALS: credencial PDF con QR (1 por usuario)
--    qr_token_enc = secreto del QR cifrado (AES); el QR se valida contra él
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_credentials` (
  `user_id`         INT UNSIGNED NOT NULL,
  `credential_code` VARCHAR(20)  NOT NULL,
  `qr_token_enc`    VARCHAR(255) NOT NULL,
  `issued_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_channel`    VARCHAR(20)  DEFAULT NULL COMMENT 'correo_electronico | whatsapp | ambos',
  `sent_at`         DATETIME     DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `credential_code` (`credential_code`),
  CONSTRAINT `fk_user_credentials_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. USER_PHOTOS: foto MODIFICADA (filtros/stickers) para la barra de estado y la credencial
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_photos` (
  `user_id`        INT UNSIGNED NOT NULL,
  `photo_modified` MEDIUMTEXT   NOT NULL COMMENT 'Imagen en data URL (JPEG)',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_photos_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. PASSWORD_RESETS: código temporal para reiniciar la contraseña (hash SHA-256)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_resets` (
  `user_id`    INT UNSIGNED NOT NULL,
  `code_hash`  CHAR(64)     NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `attempts`   TINYINT      NOT NULL DEFAULT '0',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. LOGIN_AUDIT: bitácora auditable de accesos (quién, cómo, cuándo, desde dónde)
--    Sin FK a users a propósito: el registro se conserva aunque se borre el usuario
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_audit` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`       INT          DEFAULT NULL,
  `nickname`      VARCHAR(100) DEFAULT NULL,
  `method`        VARCHAR(20)  NOT NULL COMMENT 'password | rostro | qr | api | logout',
  `success`       TINYINT(1)   NOT NULL,
  `detail`        VARCHAR(40)  DEFAULT NULL,
  `ip`            VARCHAR(45)  DEFAULT NULL,
  `forwarded_for` VARCHAR(255) DEFAULT NULL,
  `user_agent`    VARCHAR(255) DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL COMMENT 'UTC',
  PRIMARY KEY (`id`),
  KEY `idx_login_audit_fecha` (`created_at`),
  KEY `idx_login_audit_usuario` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. WHATSAPP_LOG: envíos de WhatsApp y su estado (lo actualiza el webhook de Wawp)
--    No guarda el texto del mensaje; el teléfono va enmascarado
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `whatsapp_log` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`    INT          DEFAULT NULL,
  `tipo`       VARCHAR(30)  NOT NULL COMMENT 'credencial | reporte | codigo_recuperacion | ...',
  `proveedor`  VARCHAR(20)  NOT NULL COMMENT 'wawp | green-api | twilio',
  `destino`    VARCHAR(30)  DEFAULT NULL COMMENT '+502 ****1311',
  `message_id` VARCHAR(150) DEFAULT NULL,
  `estado`     VARCHAR(20)  NOT NULL COMMENT 'aceptado | enviado | entregado | leido | error | fallido',
  `ack`        TINYINT      DEFAULT NULL,
  `error`      VARCHAR(40)  DEFAULT NULL,
  `created_at` DATETIME     NOT NULL COMMENT 'UTC',
  `updated_at` DATETIME     NOT NULL COMMENT 'UTC',
  PRIMARY KEY (`id`),
  KEY `idx_whatsapp_log_mensaje` (`message_id`),
  KEY `idx_whatsapp_log_fecha` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- DATOS BASE
-- ============================================================================
-- Roles (los ids 3, 4 y 5 son los que usa la base actual)
INSERT IGNORE INTO `roles` (`id`, `name`, `description`, `active`) VALUES
  (3, 'ADMIN',      'Gestión de usuarios, roles y parametrizaciones del sistema, perfil', b'1'),
  (4, 'SUPERVISOR', 'Dashboard de ventas, entregas, perfil',                               b'1'),
  (5, 'ANALISTA',   'Análisis, gestión de perfil',                                         b'1');

-- Permisos de menú por rol (1 = visible, 0 = oculto)
INSERT IGNORE INTO `role_menu_permissions` (`id_role`, `menu_key`, `active`) VALUES
  (3, 'inicio', b'1'), (3, 'usuarios', b'1'), (3, 'analisis', b'1'), (3, 'perfil', b'1'), (3, 'roles', b'1'),
  (4, 'inicio', b'1'), (4, 'usuarios', b'0'), (4, 'analisis', b'0'), (4, 'perfil', b'1'), (4, 'roles', b'1'),
  (5, 'inicio', b'1'), (5, 'usuarios', b'0'), (5, 'analisis', b'1'), (5, 'perfil', b'1'), (5, 'roles', b'1');

-- Primer administrador: registrarse desde la página (/register) y luego ejecutar
--   UPDATE users SET state = 1, id_Roles = 3 WHERE nickname = 'tu_apodo';
