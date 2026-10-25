const { getTranslation } = require('../utils/i18n');
const { quiereJson } = require('./security.middleware');

/**
 * Manejo de errores de las páginas web.
 * - El usuario ve un mensaje claro (página con el diseño del sitio o JSON para fetch).
 * - Nunca se muestran rutas de archivos, consultas SQL ni datos de la base de datos:
 *   el detalle técnico solo se escribe en la terminal del servidor.
 * La API (/api) tiene su propio manejador con el mismo criterio (api.routes.js).
 */

function idioma(req) {
  return (req.session && req.session.lang) || 'es';
}

/** 404: ninguna ruta respondió */
function noEncontrado(req, res) {
  const lang = idioma(req);
  const t = getTranslation(lang);
  if (quiereJson(req)) {
    return res.status(404).json({ success: false, error: 'not_found', message: t.error_404_title });
  }
  return res.status(404).render('error', { t, lang, codigo: 404 });
}

/** Código que verá el usuario según el error */
function codigoDe(err) {
  if (!err) return 500;
  if (err.type === 'entity.too.large' || err.status === 413 || err.code === 'LIMIT_FILE_SIZE') return 413;
  const status = err.status || err.statusCode;
  if (status === 403 || status === 404) return status;
  return 500;
}

// eslint-disable-next-line no-unused-vars
function manejarError(err, req, res, next) {
  const lang = idioma(req);
  const t = getTranslation(lang);
  const codigo = codigoDe(err);

  console.error(`[Error ${codigo}] ${req.method} ${req.originalUrl}:`, err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);

  if (quiereJson(req)) {
    const clave = { 413: 'too_large', 500: 'server_error' }[codigo] || `error_${codigo}`;
    return res.status(codigo).json({ success: false, error: clave, message: t[`error_${codigo}_text`] || t.error_500_text });
  }
  return res.status(codigo).render('error', { t, lang, codigo }, (errVista, html) => {
    if (errVista) return res.type('text/plain; charset=utf-8').send(t.error_500_text);
    return res.send(html);
  });
}

module.exports = { noEncontrado, manejarError, codigoDe };
