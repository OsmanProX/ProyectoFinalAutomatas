# Estado de entrega de WhatsApp (webhook, sin polling)

Cada WhatsApp que envía el sistema (credencial, reporte de análisis, código y aviso de recuperación)
queda en la tabla `whatsapp_log` con el id que devuelve Wawp. **No se consulta a Wawp cada cierto
tiempo (polling):** Wawp le avisa al servidor con un `POST` cada vez que cambia el estado del mensaje
(evento `message.ack`), y el sistema actualiza ese registro.

| Estado | Significado |
|---|---|
| Aceptado por Wawp | El proveedor recibió el envío |
| Enviado (ack 1) | Llegó a los servidores de WhatsApp |
| Entregado (ack 2) | Llegó al teléfono (doble check) |
| Leído (ack 3) | El usuario lo abrió (check azul) |
| No se envió | Falló antes de salir (sin cupo, teléfono inválido…) |

Se ve en **Bitácora de accesos → Envíos de WhatsApp** (solo ADMIN) y en `GET /api/audit/whatsapp` (JWT, ADMIN).
No se guarda el texto de los mensajes y el teléfono se guarda enmascarado (`+502 ****1311`).

## Configuración (una sola vez, con el sitio ya publicado)
1. En `.env` y en el panel del hosting: `WAWP_WEBHOOK_SECRET=` una clave de al menos 16 caracteres
   (por ejemplo, generada con `bun -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`).
2. En **app.wawp.net → Dev Tools & API → Webhooks**, agregar la URL
   `https://codemac.site/webhooks/wawp/<WAWP_WEBHOOK_SECRET>` y marcar **solo** el evento `message.ack`.
3. Reiniciar la aplicación.

Wawp no firma los avisos, por eso la URL lleva la clave secreta: sin la clave correcta el servidor responde
404 y no cambia nada. Los demás eventos (mensajes de chats personales, etc.) se ignoran y no se guardan.
En `localhost` el webhook no recibe avisos (Wawp necesita una URL pública); los envíos se registran igual
y quedan en estado "Aceptado por Wawp".
