/**
 * Pruebas de caja negra de la API con JWT (sin base de datos: se simulan los repositorios).
 * Ejecutar con:  bun test
 */
const { describe, test, expect, beforeAll, afterAll, mock } = require('bun:test');
const path = require('path');

process.env.JWT_SECRET = 'clave_de_prueba_con_mas_de_32_caracteres_123';
const User = require('../src/models/User');
const raiz = (archivo) => path.join(__dirname, '..', 'src', archivo);

const usuarios = {
  1: new User({ id: 1, nickname: 'kevin', full_name: 'Kevin Prueba', state: 1, id_Roles: 3, role_name: 'ANALISTA', role_active: 1 }),
  2: new User({ id: 2, nickname: 'sinpermiso', full_name: 'Sin Permiso', state: 1, id_Roles: 2, role_name: 'SUPERVISOR', role_active: 1 })
};
mock.module(raiz('services/user.service.js'), () => ({
  authenticate: async ({ nickname, password }) => {
    const user = Object.values(usuarios).find((u) => u.nickname === nickname);
    if (!nickname || !password) return { success: false, error: 'credentials_required' };
    if (nickname === 'pendiente') return { success: false, error: 'account_pending' };
    if (!user || password !== 'Secreta123') return { success: false, error: 'invalid_credentials' };
    return { success: true, user: user.toSession() };
  }
}));
mock.module(raiz('repositories/user.repository.js'), () => ({ findById: async (id) => usuarios[id] || null }));
mock.module(raiz('repositories/menu-permission.repository.js'), () => ({
  findByRole: async (idRole) => ({ analisis: idRole !== 2 })
}));

const express = require('express');
const apiRoutes = require('../src/routes/api.routes');

let server;
let base;
let token;

beforeAll(async () => {
  const app = express();
  app.use('/api', apiRoutes);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterAll(() => server && server.close());

const pedir = (ruta, { method = 'GET', body, auth, headers = {} } = {}) => fetch(base + ruta, {
  method,
  headers: {
    ...(body !== undefined && typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    ...headers
  },
  body
});
const login = (nickname, password) => pedir('/auth/login', { method: 'POST', body: JSON.stringify({ nickname, password }) });

describe('API /api/auth', () => {
  test('health es público', async () => {
    const r = await pedir('/health');
    expect(r.status).toBe(200);
  });

  test('login correcto devuelve un token Bearer', async () => {
    const r = await login('kevin', 'Secreta123');
    const datos = await r.json();
    expect(r.status).toBe(200);
    expect(datos.tokenType).toBe('Bearer');
    expect(datos.user.nickname).toBe('kevin');
    expect(datos.user.password).toBeUndefined();
    token = datos.token;
  });

  test('login incorrecto -> 401, cuenta pendiente -> 403, JSON roto -> 400', async () => {
    expect((await login('kevin', 'mala')).status).toBe(401);
    expect((await login('pendiente', 'x')).status).toBe(403);
    const roto = await pedir('/auth/login', { method: 'POST', body: '{"nickname":' });
    expect(roto.status).toBe(400);
    expect((await roto.json()).error).toBe('json_invalido');
  });

  test('sin token o con token falso -> 401', async () => {
    expect((await pedir('/auth/me')).status).toBe(401);
    expect((await pedir('/auth/me', { auth: 'a.b.c' })).status).toBe(401);
  });

  test('/auth/me con token devuelve el usuario', async () => {
    const r = await pedir('/auth/me', { auth: token });
    const datos = await r.json();
    expect(r.status).toBe(200);
    expect(datos.user.role).toBe('ANALISTA');
  });
});

describe('API /api/analysis', () => {
  test('analiza texto en JSON', async () => {
    const r = await pedir('/analysis', { method: 'POST', auth: token, body: JSON.stringify({ language: 'es', text: 'Juan Pérez llegó. Él estudia autómatas.' }) });
    const datos = await r.json();
    expect(r.status).toBe(200);
    expect(datos.result.totalWords).toBe(6);
    expect(datos.result.persons.map((p) => p.name)).toContain('Juan Pérez');
  });

  test('analiza un archivo .txt (multipart)', async () => {
    const form = new FormData();
    form.append('language', 'en');
    form.append('file', new Blob(['She wrote the report.'], { type: 'text/plain' }), 'reporte.txt');
    const r = await pedir('/analysis', { method: 'POST', auth: token, body: form });
    const datos = await r.json();
    expect(r.status).toBe(200);
    expect(datos.fileName).toBe('reporte.txt');
    expect(datos.result.verbs.map((v) => v.root)).toContain('write');
  });

  test('valida la entrada', async () => {
    const idioma = await pedir('/analysis', { method: 'POST', auth: token, body: JSON.stringify({ language: 'fr', text: 'hola' }) });
    expect(idioma.status).toBe(400);
    const vacio = await pedir('/analysis', { method: 'POST', auth: token, body: JSON.stringify({ language: 'es', text: '   ' }) });
    expect(vacio.status).toBe(400);
  });

  test('genera el PDF', async () => {
    const r = await pedir('/analysis/report', { method: 'POST', auth: token, body: JSON.stringify({ language: 'ru', text: 'Мы изучаем языки.' }) });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/pdf');
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
  });

  test('respeta los permisos de menú del rol', async () => {
    const otro = await (await login('sinpermiso', 'Secreta123')).json();
    const r = await pedir('/analysis', { method: 'POST', auth: otro.token, body: JSON.stringify({ language: 'es', text: 'hola' }) });
    expect(r.status).toBe(403);
  });

  test('logout invalida el token', async () => {
    expect((await pedir('/auth/logout', { method: 'POST', auth: token })).status).toBe(200);
    expect((await pedir('/auth/me', { auth: token })).status).toBe(401);
  });
});
