/**
 * Pruebas unitarias del servicio JWT (HS256).
 * Ejecutar con:  bun test
 */
const { describe, test, expect } = require('bun:test');

process.env.JWT_SECRET = 'clave_de_prueba_con_mas_de_32_caracteres_123';
const jwt = require('../src/services/jwt.service');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('JWT', () => {
  test('firma y verifica un token', () => {
    const { token, expiresIn } = jwt.sign({ sub: 7, nickname: 'kevin' });
    expect(token.split('.').length).toBe(3);
    expect(expiresIn).toBe(7200);
    const payload = jwt.verify(token);
    expect(payload.sub).toBe('7');
    expect(payload.nickname).toBe('kevin');
  });

  test('rechaza un token modificado', () => {
    const { token } = jwt.sign({ sub: 7, role: 'ANALISTA' });
    const [h, , s] = token.split('.');
    const falso = `${h}.${b64({ sub: '7', role: 'ADMIN', iss: 'proyecto-automatas', aud: 'proyecto-automatas-api', exp: 9999999999 })}.${s}`;
    expect(() => jwt.verify(falso)).toThrow('token_invalido');
  });

  test('rechaza alg "none"', () => {
    const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1', exp: 9999999999 })}.`;
    expect(() => jwt.verify(sinFirma)).toThrow('token_invalido');
  });

  test('rechaza un token vencido', () => {
    const { token } = jwt.sign({ sub: 1 }, { expiresIn: 1 });
    const real = Date.now;
    Date.now = () => real() + 5 * 60 * 1000;
    try {
      expect(() => jwt.verify(token)).toThrow('token_expirado');
    } finally {
      Date.now = real;
    }
  });

  test('logout: un token revocado deja de servir', () => {
    const { token } = jwt.sign({ sub: 3 });
    jwt.revoke(jwt.verify(token));
    expect(() => jwt.verify(token)).toThrow('token_revocado');
  });

  test('rechaza basura', () => {
    expect(() => jwt.verify('abc')).toThrow('token_invalido');
    expect(() => jwt.verify(null)).toThrow('token_invalido');
  });
});
