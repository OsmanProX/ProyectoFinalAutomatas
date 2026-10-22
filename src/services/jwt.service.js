const crypto = require('crypto');

/**
 * ============================================================================
 * JWT (JSON Web Token) para el consumo de los endpoints /api
 * ============================================================================
 * Implementación HS256 (HMAC-SHA256) con el módulo "crypto" de Node/Bun, sin
 * librerías externas (no hace falta bun install).
 *
 *   token = base64url(encabezado) . base64url(datos) . base64url(firma)
 *   firma = HMAC-SHA256(encabezado.datos, JWT_SECRET)
 *
 * Seguridad (OWASP):
 *   - Solo se acepta alg = HS256 (se rechaza "none" y cualquier otro algoritmo).
 *   - La firma se compara en tiempo constante (crypto.timingSafeEqual).
 *   - Se validan exp (vencimiento), iss (emisor) y aud (destinatario).
 *   - La clave va en .env (JWT_SECRET, mínimo 32 caracteres), nunca en el código.
 *   - Cerrar sesión agrega el id del token (jti) a una lista de revocados.
 * ============================================================================
 */
const ALGORITMO = 'HS256';
const EMISOR = 'proyecto-automatas';
const DESTINATARIO = 'proyecto-automatas-api';
const DURACION_POR_DEFECTO = '2h';
const TOLERANCIA_RELOJ_S = 30;

class JwtError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

let claveTemporal = null;
function obtenerClave() {
  const clave = process.env.JWT_SECRET;
  if (clave && clave.length >= 32) return clave;
  if (!claveTemporal) {
    claveTemporal = crypto.randomBytes(48).toString('base64url');
    console.warn('JWT_SECRET no está en .env (o tiene menos de 32 caracteres): se usa una clave temporal y los tokens dejarán de servir al reiniciar el servidor.');
  }
  return claveTemporal;
}

/** "2h" | "30m" | "45s" | "1d" | 3600 -> segundos */
function aSegundos(valor) {
  if (Number.isInteger(valor) && valor > 0) return valor;
  const m = /^(\d+)\s*([smhd])$/i.exec(String(valor || '').trim());
  if (!m) return aSegundos(DURACION_POR_DEFECTO);
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2].toLowerCase()];
}

const codificar = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');
const firmar = (datos) => crypto.createHmac('sha256', obtenerClave()).update(datos).digest('base64url');

function decodificar(parte) {
  try {
    return JSON.parse(Buffer.from(parte, 'base64url').toString('utf8'));
  } catch (err) {
    throw new JwtError('token_invalido');
  }
}

// Tokens revocados (cerrar sesión): jti -> vencimiento. Se limpian solos al vencer.
const revocados = new Map();
function limpiarRevocados(ahora) {
  for (const [jti, exp] of revocados) if (exp < ahora) revocados.delete(jti);
}

/**
 * Crea un token firmado.
 * @param {{ sub: number|string, [k: string]: any }} datos
 * @param {{ expiresIn?: string|number }} opciones
 */
function sign(datos, opciones = {}) {
  const ahora = Math.floor(Date.now() / 1000);
  const duracion = aSegundos(opciones.expiresIn || process.env.JWT_EXPIRES_IN || DURACION_POR_DEFECTO);
  const payload = {
    ...datos,
    sub: String(datos.sub),
    iss: EMISOR,
    aud: DESTINATARIO,
    iat: ahora,
    exp: ahora + duracion,
    jti: crypto.randomUUID()
  };
  const contenido = `${codificar({ alg: ALGORITMO, typ: 'JWT' })}.${codificar(payload)}`;
  return {
    token: `${contenido}.${firmar(contenido)}`,
    expiresIn: duracion,
    expiresAt: new Date(payload.exp * 1000).toISOString()
  };
}

/**
 * Verifica firma, algoritmo, vencimiento, emisor y destinatario.
 * @returns {object} payload
 * @throws {JwtError} token_invalido | token_expirado | token_revocado
 */
function verify(token) {
  if (typeof token !== 'string' || token.length > 4096) throw new JwtError('token_invalido');
  const partes = token.split('.');
  if (partes.length !== 3) throw new JwtError('token_invalido');

  const encabezado = decodificar(partes[0]);
  if (!encabezado || encabezado.alg !== ALGORITMO || encabezado.typ !== 'JWT') throw new JwtError('token_invalido');

  const esperada = Buffer.from(firmar(`${partes[0]}.${partes[1]}`));
  const recibida = Buffer.from(partes[2]);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) {
    throw new JwtError('token_invalido');
  }

  const payload = decodificar(partes[1]);
  const ahora = Math.floor(Date.now() / 1000);
  if (!payload || payload.iss !== EMISOR || payload.aud !== DESTINATARIO || !payload.sub) throw new JwtError('token_invalido');
  if (typeof payload.exp !== 'number' || payload.exp + TOLERANCIA_RELOJ_S < ahora) throw new JwtError('token_expirado');
  if (payload.jti && revocados.has(payload.jti)) throw new JwtError('token_revocado');
  return payload;
}

/** Invalida un token antes de su vencimiento (logout) */
function revoke(payload) {
  if (!payload || !payload.jti) return;
  const ahora = Math.floor(Date.now() / 1000);
  limpiarRevocados(ahora);
  revocados.set(payload.jti, payload.exp || ahora);
}

module.exports = { sign, verify, revoke, JwtError };
