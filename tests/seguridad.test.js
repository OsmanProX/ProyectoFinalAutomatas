/**
 * Pruebas unitarias: reCAPTCHA y bitácora de accesos.
 * Ejecutar con:  bun test
 */
const { describe, test, expect, afterEach } = require('bun:test');
const recaptcha = require('../src/services/recaptcha.service');
const { clientIp, describeAgent } = require('../src/services/login-audit.service');
const { leerFiltros } = require('../src/controllers/audit.controller');

const fetchReal = global.fetch;
const claves = {
  site: process.env.RECAPTCHA_SITE_KEY,
  secret: process.env.RECAPTCHA_SECRET_KEY,
  version: process.env.RECAPTCHA_VERSION,
  minScore: process.env.RECAPTCHA_MIN_SCORE
};
afterEach(() => {
  global.fetch = fetchReal;
  process.env.RECAPTCHA_SITE_KEY = claves.site || '';
  process.env.RECAPTCHA_SECRET_KEY = claves.secret || '';
  process.env.RECAPTCHA_VERSION = claves.version || '';
  process.env.RECAPTCHA_MIN_SCORE = claves.minScore || '';
});

describe('reCAPTCHA', () => {
  test('sin claves en .env queda desactivado y no bloquea', async () => {
    process.env.RECAPTCHA_SITE_KEY = '';
    process.env.RECAPTCHA_SECRET_KEY = '';
    expect(recaptcha.siteKey()).toBeNull();
    expect(await recaptcha.verify(undefined)).toBe(true);
  });

  test('con claves: acepta solo si Google responde success', async () => {
    process.env.RECAPTCHA_SITE_KEY = 'sitio';
    process.env.RECAPTCHA_SECRET_KEY = 'secreta';
    let enviado;
    global.fetch = async (url, opciones) => { enviado = opciones.body.toString(); return { json: async () => ({ success: true }) }; };
    expect(await recaptcha.verify('token-ok', '1.2.3.4')).toBe(true);
    expect(enviado).toContain('secret=secreta');
    expect(enviado).toContain('remoteip=1.2.3.4');

    global.fetch = async () => ({ json: async () => ({ success: false }) });
    expect(await recaptcha.verify('token-malo')).toBe(false);
  });

  test('con claves: sin token o si Google no responde, se rechaza', async () => {
    process.env.RECAPTCHA_SITE_KEY = 'sitio';
    process.env.RECAPTCHA_SECRET_KEY = 'secreta';
    expect(await recaptcha.verify('')).toBe(false);
    global.fetch = async () => { throw new Error('sin red'); };
    expect(await recaptcha.verify('token')).toBe(false);
  });

  test('versión: 2 por defecto, 3 solo si RECAPTCHA_VERSION=3', () => {
    process.env.RECAPTCHA_VERSION = '';
    expect(recaptcha.version()).toBe(2);
    process.env.RECAPTCHA_VERSION = '3';
    expect(recaptcha.version()).toBe(3);
    process.env.RECAPTCHA_MIN_SCORE = 'abc';
    expect(recaptcha.minScore()).toBe(0.5);
  });

  test('v3: acepta solo con puntaje suficiente y la acción esperada', async () => {
    process.env.RECAPTCHA_SITE_KEY = 'sitio';
    process.env.RECAPTCHA_SECRET_KEY = 'secreta';
    process.env.RECAPTCHA_VERSION = '3';
    process.env.RECAPTCHA_MIN_SCORE = '0.5';
    const google = (datos) => { global.fetch = async () => ({ json: async () => datos }); };

    google({ success: true, score: 0.9, action: 'login' });
    expect(await recaptcha.verify('token', null, 'login')).toBe(true);

    google({ success: true, score: 0.2, action: 'login' });   // parece bot
    expect(await recaptcha.verify('token', null, 'login')).toBe(false);

    google({ success: true, score: 0.9, action: 'registro' }); // token de otra acción
    expect(await recaptcha.verify('token', null, 'login')).toBe(false);

    google({ success: true, action: 'login' });                // sin puntaje
    expect(await recaptcha.verify('token', null, 'login')).toBe(false);
  });
});

describe('Bitácora de accesos', () => {
  const req = (ip, encabezados = {}) => ({ ip, get: (h) => encabezados[h.toLowerCase()] });

  test('IP del usuario (IPv4 mapeada y proxy)', () => {
    expect(clientIp(req('::ffff:190.56.1.2'))).toBe('190.56.1.2');
    process.env.TRUST_PROXY = 'true';
    expect(clientIp(req('10.0.0.1', { 'x-forwarded-for': '200.1.1.1, 10.0.0.1' }))).toBe('200.1.1.1');
    process.env.TRUST_PROXY = '';
    expect(clientIp(req('10.0.0.1', { 'x-forwarded-for': '200.1.1.1' }))).toBe('10.0.0.1');
  });

  test('navegador y sistema desde el user-agent', () => {
    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox 131 · Windows');
    expect(describeAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe('Chrome 130 · Android');
    expect(describeAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge 130 · Windows');
    expect(describeAgent('PostmanRuntime/7.39')).toBe('Otro (API/Postman)');
  });

  test('filtros: valida método, resultado y fechas (hora de Guatemala)', () => {
    const { filtros, consulta } = leerFiltros({ usuario: ' kevin ', metodo: 'qr', resultado: 'fallido', desde: '2026-10-21', hasta: '2026-10-21' });
    expect(filtros.nickname).toBe('kevin');
    expect(consulta.success).toBe(false);
    expect(consulta.desde.toISOString()).toBe('2026-10-21T06:00:00.000Z');
    expect(consulta.hasta.toISOString()).toBe('2026-10-22T06:00:00.000Z');
    const malo = leerFiltros({ metodo: "x' OR 1=1", desde: '21/10/2026' });
    expect(malo.consulta.method).toBeUndefined();
    expect(malo.consulta.desde).toBeUndefined();
  });
});
