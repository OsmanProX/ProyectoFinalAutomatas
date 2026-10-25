/**
 * ============================================================================
 * Google reCAPTCHA para login y registro: v2 ("No soy un robot") o v3 (invisible)
 * ============================================================================
 * Variables en .env (nunca en el código):
 *   RECAPTCHA_SITE_KEY    clave del sitio (va en la página)
 *   RECAPTCHA_SECRET_KEY  clave secreta (solo en el servidor)
 *   RECAPTCHA_VERSION     2 (casilla, por defecto) o 3 (invisible, por puntaje)
 *   RECAPTCHA_MIN_SCORE   solo v3: puntaje mínimo para aceptar (0.0 a 1.0, por defecto 0.5)
 * Se crean en https://www.google.com/recaptcha/admin, agregando "localhost" y
 * el dominio público. OJO: las claves de v2 y v3 son distintas; al cambiar de
 * versión hay que crear claves nuevas del tipo correcto.
 *
 * v3 no muestra casilla: Google da un puntaje de 0.0 (bot) a 1.0 (persona) y
 * el servidor también revisa que la "acción" sea la esperada (login / registro).
 * Si faltan las claves, el reCAPTCHA se desactiva y se avisa en la consola.
 * ============================================================================
 */
const URL_VERIFICACION = 'https://www.google.com/recaptcha/api/siteverify';
const TIEMPO_MAXIMO_MS = 8000;

let avisado = false;

function isEnabled() {
  const activo = Boolean(process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY);
  if (!activo && !avisado) {
    avisado = true;
    console.warn('reCAPTCHA desactivado: faltan RECAPTCHA_SITE_KEY y RECAPTCHA_SECRET_KEY en .env');
  }
  return activo;
}

/** Versión configurada en .env: 3 = invisible por puntaje; cualquier otro valor = 2 (casilla) */
function version() {
  return String(process.env.RECAPTCHA_VERSION || '').trim() === '3' ? 3 : 2;
}

/** Puntaje mínimo de v3 (0.5 si no está o no es válido) */
function minScore() {
  const valor = Number(process.env.RECAPTCHA_MIN_SCORE);
  return Number.isFinite(valor) && valor >= 0 && valor <= 1 ? valor : 0.5;
}

/** Clave pública para la vista (null si está desactivado) */
function siteKey() {
  return isEnabled() ? process.env.RECAPTCHA_SITE_KEY : null;
}

/**
 * Valida la respuesta del widget con Google.
 * @param {string} token valor del campo "g-recaptcha-response"
 * @param {string} [ip] IP del usuario
 * @param {string} [accion] solo v3: acción esperada ("login" o "registro")
 * @returns {Promise<boolean>} true si es válido (o si el reCAPTCHA está desactivado)
 */
async function verify(token, ip, accion) {
  if (!isEnabled()) return true;
  if (typeof token !== 'string' || !token || token.length > 4000) return false;
  try {
    const datos = new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET_KEY, response: token });
    if (ip) datos.append('remoteip', ip);
    const respuesta = await fetch(URL_VERIFICACION, { method: 'POST', body: datos, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    const resultado = await respuesta.json().catch(() => ({}));
    if (resultado.success !== true) return false;
    if (version() === 3) {
      const puntaje = Number(resultado.score);
      const accionOk = !accion || resultado.action === accion;
      const puntajeOk = Number.isFinite(puntaje) && puntaje >= minScore();
      if (!accionOk || !puntajeOk) {
        console.warn(`reCAPTCHA v3 rechazado: puntaje ${resultado.score}, acción ${resultado.action}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    // Si Google no responde se rechaza (seguro por defecto); el detalle queda en la consola
    console.error('reCAPTCHA no respondió:', err.message);
    return false;
  }
}

module.exports = { isEnabled, siteKey, verify, version, minScore };
