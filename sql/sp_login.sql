-- Stored Procedure: sp_login
-- Busca usuario por nickname y valida contrasena
-- Ejecutar en MySQL: source C:/Users/tobia/Desktop/Programas/BUN/ProyectoFinal_Automatas/sql/sp_login.sql

DROP PROCEDURE IF EXISTS sp_login;

DELIMITER //

CREATE PROCEDURE sp_login(
    IN p_nickname VARCHAR(45),
    IN p_password VARCHAR(255)
)
BEGIN
    SELECT id, full_name, nickname, role, state
    FROM users
    WHERE nickname = p_nickname
      AND password = p_password
      AND state = 1;
END //

DELIMITER ;
