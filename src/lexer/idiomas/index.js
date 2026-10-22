/**
 * Registro de idiomas soportados por el analizador.
 * Para agregar un idioma nuevo basta con crear su archivo de reglas y registrarlo aquí.
 */
const es = require('./es');
const en = require('./en');
const ru = require('./ru');

const IDIOMAS = Object.freeze({ es, en, ru });

/** Catálogo de los 5 idiomas del enunciado: es/en/ru con reglas completas; zh/ar con el analizador básico (../basico.js) */
const CATALOGO_IDIOMAS = Object.freeze([
  { codigo: 'es', nombre: 'Español', habilitado: true },
  { codigo: 'en', nombre: 'Inglés', habilitado: true },
  { codigo: 'ru', nombre: 'Ruso', habilitado: true },
  { codigo: 'zh', nombre: 'Chino', habilitado: true, basico: true },
  { codigo: 'ar', nombre: 'Árabe', habilitado: true, basico: true }
]);

function obtenerIdioma(codigo) {
  return IDIOMAS[codigo] || null;
}

function esIdiomaSoportado(codigo) {
  return Object.prototype.hasOwnProperty.call(IDIOMAS, codigo);
}

module.exports = { IDIOMAS, CATALOGO_IDIOMAS, obtenerIdioma, esIdiomaSoportado };
