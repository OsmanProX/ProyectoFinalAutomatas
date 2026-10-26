// src/services/lexer.service.js

/**
 * ============================================================================
 * SERVICIO DE ANÁLISIS LÉXICO (fachada que usan la vista, el PDF y la API)
 * ============================================================================
 * - Español, inglés y ruso -> analizador completo (src/lexer/analizador.js):
 *   autómata (AFD) + patrones (regex) + reglas del idioma + raíces Snowball.
 * - Chino y árabe -> analizador básico (src/lexer/basico.js): mismo AFD,
 *   segmentación de palabras (Intl.Segmenter) + listas + raíz Snowball árabe.
 *
 * Conserva los campos que ya usaban la vista y el PDF (totalWords, mostRepeated,
 * leastRepeated, pronouns, properNouns) y agrega lo que pide el enunciado:
 * nombres de personas, sustantivos y verbos (forma raíz) y otros patrones.
 *
 * Corrige además el error anterior: la limpieza con /[^\w\s...]/ solo conocía
 * letras latinas, así que un texto en ruso, chino o árabe quedaba vacío.
 * ============================================================================
 */
const { analizarTexto } = require('../lexer/analizador');
const { analizarTextoBasico } = require('../lexer/basico');

/** Idiomas del enunciado; "completo" = reglas propias, "basico" = análisis aproximado */
const LANGUAGES = Object.freeze({
  es: { name: 'Español', mode: 'completo' },
  en: { name: 'Inglés', mode: 'completo' },
  ru: { name: 'Ruso', mode: 'completo' },
  zh: { name: 'Chino', mode: 'basico' },
  ar: { name: 'Árabe', mode: 'basico' }
});
const SUPPORTED_LANGUAGES = Object.freeze(Object.keys(LANGUAGES));

/** Nombre en español de cada patrón reconocido (para la vista, el PDF y la API) */
const PATTERN_LABELS = Object.freeze({
  CORREO: 'Correos electrónicos',
  URL: 'Direcciones web (URL)',
  FECHA: 'Fechas',
  HORA: 'Horas',
  TELEFONO: 'Teléfonos',
  MONEDA: 'Montos de dinero',
  PORCENTAJE: 'Porcentajes',
  NUMERO: 'Números',
  HASHTAG: 'Hashtags',
  MENCION: 'Menciones (@usuario)',
  ROMANO: 'Números romanos (capítulos, siglos)',
  SIGLA: 'Siglas y acrónimos (también con puntos: L.A., O.N.U.)',
  DOMINIO: 'Dominios y extensiones (.com, .LA)',
  PALABRA_SIGNOS: 'Palabras con punto en medio (ho.a)',
  CODIGO: 'Códigos alfanuméricos'
});

/**
 * Agrupa palabras (ya ordenadas) por su primera letra: A, B, C ... Z.
 * Las tildes no crean grupos aparte (á -> A) pero la Ñ sí; números y símbolos van en "#".
 * En chino cada carácter es distinto, así que va todo en un solo grupo.
 * @returns {Array<{ letter: string, words: string[] }>}
 */
function agruparPorLetra(palabras, code) {
  if (!Array.isArray(palabras) || !palabras.length) return [];
  if (code === 'zh') return [{ letter: '字', words: palabras.slice() }];
  const grupos = new Map();
  palabras.forEach((palabra) => {
    const primera = String(palabra).charAt(0);
    let letra;
    if (/[ñÑ]/.test(primera)) letra = 'Ñ';
    else if (/\p{L}/u.test(primera)) letra = primera.normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase(code);
    else letra = '#';
    if (!grupos.has(letra)) grupos.set(letra, []);
    grupos.get(letra).push(palabra);
  });
  return [...grupos.entries()]
    .sort((a, b) => (a[0] === '#') - (b[0] === '#') || a[0].localeCompare(b[0], code))
    .map(([letter, words]) => ({ letter, words }));
}

function isSupportedLanguage(lang) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, lang);
}

function emptyResult(code) {
  return {
    language: { code, name: LANGUAGES[code].name, mode: LANGUAGES[code].mode },
    totalWords: 0,
    summary: { uniqueWords: 0, sentences: 0, characters: 0, avgWordLength: 0, timeMs: 0 },
    mostRepeated: [],
    leastRepeated: [],
    leastRepeatedTotal: 0,
    leastRepeatedByLetter: [],
    pronouns: [],
    persons: [],
    properNouns: [],
    nouns: [],
    verbs: [],
    adverbs: [],
    patterns: [],
    automaton: { states: [], transitions: 0, tokensByCategory: {} }
  };
}

const conteo = (clave) => (item) => ({ [clave]: item.palabra || item.nombre, count: item.frecuencia });
const raices = (grupo) => ({ root: grupo.raiz, forms: grupo.formas, count: grupo.frecuencia });

/**
 * Función principal para analizar el texto cargado (.txt)
 * @param {string} text - Contenido del archivo
 * @param {string} lang - Idioma seleccionado (es, en, ru, zh, ar)
 */
function analyzeText(text, lang = 'es') {
  const code = isSupportedLanguage(lang) ? lang : 'es';
  if (typeof text !== 'string' || text.trim().length === 0) return emptyResult(code);

  const r = LANGUAGES[code].mode === 'completo'
    ? analizarTexto(text, code)
    : analizarTextoBasico(text, code);

  return {
    language: { code, name: LANGUAGES[code].name, mode: LANGUAGES[code].mode },
    // a. Cantidad total de palabras
    totalWords: r.resumen.totalPalabras,
    summary: {
      uniqueWords: r.resumen.palabrasUnicas,
      sentences: r.resumen.totalOraciones,
      characters: r.resumen.totalCaracteres,
      avgWordLength: r.resumen.promedioLetrasPorPalabra,
      timeMs: r.resumen.tiempoMs
    },
    // b. Palabras que más se repiten (sin artículos, preposiciones ni pronombres);
    //    si ninguna se repite, la lista queda vacía
    mostRepeated: r.masRepetidas.filter((i) => i.frecuencia > 1).map(conteo('word')),
    // c. Palabras que menos se repiten (las de frecuencia mínima)
    leastRepeated: r.menosRepetidas.palabras.map((word) => ({ word, count: r.menosRepetidas.frecuencia })),
    leastRepeatedTotal: r.menosRepetidas.total,
    //    agrupadas por letra (A, B, C ... Z) para mostrarlas completas y en orden
    leastRepeatedByLetter: agruparPorLetra(r.menosRepetidas.palabras, code),
    // d. Pronombres personales
    pronouns: r.pronombresPersonales.map(conteo('word')),
    // e. Nombres de personas y otros nombres propios (lugares, instituciones)
    persons: r.nombresPersonas.map(conteo('name')),
    properNouns: r.otrosNombresPropios.map(conteo('name')),
    // f. y g. Sustantivos y verbos en forma raíz (con las formas encontradas)
    nouns: r.sustantivos.map(raices),
    verbs: r.verbos.map(raices),
    // h. Otras clasificaciones reconocibles mediante un patrón
    adverbs: r.adverbios.map(conteo('word')),
    patterns: Object.entries(r.otrosPatrones)
      .filter(([, items]) => items.length > 0)
      .map(([category, items]) => ({
        category,
        label: PATTERN_LABELS[category] || category,
        items: items.map((i) => ({ value: i.valor, count: i.frecuencia }))
      })),
    automaton: {
      states: r.automata.estados,
      transitions: r.automata.transiciones,
      tokensByCategory: r.automata.tokensPorCategoria
    }
  };
}

module.exports = {
  analyzeText,
  isSupportedLanguage,
  agruparPorLetra,
  LANGUAGES,
  SUPPORTED_LANGUAGES,
  PATTERN_LABELS
};
