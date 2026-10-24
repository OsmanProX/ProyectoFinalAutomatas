/**
 * Pruebas: registro de envíos de WhatsApp y webhook de estado de Wawp (sin polling).
 * Ejecutar con:  bun test
 */
const { describe, test, expect, beforeAll, afterAll, mock } = require('bun:test');
const path = require('path');

const insertados = [];
const actualizados = [];
mock.module(path.join(__dirname, '..', 'src', 'repositories', 'whatsapp-log.repository.js'), () => ({
  insert: async (r) => { insertados.push(r); },
  updateAck: async (id, ack, estado) => { actualizados.push({ id, ack, estado }); return 1; },
  find: async () => [],
  ensureTable: async () => {}
}));

const express = require('express');
const messaging = require('../src/services/messaging.service');
const webhookRoutes = require('../src/routes/webhook.routes');

const CLAVE = 'clave_webhook_de_prueba_123';
let server;
let base;
const fetchReal = global.fetch;

beforeAll(async () => {
  process.env.WAWP_WEBHOOK_SECRET = CLAVE;
  const app = express();
  app.use('/webhooks', webhookRoutes);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/webhooks/wawp`;
});
afterAll(() => {
  if (server) server.close();
  global.fetch = fetchReal;
});

const avisar = (clave, cuerpo) => fetchReal(`${base}/${clave}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
});

describe('Registro de envíos de WhatsApp', () => {
  test('teléfono enmascarado e id del mensaje de Wawp y Green-API', () => {
    expect(messaging.enmascararTelefono('+50258381311')).toBe('+502 ****1311');
    expect(messaging.idDelMensaje({ id: { _serialized: 'true_50258381311@c.us_ABC' } })).toBe('true_50258381311@c.us_ABC');
    expect(messaging.idDelMensaje({ idMessage: 'BAE5F4' })).toBe('BAE5F4');
    expect(messaging.idDelMensaje(undefined)).toBeNull();
  });

  test('un envío correcto queda "aceptado" con su id; uno fallido queda "fallido"', async () => {
    process.env.WAWP_INSTANCE_ID = '1';
    process.env.WAWP_ACCESS_TOKEN = 't';
    global.fetch = async () => ({ ok: true, json: async () => ({ id: { _serialized: 'true_50258381311@c.us_XYZ' } }) });
    await messaging.sendWhatsApp({ to: '58381311', body: 'Hola', tipo: 'reporte', userId: 7 });
    global.fetch = async () => ({ ok: false, status: 429, text: async () => 'limite' });
    await expect(messaging.sendWhatsApp({ to: '58381311', body: 'Hola', tipo: 'reporte', userId: 7 })).rejects.toThrow('whatsapp_cuota');
    await new Promise((r) => setTimeout(r, 10));

    expect(insertados[0]).toMatchObject({ estado: 'aceptado', messageId: 'true_50258381311@c.us_XYZ', tipo: 'reporte', userId: 7, proveedor: 'wawp', destino: '+502 ****1311' });
    expect(insertados[1]).toMatchObject({ estado: 'fallido', error: 'whatsapp_cuota', messageId: null });
    expect(JSON.stringify(insertados)).not.toContain('Hola'); // no se guarda el texto
    global.fetch = fetchReal;
  });
});

describe('Webhook de Wawp (message.ack)', () => {
  test('sin la clave correcta responde 404 y no actualiza nada', async () => {
    const r = await avisar('clave_incorrecta_000000000', { event: 'message.ack', payload: { id: 'X', ack: 3 } });
    expect(r.status).toBe(404);
    expect(actualizados.length).toBe(0);
  });

  test('actualiza el estado: 2 = entregado, 3 = leído', async () => {
    await avisar(CLAVE, { event: 'message.ack', payload: { id: 'true_50258381311@c.us_XYZ', ack: 2, ackName: 'DEVICE' } });
    await avisar(CLAVE, { event: 'message.ack', payload: { id: 'true_50258381311@c.us_XYZ', ack: 3, ackName: 'READ' } });
    expect(actualizados).toEqual([
      { id: 'true_50258381311@c.us_XYZ', ack: 2, estado: 'entregado' },
      { id: 'true_50258381311@c.us_XYZ', ack: 3, estado: 'leido' }
    ]);
  });

  test('ignora otros eventos (mensajes de chats) y JSON roto', async () => {
    const r = await avisar(CLAVE, { event: 'message.any', payload: { id: 'Y', body: 'chat personal' } });
    expect((await r.json()).ignorado).toBe(true);
    const roto = await fetchReal(`${base}/${CLAVE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"event":' });
    expect(roto.status).toBe(400);
    expect(actualizados.length).toBe(2);
  });
});
