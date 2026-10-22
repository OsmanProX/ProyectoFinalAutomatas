/**
 * ============================================================================
 * Google reCAPTCHA v2 ("No soy un robot") para login y registro
 * ============================================================================
 * Variables en .env (nunca en el código):
 *   RECAPTCHA_SITE_KEY    clave del sitio (va en la página)
 *   RECAPTCHA_SECRET_KEY  clave secreta (solo en el servidor)
 * Se crean en https://www.google.com/recaptcha/admin (tipo v2 "casilla"),
 * agregando los dominios "localhost" y el dominio público del proyecto.
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

/** Clave pública para la vista (null si está desactivado) */
function siteKey() {
  return isEnabled() ? process.env.RECAPTCHA_SITE_KEY : null;
}

/**
 * Valida la respuesta del widget con Google.
 * @param {string} token valor del campo "g-recaptcha-response"
 * @param {string} [ip] IP del usuario
 * @returns {Promise<boolean>} true si es válido (o si el reCAPTCHA está desactivado)
 */
async function verify(token, ip) {
  if (!isEnabled()) return true;
  if (typeof token !== 'string' || !token || token.length > 4000) return false;
  try {
    const datos = new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET_KEY, response: token });
    if (ip) datos.append('remoteip', ip);
    const respuesta = await fetch(URL_VERIFICACION, { method: 'POST', body: datos, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    const resultado = await respuesta.json().catch(() => ({}));
    return resultado.success === true;
  } catch (err) {
    // Si Google no responde se rechaza (seguro por defecto); el detalle queda en la consola
    console.error('reCAPTCHA no respondió:', err.message);
    return false;
  }
}

module.exports = { isEnabled, siteKey, verify };
