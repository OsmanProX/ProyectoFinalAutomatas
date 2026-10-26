/**
 * ============================================================================
 * Seguridad de las páginas web (OWASP)
 * ============================================================================
 *  - limiteIntentos(): frena la fuerza bruta en login, recuperar contraseña y
 *    registro (OWASP A07 - fallas de identificación y autenticación).
 *  - verificarOrigen(): protección CSRF; un POST/PUT/DELETE solo se acepta si
 *    viene de una página de este mismo sitio (OWASP A01 / CSRF).
 *  - cabecerasSeguras(): cabeceras HTTP contra clickjacking y "sniffing".
 *
 * La API (/api, con JWT) ya tiene su propio límite de intentos y no usa cookies,
 * por eso no necesita la verificación de origen.
 * ============================================================================
 */
const { getTranslation } = require('../utils/i18n');

/** IP real del cliente (el servidor puede estar detrás de un proxy / Docker) */
function ipCliente(req) {
  const reenviada = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return reenviada || req.ip || (req.socket && req.socket.remoteAddress) || 'desconocida';
}

/** ¿La petición espera JSON? (fetch del navegador) */
function quiereJson(req) {
  return req.is('application/json') || (req.get('accept') || '').includes('application/json');
}

function textos(req) {
  return getTranslation((req.session && req.session.lang) || 'es');
}

// ------------------------------------------------------------------ límite de intentos

/**
 * Cuenta intentos por IP (y por apodo si viene) dentro de una ventana de tiempo.
 * Por defecto cuenta solo los intentos FALLIDOS: si al terminar la petición el
 * usuario quedó con sesión (req.session.user), el contador de esa IP se limpia.
 *
 * @param {object}   opciones
 * @param {string}   opciones.nombre      nombre del límite (para los mensajes de la terminal)
 * @param {number}   opciones.max         intentos permitidos por APODO dentro de la ventana
 * @param {number}   [opciones.maxIp]     intentos permitidos por IP (por defecto 3 × max: en un
 *                                        salón o en la misma red varias personas comparten IP)
 * @param {number}   opciones.ventanaMs   duración de la ventana / del bloqueo
 * @param {boolean}  [opciones.contarTodo] true = cuenta cada petición (no solo las fallidas)
 * @param {Function} [opciones.alBloquear] (req, res, segundos) => respuesta cuando está bloqueado
 */
function limiteIntentos({ nombre, max, maxIp, ventanaMs, contarTodo = false, alBloquear }) {
  const limiteIp = maxIp || max * 3;
  const registros = new Map();

  function claves(req) {
    const lista = [`ip:${ipCliente(req)}`];
    const apodo = req.body && typeof req.body.nickname === 'string' ? req.body.nickname.trim().toLowerCase() : '';
    if (apodo) lista.push(`apodo:${apodo.slice(0, 100)}`);
    return lista;
  }

  function segundosBloqueado(clave) {
    const r = registros.get(clave);
    if (!r) return 0;
    if (r.hasta < Date.now()) { registros.delete(clave); return 0; }
    const tope = clave.startsWith('ip:') ? limiteIp : max;
    return r.cantidad >= tope ? Math.ceil((r.hasta - Date.now()) / 1000) : 0;
  }

  function sumar(clave) {
    const ahora = Date.now();
    const r = registros.get(clave);
    if (!r || r.hasta < ahora) registros.set(clave, { cantidad: 1, hasta: ahora + ventanaMs });
    else r.cantidad += 1;
    // Limpieza para que la memoria no crezca sin límite
    if (registros.size > 5000) {
      for (const [c, reg] of registros) if (reg.hasta < ahora) registros.delete(c);
    }
  }

  const middleware = (req, res, next) => {
    const lista = claves(req);
    const espera = Math.max(...lista.map(segundosBloqueado));
    if (espera > 0) {
      console.warn(`[Seguridad] ${nombre}: bloqueado ${ipCliente(req)} por ${espera} s`);
      res.set('Retry-After', String(espera));
      if (alBloquear) return alBloquear(req, res, espera);
      return responderBloqueo(req, res, espera);
    }

    res.on('finish', () => {
      const entro = req.session && req.session.user;
      if (!contarTodo && entro) {
        lista.forEach((c) => registros.delete(c));
        return;
      }
      // Solo cuentan las respuestas de error o los intentos sin sesión
      if (contarTodo || !entro) lista.forEach(sumar);
    });
    return next();
  };

  middleware.reiniciar = () => registros.clear(); // para las pruebas
  return middleware;
}

/** Mensaje estándar cuando se superó el límite (JSON para fetch, texto para formularios) */
function responderBloqueo(req, res, segundos) {
  const t = textos(req);
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  const mensaje = (t.security_too_many || 'Demasiados intentos. Espera {min} minuto(s) e inténtalo de nuevo.')
    .replace('{min}', minutos);
  if (quiereJson(req)) {
    return res.status(429).json({ success: false, error: 'too_many_attempts', message: mensaje, waitSeconds: segundos });
  }
  return res.status(429).type('text/plain; charset=utf-8').send(mensaje);
}

// ------------------------------------------------------------------ CSRF (origen)

const METODOS_QUE_CAMBIAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Orígenes permitidos: el propio host (también detrás de proxy) y los de ALLOWED_ORIGINS */
function origenesPermitidos(req) {
  const hosts = new Set();
  const agregar = (h) => { if (h) hosts.add(String(h).split(',')[0].trim().toLowerCase()); };
  agregar(req.get('host'));
  agregar(req.get('x-forwarded-host'));
  (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean).forEach((o) => {
    try { agregar(new URL(o).host); } catch (e) { agregar(o); }
  });
  return hosts;
}

function hostDe(url) {
  try { return new URL(url).host.toLowerCase(); } catch (e) { return null; }
}

/**
 * Protección CSRF con las cabeceras estándar Origin / Referer (recomendación OWASP),
 * junto con la cookie de sesión SameSite=Lax (app.js).
 * Los navegadores siempre envían Origin en un POST; si apunta a otro sitio, se rechaza.
 */
function verificarOrigen(req, res, next) {
  if (!METODOS_QUE_CAMBIAN.has(req.method)) return next();

  const origen = req.get('origin');
  const referencia = req.get('referer');
  const permitidos = origenesPermitidos(req);

  let host = null;
  if (origen && origen !== 'null') host = hostDe(origen);
  else if (referencia) host = hostDe(referencia);
  else if (origen === 'null') host = 'null';

  // Sin Origin ni Referer: no viene de un navegador (p. ej. pruebas o curl); se deja pasar
  if (host === null && !origen && !referencia) return next();

  if (host && permitidos.has(host)) return next();

  console.warn(`[Seguridad] CSRF: se rechazó ${req.method} ${req.originalUrl} desde "${origen || referencia}"`);
  const t = textos(req);
  const mensaje = t.security_csrf || 'La solicitud no viene de este sitio. Recarga la página e inténtalo de nuevo.';
  if (quiereJson(req)) return res.status(403).json({ success: false, error: 'invalid_origin', message: mensaje });
  return res.status(403).type('text/plain; charset=utf-8').send(mensaje);
}

// ------------------------------------------------------------------ cabeceras

/** Cabeceras de seguridad para todas las páginas */
function cabecerasSeguras(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');            // no adivinar tipos de archivo
  res.set('X-Frame-Options', 'SAMEORIGIN');                // evita que otro sitio nos meta en un iframe
  res.set('Content-Security-Policy', "frame-ancestors 'self'");
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
}

module.exports = { limiteIntentos, verificarOrigen, cabecerasSeguras, ipCliente, quiereJson, responderBloqueo };
