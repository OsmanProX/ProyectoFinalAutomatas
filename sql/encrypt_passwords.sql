-- Script para encriptar contraseñas existentes en texto plano
-- Ejecutar: source C:/Users/tobia/Desktop/Programas/BUN/ProyectoFinal_Automatas/sql/encrypt_passwords.sql

-- 1. Crear tabla temporal con las contraseñas ya encriptadas
CREATE TEMPORARY TABLE tmp_users_encrypted AS
SELECT id, password FROM users;

-- 2. Actualizar cada contraseña con su hash bcrypt
-- Nota: esto es un ejemplo manual. En Bun se ejecuta con el script de abajo.
-- Si prefieres hacerlo desde la app, ejecuta: bun run src/scripts/encrypt.js
