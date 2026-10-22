/**
 * ============================================================================
 * PATRONES (EXPRESIONES REGULARES) PARA CLASIFICAR LEXEMAS
 * ============================================================================
 * Cada lexema que entrega el autómata se compara contra estos patrones en
 * orden de prioridad. El primero que coincide define su categoría.
 * Cada expresión regular equivale a un autómata finito (Teorema de Kleene).
 * ============================================================================
 */

const CATEGORIAS = Object.freeze({
  URL: 'URL',
  CORREO: 'CORREO',
  FECHA: 'FECHA',
  HORA: 'HORA',
  TELEFONO: 'TELEFONO',
  MONEDA: 'MONEDA',
  PORCENTAJE: 'PORCENTAJE',
  NUMERO: 'NUMERO',
  HASHTAG: 'HASHTAG',
  MENCION: 'MENCION',
  SIGLA: 'SIGLA',
  PALABRA: 'PALABRA',
  CODIGO: 'CODIGO',
  OTRO: 'OTRO'
});

/** Orden de evaluación = prioridad */
const PATRONES = [
  { categoria: CATEGORIAS.URL, regex: /^(https?:\/\/|www\.)[^\s]+$/i, descripcion: 'Direcciones web (http://, https://, www.)' },
  { categoria: CATEGORIAS.CORREO, regex: /^[\p{L}\d._%+-]+@[\p{L}\d-]+(\.[\p{L}\d-]+)*\.\p{L}{2,}$/u, descripcion: 'Correos electrónicos usuario@dominio.ext' },
  { categoria: CATEGORIAS.FECHA, regex: /^((0?[1-9]|[12]\d|3[01])[\/.-](0?[1-9]|1[0-2])[\/.-](\d{4}|\d{2})|\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$/, descripcion: 'Fechas dd/mm/aaaa, dd-mm-aa o aaaa-mm-dd' },
  { categoria: CATEGORIAS.HORA, regex: /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?(h|hrs|am|pm)?$/i, descripcion: 'Horas hh:mm o hh:mm:ss' },
  { categoria: CATEGORIAS.TELEFONO, regex: /^(\+\d{1,3}-?)?\d{4}-\d{4}$|^\+\d{8,15}$/, descripcion: 'Teléfonos 5555-1234, +502-5555-1234, +50255551234' },
  { categoria: CATEGORIAS.MONEDA, regex: /^(Q|\$|US\$|€|£|¥|₽)\d+([.,]\d+)*$|^\d+([.,]\d+)*(€|₽|\$)$/u, descripcion: 'Montos Q150.00, $25, 30€, 100₽' },
  { categoria: CATEGORIAS.PORCENTAJE, regex: /^[+-]?\d+([.,]\d+)?%$/, descripcion: 'Porcentajes 15%, 3.5%' },
  { categoria: CATEGORIAS.NUMERO, regex: /^[+-]?\d+([.,]\d+)*$/, descripcion: 'Números enteros y decimales' },
  { categoria: CATEGORIAS.HASHTAG, regex: /^#[\p{L}\d_]+$/u, descripcion: 'Hashtags #ejemplo' },
  { categoria: CATEGORIAS.MENCION, regex: /^@[\p{L}\d_.]+$/u, descripcion: 'Menciones @usuario' },
  { categoria: CATEGORIAS.SIGLA, regex: /^(\p{Lu}{2,6}|(\p{Lu}\.){2,6})$/u, descripcion: 'Siglas y acrónimos (ONU, UMG, O.N.U.)' },
  { categoria: CATEGORIAS.PALABRA, regex: /^\p{L}+(['’-]\p{L}+)*\.?$/u, descripcion: 'Palabras (letras de cualquier alfabeto)' },
  { categoria: CATEGORIAS.CODIGO, regex: /^[\p{L}\d]+([-_/][\p{L}\d]+)*$/u, descripcion: 'Códigos alfanuméricos (COVID-19, A1)' }
];

/**
 * Clasifica un lexema según el primer patrón que coincida.
 * @param {string} lexema
 * @returns {string} categoría
 */
function clasificarLexema(lexema) {
  for (const { categoria, regex } of PATRONES) {
    if (regex.test(lexema)) return categoria;
  }
  return CATEGORIAS.OTRO;
}

/** Patrones de adverbios por terminación (reconocibles solo por su forma) */
const PATRON_ADVERBIO = {
  es: /^\p{L}{3,}mente$/u,
  en: /^\p{L}{3,}ly$/u,
  ru: null
};

module.exports = { CATEGORIAS, PATRONES, clasificarLexema, PATRON_ADVERBIO };
