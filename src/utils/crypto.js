const crypto = require('crypto');

/**
 * Utilidades criptográficas:
 *  - Cifrado simétrico AES-256-GCM para guardar secretos en la BD (token del QR).
 *  - Enlaces firmados (HMAC-SHA256) y temporales para descargar archivos sin sesión.
 * Las llaves salen de variables de entorno, nunca del código.
 */
function llave(nombre) {
  const secreto = process.env.CREDENTIAL_SECRET || process.env.SESSION_SECRET;
  if (!secreto) throw new Error('secreto_no_configurado');
  return crypto.createHash('sha256').update(`${nombre}:${secreto}`).digest();
}

/** Cifra un texto -> "iv.tag.datos" en base64url */
function encrypt(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', llave('cifrado'), iv);
  const datos = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), datos].map((b) => b.toString('base64url')).join('.');
}

/** @returns {string|null} texto original o null si fue alterado / llave incorrecta */
function decrypt(cifrado) {
  try {
    const [iv, tag, datos] = String(cifrado).split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', llave('cifrado'), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
  } catch (err) {
    return null;
  }
}

/** Comparación en tiempo constante (evita ataques de tiempo) */
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function firmar(datos) {
  return crypto.createHmac('sha256', llave('enlaces')).update(datos).digest('base64url');
}

/** Enlace temporal: id + vencimiento, firmado */
function createSignedToken(id, minutos = 60) {
  const datos = `${id}.${Date.now() + minutos * 60 * 1000}`;
  return `${Buffer.from(datos).toString('base64url')}.${firmar(datos)}`;
}

/** @returns {number|null} id si la firma es válida y no ha vencido */
function verifySignedToken(token) {
  if (typeof token !== 'string' || token.split('.').length !== 2) return null;
  const [b64, firma] = token.split('.');
  const datos = Buffer.from(b64, 'base64url').toString();
  if (!safeEqual(firma, firmar(datos))) return null;
  const [id, vence] = datos.split('.').map(Number);
  if (!Number.isInteger(id) || !(Date.now() < vence)) return null;
  return id;
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { encrypt, decrypt, safeEqual, createSignedToken, verifySignedToken, randomToken };
