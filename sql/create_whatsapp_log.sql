-- Registro de envíos de WhatsApp y su estado de entrega.
-- El estado lo actualiza el webhook de Wawp (evento message.ack): no hay polling.
-- La aplicación también la crea sola al primer envío (whatsapp-log.repository.js).
CREATE TABLE IF NOT EXISTS whatsapp_log (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     INT          NULL,          -- usuario destinatario (si aplica)
  tipo        VARCHAR(30)  NOT NULL,      -- credencial | credencial_nueva | reporte | codigo_recuperacion | aviso_recuperacion
  proveedor   VARCHAR(20)  NOT NULL,      -- wawp | green-api | twilio
  destino     VARCHAR(30)  NULL,          -- teléfono enmascarado: +502 ****1311
  message_id  VARCHAR(150) NULL,          -- id que devuelve el proveedor (para el webhook)
  estado      VARCHAR(20)  NOT NULL,      -- aceptado | enviado | entregado | leido | error | fallido
  ack         TINYINT      NULL,          -- último acuse de Wawp: -1 error, 1 enviado, 2 entregado, 3 leído
  error       VARCHAR(40)  NULL,          -- motivo si falló (whatsapp_cuota, telefono_invalido...)
  created_at  DATETIME     NOT NULL,      -- UTC
  updated_at  DATETIME     NOT NULL,      -- UTC, último aviso del webhook
  PRIMARY KEY (id),
  KEY idx_whatsapp_log_mensaje (message_id),
  KEY idx_whatsapp_log_fecha (created_at)
);
