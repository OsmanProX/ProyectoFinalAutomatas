/**
 * ============================================================================
 * AUTÓMATA FINITO DETERMINISTA (AFD) - ESCÁNER LÉXICO
 * ============================================================================
 * Recorre el texto carácter por carácter y lo divide en tokens.
 *
 * Alfabeto (clases de carácter):
 *   ESPACIO      -> espacios, tabulaciones, saltos de línea
 *   FIN_ORACION  -> . ! ? …   (también 。！？ del chino y ؟ del árabe)
 *   DELIMITADOR  -> , ; ( ) [ ] { } " « » “ ” ¡ ¿ — –   (también ，、；：（）《》「」 y ، ؛)
 *   INTERNO      -> . , : ' ’ / - _ (pueden ir DENTRO de un lexema: 3.14, 10:30, don't)
 *   CARACTER     -> letras, dígitos y demás símbolos (@ # $ % ...)
 *
 * Estados:
 *   q0  INICIO      -> esperando el inicio de un token
 *   q1  EN_LEXEMA   -> acumulando caracteres de una palabra/número/correo/etc.
 *   q2  FIN_ORACION -> agrupando signos de cierre consecutivos ("...", "?!")
 *
 * Transiciones principales (con 1 carácter de anticipación, como un lexer real):
 *   q0 --ESPACIO-->      q0
 *   q0 --DELIMITADOR-->  q0   (emite PUNTUACION)
 *   q0 --FIN_ORACION-->  q2
 *   q0 --CARACTER-->     q1
 *   q1 --CARACTER-->     q1
 *   q1 --INTERNO + siguiente CARACTER--> q1  (el símbolo queda dentro del lexema)
 *   q1 --INTERNO/FIN/DELIM/ESPACIO-->  q0  (emite LEXEMA y reprocesa el carácter)
 *   q2 --FIN_ORACION-->  q2
 *   q2 --otro-->         q0   (emite FIN_ORACION y reprocesa)
 * ============================================================================
 */

const ESTADOS = Object.freeze({
  INICIO: 'q0_INICIO',
  EN_LEXEMA: 'q1_EN_LEXEMA',
  FIN_ORACION: 'q2_FIN_ORACION'
});

const CLASES = Object.freeze({
  ESPACIO: 'ESPACIO',
  FIN_ORACION: 'FIN_ORACION',
  DELIMITADOR: 'DELIMITADOR',
  INTERNO: 'INTERNO',
  CARACTER: 'CARACTER',
  FIN_TEXTO: 'FIN_TEXTO'
});

const TIPOS_TOKEN = Object.freeze({
  LEXEMA: 'LEXEMA',
  PUNTUACION: 'PUNTUACION',
  FIN_ORACION: 'FIN_ORACION'
});

const RE_ESPACIO = /\s/u;
const SIGNOS_FIN = new Set(['.', '!', '?', '…', '。', '！', '？', '؟']);
const SIGNOS_DELIMITADOR = new Set([',', ';', '(', ')', '[', ']', '{', '}', '"', '«', '»', '“', '”', '„', '¡', '¿', '—', '–', '<', '>', '|', '*',
  '，', '、', '；', '：', '（', '）', '《', '》', '「', '」', '『', '』', '【', '】', '،', '؛']);
const SIGNOS_INTERNOS = new Set(['.', ',', ':', "'", '’', '/', '-', '_']);

/**
 * Devuelve la clase (símbolo del alfabeto) de un carácter.
 */
function clasificarCaracter(c) {
  if (c === undefined) return CLASES.FIN_TEXTO;
  if (RE_ESPACIO.test(c)) return CLASES.ESPACIO;
  if (SIGNOS_INTERNOS.has(c)) return CLASES.INTERNO;
  if (SIGNOS_FIN.has(c)) return CLASES.FIN_ORACION;
  if (SIGNOS_DELIMITADOR.has(c)) return CLASES.DELIMITADOR;
  return CLASES.CARACTER;
}

/**
 * Escanea el texto y devuelve la lista de tokens.
 * @param {string} texto
 * @param {{ abreviaturas?: Set<string> }} opciones
 * @returns {{ tokens: Array, transiciones: number }}
 */
function escanear(texto, opciones = {}) {
  const abreviaturas = opciones.abreviaturas || new Set();
  const tokens = [];
  let estado = ESTADOS.INICIO;
  let lexema = '';
  let inicioLexema = 0;
  let inicioOracion = true;
  let transiciones = 0;
  let i = 0;

  const emitir = (tipo, valor, posicion) => {
    tokens.push({ tipo, valor, posicion, inicioOracion: tipo === TIPOS_TOKEN.LEXEMA ? inicioOracion : false });
    if (tipo === TIPOS_TOKEN.LEXEMA) inicioOracion = false;
    if (tipo === TIPOS_TOKEN.FIN_ORACION) inicioOracion = true;
  };

  while (i <= texto.length) {
    const c = texto[i];
    const clase = clasificarCaracter(c);
    transiciones++;

    switch (estado) {
      case ESTADOS.INICIO:
        if (clase === CLASES.FIN_TEXTO) { i++; break; }
        if (clase === CLASES.ESPACIO) { i++; break; }
        if (clase === CLASES.FIN_ORACION || c === '.') {
          lexema = c; inicioLexema = i; estado = ESTADOS.FIN_ORACION; i++; break;
        }
        if (clase === CLASES.DELIMITADOR) { emitir(TIPOS_TOKEN.PUNTUACION, c, i); i++; break; }
        if (clase === CLASES.INTERNO) {
          // Un signo interno al inicio solo abre lexema si va seguido de dígito (-5, ,5)
          const sig = texto[i + 1];
          if ((c === '-' || c === '_') && sig && clasificarCaracter(sig) === CLASES.CARACTER && /\d/.test(sig)) {
            lexema = c; inicioLexema = i; estado = ESTADOS.EN_LEXEMA; i++; break;
          }
          emitir(TIPOS_TOKEN.PUNTUACION, c, i); i++; break;
        }
        // CARACTER: inicia un lexema
        lexema = c; inicioLexema = i; estado = ESTADOS.EN_LEXEMA; i++;
        break;

      case ESTADOS.EN_LEXEMA: {
        if (clase === CLASES.CARACTER) { lexema += c; i++; break; }

        if (clase === CLASES.INTERNO) {
          // Anticipación: los signos internos (1 o 2 seguidos, o "://") quedan dentro
          // del lexema si después viene un carácter: 3.14 / correo@x.com / don't / https://
          const internos = contarInternos(texto, i);
          const sig = texto[i + internos];
          const permitido = internos <= 2 || texto.startsWith('://', i);
          if (permitido && sig !== undefined && clasificarCaracter(sig) === CLASES.CARACTER) {
            lexema += texto.slice(i, i + internos); i += internos; break;
          }
          // Abreviatura conocida o inicial (Sr. / Dr. / J.)
          if (c === '.' && esAbreviatura(lexema, abreviaturas)) {
            emitir(TIPOS_TOKEN.LEXEMA, lexema + '.', inicioLexema);
            lexema = ''; estado = ESTADOS.INICIO; i++; break;
          }
        }
        // Cualquier otro símbolo cierra el lexema y se reprocesa en q0
        emitir(TIPOS_TOKEN.LEXEMA, lexema, inicioLexema);
        lexema = ''; estado = ESTADOS.INICIO;
        break;
      }

      case ESTADOS.FIN_ORACION:
        if (clase === CLASES.FIN_ORACION || c === '.') { lexema += c; i++; break; }
        emitir(TIPOS_TOKEN.FIN_ORACION, lexema, inicioLexema);
        lexema = ''; estado = ESTADOS.INICIO;
        break;

      default:
        throw new Error(`Estado desconocido: ${estado}`);
    }
  }

  return { tokens, transiciones };
}

function contarInternos(texto, desde) {
  let k = 0;
  while (clasificarCaracter(texto[desde + k]) === CLASES.INTERNO) k++;
  return k;
}

function esAbreviatura(lexema, abreviaturas) {
  if (/^\p{Lu}$/u.test(lexema)) return true; // inicial de un nombre: "J." Rowling
  return abreviaturas.has(lexema.toLocaleLowerCase());
}

module.exports = { escanear, clasificarCaracter, ESTADOS, CLASES, TIPOS_TOKEN };
