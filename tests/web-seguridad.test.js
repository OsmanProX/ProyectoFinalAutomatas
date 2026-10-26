/**
 * Pruebas de caja negra de la seguridad web (OWASP):
 * límite de intentos, protección CSRF por origen, cabeceras seguras,
 * páginas de error sin detalles internos y resumen del supervisor.
 * Ejecutar con:  bun test
 */
const { describe, test, expect, beforeAll, afterAll } = require('bun:test');
const path = require('path');
const express = require('express');

const raiz = (archivo) => path.join(__dirname, '..', 'src', archivo);
const { limiteIntentos, verificarOrigen, cabecerasSeguras } = require('../src/middlewares/security.middleware');
const { noEncontrado, manejarError, codigoDe } = require('../src/middlewares/error.middleware');

let server;
let base;

beforeAll(async () => {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', raiz('views'));
  app.use(cabecerasSeguras);
  app.use(express.json());

  // Sesión simulada: el "login" correcto deja req.session.user
  app.use((req, res, next) => { req.session = {}; next(); });

  const limite = limiteIntentos({ nombre: 'prueba', max: 3, maxIp: 5, ventanaMs: 60 * 1000 });
  app.post('/login', limite, (req, res) => {
    if (req.body.password === 'correcta') {
      req.session.user = { id: 1 };
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false });
  });

  app.post('/cambiar', verificarOrigen, (req, res) => res.json({ success: true }));
  app.get('/falla', () => { throw new Error('ER_ACCESS_DENIED_ERROR: Access denied for user root en C:\\proyecto\\src\\db.js'); });

  app.use(noEncontrado);
  app.use(manejarError);

  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server && server.close());

const postJson = (ruta, cuerpo, cabeceras = {}) => fetch(base + ruta, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...cabeceras },
  body: JSON.stringify(cuerpo)
});

describe('Límite de intentos (fuerza bruta)', () => {
  test('después de 3 contraseñas incorrectas bloquea con 429 y mensaje claro', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await postJson('/login', { nickname: 'ana', password: 'mala' });
      expect(r.status).toBe(401);
    }
    const bloqueada = await postJson('/login', { nickname: 'ana', password: 'correcta' });
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.headers.get('retry-after')).toBeTruthy();
    const cuerpo = await bloqueada.json();
    expect(cuerpo.error).toBe('too_many_attempts');
    expect(cuerpo.message).toContain('Demasiados intentos');
  });

  test('por IP permite más intentos (varias personas en la misma red)', async () => {
    const red = { 'X-Forwarded-For': '10.0.0.50' };
    // 2 apodos distintos desde la misma IP: el apodo de 3 fallos queda bloqueado, el otro no
    for (let i = 0; i < 3; i++) await postJson('/login', { nickname: 'carla', password: 'mala' }, red);
    expect((await postJson('/login', { nickname: 'carla', password: 'mala' }, red)).status).toBe(429);
    expect((await postJson('/login', { nickname: 'diego', password: 'mala' }, red)).status).toBe(401);
    expect((await postJson('/login', { nickname: 'fede', password: 'mala' }, red)).status).toBe(401);
    // ...hasta llegar al tope de la IP (5): entonces se bloquea la IP completa
    expect((await postJson('/login', { nickname: 'elena', password: 'mala' }, red)).status).toBe(429);
  });

  test('un login correcto limpia el contador de esa persona', async () => {
    const otraIp = { 'X-Forwarded-For': '10.0.0.9' };
    await postJson('/login', { nickname: 'beto', password: 'mala' }, otraIp);
    await postJson('/login', { nickname: 'beto', password: 'mala' }, otraIp);
    const ok = await postJson('/login', { nickname: 'beto', password: 'correcta' }, otraIp);
    expect(ok.status).toBe(200);
    // Ya no cuenta los fallos anteriores: puede volver a equivocarse sin bloqueo inmediato
    const r = await postJson('/login', { nickname: 'beto', password: 'mala' }, otraIp);
    expect(r.status).toBe(401);
  });
});

describe('Protección CSRF por origen', () => {
  test('acepta un POST que viene de este mismo sitio', async () => {
    const r = await postJson('/cambiar', {}, { Origin: base });
    expect(r.status).toBe(200);
  });

  test('rechaza un POST que viene de otro sitio', async () => {
    const r = await postJson('/cambiar', {}, { Origin: 'https://sitio-malicioso.com' });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('invalid_origin');
  });

  test('si no hay Origin revisa el Referer', async () => {
    const malo = await postJson('/cambiar', {}, { Referer: 'https://otro.com/pagina' });
    expect(malo.status).toBe(403);
    const bueno = await postJson('/cambiar', {}, { Referer: `${base}/perfil` });
    expect(bueno.status).toBe(200);
  });
});

describe('Cabeceras de seguridad', () => {
  test('cada respuesta trae nosniff, SAMEORIGIN y frame-ancestors', async () => {
    const r = await fetch(`${base}/no-existe`);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
  });
});

describe('Errores sin información sensible', () => {
  test('una ruta inexistente muestra la página 404 del sitio', async () => {
    const r = await fetch(`${base}/no-existe`);
    expect(r.status).toBe(404);
    const html = await r.text();
    expect(html).toContain('Página no encontrada');
    expect(html).toContain('Universidad Mariano Gálvez');
  });

  test('un error interno no muestra el mensaje de la base de datos ni rutas de archivos', async () => {
    const original = console.error;
    console.error = () => {}; // el detalle va a la terminal; aquí no se imprime
    const r = await fetch(`${base}/falla`);
    console.error = original;
    expect(r.status).toBe(500);
    const html = await r.text();
    expect(html).toContain('Algo salió mal');
    expect(html).not.toContain('ER_ACCESS_DENIED_ERROR');
    expect(html).not.toContain('db.js');
    expect(html).not.toContain('root');
  });

  test('para fetch responde JSON genérico', async () => {
    const original = console.error;
    console.error = () => {};
    const r = await fetch(`${base}/falla`, { headers: { Accept: 'application/json' } });
    console.error = original;
    const cuerpo = await r.json();
    expect(cuerpo).toEqual({ success: false, error: 'server_error', message: expect.any(String) });
    expect(JSON.stringify(cuerpo)).not.toContain('ER_ACCESS');
  });

  test('una foto demasiado grande se reporta como 413', () => {
    expect(codigoDe({ type: 'entity.too.large' })).toBe(413);
    expect(codigoDe(new Error('x'))).toBe(500);
  });
});

describe('Inicio del supervisor', () => {
  test('resume entregas y accesos de los últimos 7 días', async () => {
    const ahora = new Date();
    const viejo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    // Repositorios de prueba (sin base de datos)
    const whatsappLog = {
      find: async () => [
        { tipo: 'reporte', estado: 'entregado', destino: '5555****', createdAt: ahora },
        { tipo: 'reporte', estado: 'leido', destino: '5555****', createdAt: ahora },
        { tipo: 'credencial', estado: 'fallido', destino: '4444****', createdAt: ahora },
        { tipo: 'reporte', estado: 'enviado', destino: '3333****', createdAt: viejo }
      ]
    };
    const loginAudit = {
      find: async () => [
        { method: 'password', success: true },
        { method: 'rostro', success: true },
        { method: 'password', success: false },
        { method: 'logout', success: true }
      ]
    };
    const { resumen } = require('../src/services/supervision.service');
    const r = await resumen('es', { whatsappLog, loginAudit });
    expect(r.entregas.total).toBe(3);          // el envío de hace 30 días no cuenta
    expect(r.entregas.entregados).toBe(2);
    expect(r.entregas.fallidos).toBe(1);
    expect(r.entregas.pctEntregados).toBe(67);
    expect(r.entregas.ultimos[0].tipo).toBe('Reporte PDF');
    expect(r.accesos.total).toBe(3);           // el cierre de sesión no es un intento de acceso
    expect(r.accesos.exitosos).toBe(2);
    expect(r.accesos.fallidos).toBe(1);
  });
});
