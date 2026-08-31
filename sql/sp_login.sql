-- Stored Procedure: sp_login
-- Busca usuario por username y valida contraseña en texto plano
-- Ejecutar en MySQL: source C:/Users/tobia/Desktop/Programas/BUN/ProyectoFinal_Automatas/sql/sp_login.sql

DROP PROCEDURE IF EXISTS sp_login;

DELIMITER //

CREATE PROCEDURE sp_login(
    IN p_username VARCHAR(50),
    IN p_password VARCHAR(255)
)
BEGIN
    SELECT id, full_name, username, state
    FROM users
    WHERE username = p_username
      AND password = p_password
      AND state = 1;
END //

DELIMITER ;
