const crypto = require('crypto');
const express = require('express');
const whatsappLogRepository = require('../repositories/whatsapp-log.repository');

/**
 * ============================================================================
 * WEBHOOK DE WAWP: estado de entrega de los WhatsApp (sin polling)
 * ============================================================================
 * En vez de preguntarle a Wawp cada cierto tiempo si el mensaje llegó (polling),
 * Wawp nos AVISA con un POST cada vez que cambia el estado (evento message.ack):
 *   1 = enviado (llegó al servidor de WhatsApp) · 2 = entregado · 3 = leído
 *
 * URL a configurar en Wawp (Dev Tools & API > Webhooks), solo el evento message.ack:
 *   https://<dominio>/webhooks/wawp/<WAWP_WEBHOOK_SECRET>
 * Wawp no firma los avisos, por eso la URL lleva una clave secreta (en .env);
 * sin la clave correcta se responde 404 y no se toca nada.
 * Nunca se guarda el contenido de los mensajes: solo el estado.
 * ============================================================================
 */
const router = express.Router();

const ESTADO_POR_ACK = Object.freeze({ '-1': 'error', 0: 'pendiente', 1: 'enviado', 2: 'entregado', 3: 'leido', 4: 'reproducido' });

function claveValida(recibida) {
  const esperada = process.env.WAWP_WEBHOOK_SECRET;
  if (!esperada || esperada.length < 16 || typeof recibida !== 'string') return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/wawp/:clave', express.json({ limit: '1mb' }), async (req, res) => {
  if (!claveValida(req.params.clave)) return res.status(404).end();

  const evento = req.body || {};
  // Solo interesa el acuse de recibo; cualquier otro evento (mensajes de chats, etc.) se ignora
  if (evento.event !== 'message.ack' || !evento.payload || !evento.payload.id) {
    return res.json({ ok: true, ignorado: true });
  }

  const ack = Number(evento.payload.ack);
  if (!Number.isInteger(ack) || !(String(ack) in ESTADO_POR_ACK)) return res.json({ ok: true, ignorado: true });

  try {
    const filas = await whatsappLogRepository.updateAck(String(evento.payload.id).slice(0, 150), ack, ESTADO_POR_ACK[ack]);
    return res.json({ ok: true, actualizado: filas > 0 });
  } catch (err) {
    console.error('Webhook Wawp: no se pudo actualizar el estado:', err.message);
    // 200 igual: el error es nuestro y reintentar no lo arregla
    return res.json({ ok: false });
  }
});

// JSON mal formado -> 400 sin detalles
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => res.status(400).json({ ok: false }));

module.exports = router;
module.exports.ESTADO_POR_ACK = ESTADO_POR_ACK;
