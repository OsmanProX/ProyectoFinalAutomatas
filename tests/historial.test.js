/**
 * Pruebas de caja negra: historial de análisis en memoria RAM (sesión), sin MySQL.
 * Ejecutar con:  bun test
 */
const { describe, test, expect, beforeAll, afterAll } = require('bun:test');
const path = require('path');
const express = require('express');
const session = require('express-session');

const raiz = (archivo) => path.join(__dirname, '..', 'src', archivo);

let server;
let base;
let cookie = '';

beforeAll(async () => {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', raiz('views'));
  app.use(session({ secret: 'prueba_historial', resave: false, saveUninitialized: true }));
  // Usuario con sesión simulada (sin base de datos)
  app.use((req, res, next) => {
    req.session.user = { id: 1, nickname: 'prueba' };
    res.locals.user = { id: 1, full_name: 'Prueba', nickname: 'prueba', role: 'ANALISTA' };
    res.locals.menuPermissions = null;
    next();
  });
  app.use('/analyze', require(raiz('routes/analysis.routes.js')));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server && server.close());

async function subir(nombre, texto) {
  const datos = new FormData();
  datos.append('language', 'es');
  datos.append('file', new Blob([texto], { type: 'text/plain' }), nombre);
  const r = await fetch(`${base}/analyze`, { method: 'POST', body: datos, headers: cookie ? { cookie } : {} });
  const nueva = r.headers.get('set-cookie');
  if (nueva) cookie = nueva.split(';')[0];
  return r.text();
}

const elementos = (html) => (html.match(/<ol class="lex-historial-lista">([\s\S]*?)<\/ol>/) || ['', ''])[1];
const archivos = (html) => [...elementos(html).matchAll(/class="lex-historial-archivo"[^>]*>([^<]+)</g)].map((m) => m[1]);

describe('Historial de análisis en memoria RAM', () => {
  test('sin análisis todavía no se muestra el historial', async () => {
    const html = await (await fetch(`${base}/analyze`)).text();
    expect(html).not.toContain('Tus últimos análisis');
  });

  test('guarda el resumen y muestra el más reciente primero', async () => {
    await subir('primero.txt', 'La casa es grande. La casa es azul.');
    const html = await subir('segundo.txt', 'El perro corre. El perro ladra.');
    expect(html).toContain('Tus últimos análisis');
    expect(archivos(html)).toEqual(['segundo.txt', 'primero.txt']);
    expect(elementos(html)).toContain('palabras');
  });

  test('conserva solo los últimos 5', async () => {
    let html = '';
    for (let n = 3; n <= 7; n++) html = await subir(`archivo${n}.txt`, `Texto número ${n} de prueba.`);
    expect(archivos(html)).toEqual(['archivo7.txt', 'archivo6.txt', 'archivo5.txt', 'archivo4.txt', 'archivo3.txt']);
  });

  test('no guarda el texto del archivo, solo el resumen', async () => {
    const secreto = 'Contenido privado que no debe quedar en el historial.';
    const html = await subir('privado.txt', secreto);
    expect(elementos(html)).toContain('privado.txt');
    expect(elementos(html)).not.toContain('Contenido privado');
  });
});
