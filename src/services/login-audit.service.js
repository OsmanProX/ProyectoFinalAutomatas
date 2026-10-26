const loginAuditRepository = require('../repositories/login-audit.repository');

/**
 * ============================================================================
 * BITÁCORA DE ACCESOS (auditoría de login)
 * ============================================================================
 * Guarda QUIÉN (usuario), CÓMO (contraseña, rostro, QR, API o cierre de sesión),
 * CUÁNDO (fecha y hora UTC), DESDE DÓNDE (IP y navegador) y el RESULTADO.
 * Nunca guarda contraseñas, fotos ni tokens.
 * Se registra en segundo plano: si la base de datos falla, el login no se detiene.
 * ============================================================================
 */
const METODOS = Object.freeze({
  password: 'Usuario y contraseña',
  rostro: 'Reconocimiento facial',
  qr: 'Código QR',
  api: 'API (JWT)',
  logout: 'Cierre de sesión'
});

const DETALLES = Object.freeze({
  ok: 'Acceso correcto',
  logout: 'Cerró sesión',
  invalid_credentials: 'Usuario o contraseña incorrectos',
  credentials_required: 'Faltan datos',
  account_pending: 'Cuenta pendiente de activar',
  account_disabled: 'Cuenta deshabilitada',
  user_not_found: 'Usuario no existe',
  face_not_match: 'El rostro no coincide',
  invalid_image: 'Imagen no válida',
  segmentation_failed: 'No se detectó un rostro',
  no_photo_registered: 'Sin foto registrada',
  missing_data: 'Faltan datos',
  qr_invalid: 'QR no válido',
  recaptcha: 'reCAPTCHA no superado',
  too_many_attempts: 'Demasiados intentos',
  server_error: 'Error del servidor'
});

/** IP del usuario. Detrás de un proxy (Hostinger) usar TRUST_PROXY=true en .env */
function clientIp(req) {
  const reenviada = (req.get && req.get('x-forwarded-for') ? req.get('x-forwarded-for') : '').split(',')[0].trim();
  const ip = process.env.TRUST_PROXY === 'true' && reenviada
    ? reenviada
    : (req.ip || (req.socket && req.socket.remoteAddress) || '');
  return String(ip).replace(/^::ffff:/, '').slice(0, 45) || null;
}

const recortar = (texto, max) => (texto ? String(texto).slice(0, max) : null);

/**
 * Registra un intento de acceso. No lanza errores.
 * @param {import('express').Request} req
 * @param {{ method: string, success: boolean, user?: { id?: number, nickname?: string }, nickname?: string, detail?: string }} datos
 */
function record(req, { method, success, user, nickname, detail }) {
  const registro = {
    userId: user && user.id ? Number(user.id) : null,
    nickname: recortar((user && user.nickname) || (typeof nickname === 'string' ? nickname.trim().toLowerCase() : ''), 100),
    method: METODOS[method] ? method : 'password',
    success: Boolean(success),
    detail: recortar(detail || (success ? 'ok' : 'server_error'), 40),
    ip: clientIp(req),
    forwardedFor: recortar(req.get && req.get('x-forwarded-for'), 255),
    userAgent: recortar(req.get && req.get('user-agent'), 255)
  };
  return loginAuditRepository.insert(registro).catch((err) => {
    console.warn('No se pudo guardar la bitácora de acceso:', err.message);
  });
}

/** "Chrome 141 · Windows" a partir del user-agent */
function describeAgent(userAgent) {
  const ua = userAgent || '';
  const navegador = [[/Edg\/(\d+)/, 'Edge'], [/OPR\/(\d+)/, 'Opera'], [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'], [/Version\/(\d+).*Safari/, 'Safari']]
    .map(([re, nombre]) => { const m = re.exec(ua); return m ? `${nombre} ${m[1]}` : null; })
    .find(Boolean);
  const sistema = [[/Android/, 'Android'], [/iPhone|iPad/, 'iOS'], [/Windows/, 'Windows'], [/Mac OS X/, 'macOS'], [/Linux/, 'Linux']]
    .map(([re, nombre]) => (re.test(ua) ? nombre : null))
    .find(Boolean);
  if (!navegador && !sistema) return ua ? 'Otro (API/Postman)' : 'Desconocido';
  return [navegador, sistema].filter(Boolean).join(' · ');
}

module.exports = { record, clientIp, describeAgent, METODOS, DETALLES };
