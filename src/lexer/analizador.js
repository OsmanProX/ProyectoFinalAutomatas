/**
 * ============================================================================
 * ANALIZADOR LÉXICO
 * ============================================================================
 * Fases:
 *   1. Escaneo:        el AFD (automata.js) divide el texto en tokens.
 *   2. Patrones:       cada lexema se clasifica con expresiones regulares (patrones.js).
 *   3. Nombres:        secuencias de palabras con mayúscula -> personas / nombres propios.
 *   4. Categorías:     pronombres, verbos y sustantivos según reglas del idioma
 *                      (listas, terminaciones y contexto de la palabra anterior).
 *   5. Raíces:         algoritmo de Snowball (stemming) o infinitivo si el verbo es irregular.
 *   6. Estadísticas:   frecuencias, palabras más y menos repetidas, resumen.
 * ============================================================================
 */
const snowball = require('./vendor/snowball-stemmers');
const { escanear, ESTADOS, TIPOS_TOKEN } = require('./automata');
const { CATEGORIAS, clasificarLexema, PATRON_ADVERBIO } = require('./patrones');
const { obtenerIdioma } = require('./idiomas');

const LIMITE_LISTAS = 50;
const TOP_FRECUENCIAS = 10;

/** Categorías gramaticales asignadas a cada palabra */
const CAT = Object.freeze({
  PERSONA: 'PERSONA',
  PROPIO: 'PROPIO',
  PRONOMBRE: 'PRONOMBRE',
  AMBIGUO: 'AMBIGUO',
  FUNCIONAL: 'FUNCIONAL',
  ADVERBIO: 'ADVERBIO',
  VERBO: 'VERBO',
  SUSTANTIVO: 'SUSTANTIVO',
  MODIFICADOR: 'MODIFICADOR'
});

const PATRONES_REPORTADOS = [
  CATEGORIAS.CORREO, CATEGORIAS.URL, CATEGORIAS.FECHA, CATEGORIAS.HORA, CATEGORIAS.TELEFONO,
  CATEGORIAS.MONEDA, CATEGORIAS.PORCENTAJE, CATEGORIAS.NUMERO, CATEGORIAS.HASHTAG,
  CATEGORIAS.MENCION, CATEGORIAS.ROMANO, CATEGORIAS.SIGLA, CATEGORIAS.DOMINIO, CATEGORIAS.PALABRA_SIGNOS, CATEGORIAS.CODIGO
];

/** Tope de seguridad para la lista completa de palabras menos repetidas (libros enteros) */
const MAX_MENOS_REPETIDAS = 100000;

const cacheStemmers = {};
function obtenerStemmer(nombre) {
  if (!cacheStemmers[nombre]) cacheStemmers[nombre] = snowball.newStemmer(nombre);
  return cacheStemmers[nombre];
}

const esCapitalizada = (texto) => /^\p{Lu}/u.test(texto) && /\p{Ll}/u.test(texto);

/**
 * Analiza un texto completo.
 * @param {string} texto contenido del archivo
 * @param {string} codigoIdioma es | en | ru
 */
function analizarTexto(texto, codigoIdioma) {
  const idioma = obtenerIdioma(codigoIdioma);
  if (!idioma) throw new Error('IDIOMA_NO_SOPORTADO');
  if (typeof texto !== 'string') throw new Error('TEXTO_INVALIDO');

  const inicio = Date.now();
  const minuscula = (s) => s.toLocaleLowerCase(idioma.codigo);

  // ---------------------------------------------------------------- Fase 1 y 2
  const { tokens, transiciones } = escanear(texto, { abreviaturas: idioma.abreviaturas });

  const conteoCategorias = {};
  const patrones = {};
  PATRONES_REPORTADOS.forEach((c) => { patrones[c] = new Map(); });

  const flujo = []; // palabras en orden; null = corte de contexto (signo, número, etc.)
  const siglasPropias = new Map();
  let totalPalabras = 0;
  let totalOraciones = 0;
  let totalLexemas = 0;
  let sumaLongitudes = 0;

  for (const token of tokens) {
    if (token.tipo !== TIPOS_TOKEN.LEXEMA) {
      if (flujo[flujo.length - 1] !== null) flujo.push(null);
      continue;
    }
    totalLexemas++;
    if (token.inicioOracion) totalOraciones++;

    const categoria = clasificarLexema(token.valor);
    conteoCategorias[categoria] = (conteoCategorias[categoria] || 0) + 1;

    // "ho.a": se reporta en su propia clasificación Y también cuenta como palabra
    if (categoria === CATEGORIAS.PALABRA_SIGNOS) incrementar(patrones[categoria], token.valor);

    if (categoria !== CATEGORIAS.PALABRA && categoria !== CATEGORIAS.PALABRA_SIGNOS) {
      if (patrones[categoria]) incrementar(patrones[categoria], token.valor);
      // Siglas con puntos (L.A., O.N.U., EE.UU.) son nombres de lugares o instituciones
      if (categoria === CATEGORIAS.SIGLA && token.valor.includes('.') && /\p{Lu}/u.test(token.valor)) {
        incrementar(siglasPropias, token.valor);
      }
      if (flujo[flujo.length - 1] !== null) flujo.push(null);
      continue;
    }

    totalPalabras++;
    const partes = idioma.expandirContraccion(token.valor);
    partes.forEach((parte, idx) => {
      const limpio = parte.replace(/\.$/, '');
      sumaLongitudes += idx === 0 ? limpio.length : 0;
      flujo.push({
        texto: limpio,
        min: minuscula(limpio),
        minConPunto: minuscula(parte),
        inicioOracion: idx === 0 && token.inicioOracion,
        cat: null,
        raiz: null
      });
    });
  }

  // ---------------------------------------------------------------- Fase 3
  detectarNombres(flujo, idioma);
  contarNombresAlInicioDeOracion(flujo, idioma);

  // ---------------------------------------------------------------- Fase 4
  const stemmer = obtenerStemmer(idioma.stemmer);
  clasificarFuncionalesYPronombres(flujo, idioma);
  clasificarVerbosYSustantivos(flujo, idioma);

  // ---------------------------------------------------------------- Fase 5 y 6
  const frecuencias = new Map();
  const frecuenciasContenido = new Map();
  const pronombres = new Map();
  const personas = new Map();
  const propios = new Map();
  const adverbios = new Map();
  const sustantivos = new Map();
  const verbos = new Map();

  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!w) continue;
    incrementar(frecuencias, w.min);

    switch (w.cat) {
      case CAT.PERSONA:
      case CAT.PROPIO: {
        // Las secuencias se registran una sola vez (en su primera palabra)
        if (w.nombreCompleto) incrementar(w.cat === CAT.PERSONA ? personas : propios, w.nombreCompleto);
        break;
      }
      case CAT.PRONOMBRE: incrementar(pronombres, w.min); break;
      case CAT.ADVERBIO: incrementar(adverbios, w.min); break;
      case CAT.VERBO: agruparPorRaiz(verbos, w.raiz || stemmer.stem(w.min), w.min); break;
      case CAT.SUSTANTIVO: agruparPorRaiz(sustantivos, stemmer.stem(w.min), w.min); break;
      default: break;
    }

    const esAuxiliar = w.raiz && idioma.verbosAuxiliaresFrecuencia.has(w.raiz);
    const esContenido = ![CAT.FUNCIONAL, CAT.PRONOMBRE, CAT.AMBIGUO].includes(w.cat) && !esAuxiliar && w.min.length > 1;
    if (esContenido) incrementar(frecuenciasContenido, w.min);
  }

  // Siglas con puntos también cuentan como nombres propios (con todas sus repeticiones)
  siglasPropias.forEach((veces, sigla) => { propios.set(sigla, (propios.get(sigla) || 0) + veces); });

  const ordenar = (mapa) => [...mapa.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], idioma.codigo));

  const aLista = (mapa, clave = 'palabra', limite = LIMITE_LISTAS) => ordenar(mapa)
    .slice(0, limite)
    .map(([valor, frecuencia]) => ({ [clave]: valor, frecuencia }));

  const listaRaices = (mapa) => [...mapa.values()]
    .sort((a, b) => b.frecuencia - a.frecuencia || a.raiz.localeCompare(b.raiz, idioma.codigo))
    .slice(0, LIMITE_LISTAS)
    .map((g) => ({ raiz: g.raiz, formas: [...g.formas].slice(0, 8), frecuencia: g.frecuencia }));

  // Palabras menos repetidas = las de frecuencia mínima (normalmente 1)
  const ordenContenido = ordenar(frecuenciasContenido);
  const frecuenciaMinima = ordenContenido.length ? ordenContenido[ordenContenido.length - 1][1] : 0;
  const menos = ordenContenido
    .filter(([, f]) => f === frecuenciaMinima)
    .map(([p]) => p)
    .sort((a, b) => a.localeCompare(b, idioma.codigo));

  // Palabras en MAYÚSCULAS que en el texto también aparecen en minúscula ("LA", "POR",
  // "CUEVA" de un título) son palabras comunes escritas en mayúsculas, no siglas
  patrones[CATEGORIAS.SIGLA].forEach((veces, sigla) => {
    if (!sigla.includes('.') && frecuencias.has(minuscula(sigla))) patrones[CATEGORIAS.SIGLA].delete(sigla);
  });

  const otrosPatrones = {};
  PATRONES_REPORTADOS.forEach((c) => { otrosPatrones[c] = aLista(patrones[c], 'valor'); });

  return {
    idioma: { codigo: idioma.codigo, nombre: idioma.nombre },
    resumen: {
      totalPalabras,
      palabrasUnicas: frecuencias.size,
      totalOraciones,
      totalLexemas,
      totalCaracteres: texto.length,
      promedioLetrasPorPalabra: totalPalabras ? Number((sumaLongitudes / totalPalabras).toFixed(2)) : 0,
      tiempoMs: Date.now() - inicio
    },
    masRepetidas: aLista(frecuenciasContenido, 'palabra', TOP_FRECUENCIAS),
    masRepetidasIncluyendoFuncionales: aLista(frecuencias, 'palabra', TOP_FRECUENCIAS),
    // Todas, en orden alfabético de la A a la Z (antes solo las primeras 40: solo salía la "A")
    menosRepetidas: { frecuencia: frecuenciaMinima, total: menos.length, palabras: menos.slice(0, MAX_MENOS_REPETIDAS) },
    pronombresPersonales: aLista(pronombres),
    nombresPersonas: aLista(personas, 'nombre'),
    otrosNombresPropios: aLista(propios, 'nombre'),
    sustantivos: listaRaices(sustantivos),
    verbos: listaRaices(verbos),
    adverbios: aLista(adverbios),
    otrosPatrones,
    automata: {
      estados: Object.values(ESTADOS),
      transiciones,
      tokensPorCategoria: conteoCategorias
    }
  };
}

// ============================================================================
// Fase 3: nombres de personas y otros nombres propios
// ============================================================================
function detectarNombres(flujo, idioma) {
  const puedeSerNombre = (w) => w && esCapitalizada(w.texto)
    && !idioma.funcionales.has(w.min) && !idioma.pronombres.has(w.min)
    && !idioma.titulos.has(w.minConPunto) && !idioma.titulos.has(w.min);

  // Palabras que en el texto también aparecen en minúscula ("llegó", "era"): si van al
  // inicio de una oración no forman parte del nombre ("Llegó Úrsula" -> "Úrsula")
  const enMinuscula = new Set();
  flujo.forEach((x) => { if (x && x.texto === x.min) enMinuscula.add(x.min); });

  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!puedeSerNombre(w) || idioma.noPersonas.has(w.min)) continue;
    if (w.inicioOracion && enMinuscula.has(w.min)) continue;

    // Extiende la secuencia: "Gabriel García Márquez", "Juan de la Cruz"
    const secuencia = [i];
    let j = i + 1;
    while (j < flujo.length && secuencia.length < 6) {
      if (puedeSerNombre(flujo[j])) { secuencia.push(j); j++; continue; }
      let k = j;
      while (flujo[k] && idioma.conectoresNombre.has(flujo[k].min) && !esCapitalizada(flujo[k].texto)) k++;
      if (k > j && puedeSerNombre(flujo[k])) {
        for (let x = j; x <= k; x++) secuencia.push(x);
        j = k + 1;
        continue;
      }
      break;
    }

    const palabras = secuencia.map((idx) => flujo[idx]);
    const ultima = palabras[palabras.length - 1];
    const anterior = flujo[i - 1];
    const tieneTitulo = anterior && (idioma.titulos.has(anterior.minConPunto) || idioma.titulos.has(anterior.min));
    // También nombres compuestos con guion: "María-José", "Jean-Paul"
    const tieneNombreComun = palabras.some((p) => idioma.nombresComunes.has(p.min)
      || (p.min.includes('-') && p.min.split('-').some((parte) => idioma.nombresComunes.has(parte))));
    const tieneApellido = idioma.patronApellido
      && idioma.patronApellido.test(ultima.texto)
      && (secuencia.length >= 2 || !w.inicioOracion);

    const esInstitucion = idioma.prefijosLugar.has(w.min);

    let categoria = null;
    if (esInstitucion) categoria = CAT.PROPIO;
    else if (tieneTitulo || tieneNombreComun || tieneApellido) categoria = CAT.PERSONA;
    else if (!(w.inicioOracion && secuencia.length === 1)) categoria = CAT.PROPIO;

    if (categoria) {
      palabras.forEach((p) => { p.cat = categoria; });
      w.nombreCompleto = palabras.map((p) => p.texto).join(' ');
    }
    i = j - 1;
  }
}

/**
 * Un nombre de una sola palabra al inicio de una oración no se puede distinguir por la
 * mayúscula ("Jean-Paul llegó." / "Roma es bella."). Si ese mismo nombre ya se reconoció
 * en otra parte del texto, aquí también se cuenta, para que salga con todas sus repeticiones.
 */
function contarNombresAlInicioDeOracion(flujo, idioma) {
  const conocidos = new Map();
  // Palabras que también aparecen en minúscula ("era", "cien") son palabras comunes,
  // no nombres: así "Era" al inicio de oración no se cuenta como nombre propio
  const enMinuscula = new Set();
  flujo.forEach((w) => {
    if (!w) return;
    if (w.nombreCompleto && w.nombreCompleto === w.texto) conocidos.set(w.min, w.cat);
    if (w.texto === w.min) enMinuscula.add(w.min);
  });
  if (!conocidos.size) return;
  flujo.forEach((w) => {
    if (!w || w.cat || !w.inicioOracion || !esCapitalizada(w.texto)) return;
    if (idioma.funcionales.has(w.min) || idioma.pronombres.has(w.min) || enMinuscula.has(w.min)) return;
    const cat = conocidos.get(w.min);
    if (cat) { w.cat = cat; w.nombreCompleto = w.texto; }
  });
}

// ============================================================================
// Fase 4a: palabras funcionales, pronombres y adverbios
// ============================================================================
function clasificarFuncionalesYPronombres(flujo, idioma) {
  const patronAdverbio = PATRON_ADVERBIO[idioma.codigo];

  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!w || w.cat) continue;

    if (idioma.titulos.has(w.minConPunto) || idioma.titulos.has(w.min)) w.cat = CAT.FUNCIONAL;
    else if (idioma.pronombres.has(w.min)) w.cat = CAT.PRONOMBRE;
    else if (idioma.pronombresAmbiguos.has(w.min)) {
      // "la vi" -> pronombre ; "la casa" -> artículo
      const siguiente = flujo[i + 1];
      w.cat = siguiente && !siguiente.cat && esVerboSeguro(siguiente.min, idioma) ? CAT.PRONOMBRE : CAT.AMBIGUO;
    } else if (idioma.funcionales.has(w.min)) w.cat = CAT.FUNCIONAL;
    else if (patronAdverbio && patronAdverbio.test(w.min) && !idioma.excepcionesAdverbio.has(w.min)) w.cat = CAT.ADVERBIO;
  }
}

// ============================================================================
// Fase 4b: verbos y sustantivos
// ============================================================================
function esVerboSeguro(min, idioma) {
  if (idioma.verbosIrregulares[min]) return true;
  if (idioma.excepcionesVerbo.has(min) || esSustantivoPorTerminacion(min, idioma)) return false;
  return idioma.reglasVerbo.some((r) => r.test(min));
}

function esSustantivoPorTerminacion(min, idioma) {
  return idioma.reglasSustantivo.some((r) => r.test(min));
}

function clasificarVerbosYSustantivos(flujo, idioma) {
  const libre = (w) => w && !w.cat;
  /** ¿La palabra anterior es un determinante que introduce un sustantivo? */
  const esContextoNominal = (prev, w) => {
    if (!prev) return false;
    if (prev.cat === CAT.AMBIGUO) return true; // "la casa"
    if (!idioma.determinantes.has(prev.min)) return false;
    if (prev.cat === CAT.FUNCIONAL) return true;
    // "her book" (posesivo) vs "her saw" no aplica: solo si lo siguiente no es verbo seguro
    return prev.cat === CAT.PRONOMBRE && !esVerboSeguro(w.min, idioma);
  };

  const marcarVerbo = (w) => {
    w.cat = CAT.VERBO;
    w.raiz = idioma.verbosIrregulares[w.min] || null;
  };

  const tieneContextoVerbal = (i) => {
    const prev = flujo[i - 1];
    if (!prev) return false;
    if (idioma.contextoVerbal.has(prev.min)) return true;
    // Sujeto = nombre de persona: "Juan llegó", "Mary and Peter study"
    if (prev.cat === CAT.PERSONA) return true;
    // Permite un adverbio intermedio: "she really likes"
    const prev2 = flujo[i - 2];
    return prev.cat === CAT.ADVERBIO && prev2 && idioma.contextoVerbal.has(prev2.min);
  };

  /** Frase nominal tras determinante o preposición: marca su núcleo como sustantivo */
  const resolverFraseNominal = (i) => {
    if (idioma.nucleoFrase === 'primero') {
      let k = i;
      while (libre(flujo[k]) && idioma.adjetivosPrenominales.has(flujo[k].min) && libre(flujo[k + 1])) {
        flujo[k].cat = CAT.MODIFICADOR;
        k++;
      }
      flujo[k].cat = CAT.SUSTANTIVO;
      return;
    }
    // Núcleo al final (inglés, ruso): "the big red house", "в большом доме"
    const frase = [i];
    let j = i + 1;
    while (libre(flujo[j]) && frase.length < 4 && !esVerboSeguro(flujo[j].min, idioma)) {
      const actual = flujo[frase[frase.length - 1]];
      if (idioma.patronAdjetivo && !idioma.patronAdjetivo.test(actual.min)) break;
      frase.push(j);
      j++;
    }
    frase.forEach((idx, n) => { flujo[idx].cat = n === frase.length - 1 ? CAT.SUSTANTIVO : CAT.MODIFICADOR; });
  };

  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!libre(w)) continue;
    const prev = flujo[i - 1];
    const min = w.min;

    // 1) Determinante antes: "el estado", "the plan" -> sustantivo
    if (esContextoNominal(prev, w)) { resolverFraseNominal(i); continue; }

    // 2) Verbo irregular conocido
    if (idioma.verbosIrregulares[min]) { marcarVerbo(w); continue; }

    // 3) Auxiliar + participio/gerundio: "ha comido", "has eaten"
    if (prev && idioma.auxiliares.has(prev.min) && idioma.reglasVerboConAuxiliar.some((r) => r.test(min))) {
      marcarVerbo(w); continue;
    }

    // 4) Contexto verbal: "yo camino", "she likes", "не знаю"
    if (tieneContextoVerbal(i)) {
      if (esSustantivoPorTerminacion(min, idioma)) w.cat = CAT.SUSTANTIVO;
      else marcarVerbo(w);
      continue;
    }

    // 5) Terminación verbal segura
    if (esVerboSeguro(min, idioma)) { marcarVerbo(w); continue; }

    // 6) Preposición antes: "de la ciudad" ya se resolvió; "con esfuerzo", "in school"
    if (prev && idioma.preposiciones.has(prev.min)) { resolverFraseNominal(i); continue; }

    // 7) Terminación de sustantivo
    if (esSustantivoPorTerminacion(min, idioma)) { w.cat = CAT.SUSTANTIVO; continue; }

    // 8) Ruso: palabra de contenido que no es adjetivo ni adverbio -> sustantivo
    if (idioma.sustantivoPorDefecto && min.length > 2
      && !idioma.patronAdjetivo.test(min) && !idioma.patronVerboDebil.test(min) && !/о$/u.test(min)) {
      w.cat = CAT.SUSTANTIVO;
    }
  }
}

// ============================================================================
// Utilidades
// ============================================================================
function incrementar(mapa, clave) {
  mapa.set(clave, (mapa.get(clave) || 0) + 1);
}

function agruparPorRaiz(mapa, raiz, forma) {
  if (!mapa.has(raiz)) mapa.set(raiz, { raiz, formas: new Set(), frecuencia: 0 });
  const grupo = mapa.get(raiz);
  grupo.formas.add(forma);
  grupo.frecuencia++;
}

module.exports = { analizarTexto, CAT };
