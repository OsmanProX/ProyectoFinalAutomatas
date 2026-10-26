/**
 * Pruebas unitarias del analizador léxico (caja blanca).
 * Ejecutar con:  bun test
 */
const { describe, test, expect } = require('bun:test');
const { escanear, TIPOS_TOKEN } = require('../src/lexer/automata');
const { clasificarLexema, CATEGORIAS } = require('../src/lexer/patrones');
const { analizarTexto } = require('../src/lexer/analizador');
const { analizarTextoBasico } = require('../src/lexer/basico');
const { analyzeText } = require('../src/services/lexer.service');
const { decodeTextFile, safeFileName } = require('../src/utils/text-file');

const lexemas = (texto, opciones) => escanear(texto, opciones).tokens
  .filter((t) => t.tipo === TIPOS_TOKEN.LEXEMA).map((t) => t.valor);

describe('Autómata (escáner)', () => {
  test('separa palabras por espacios y signos', () => {
    expect(lexemas('Hola, mundo; adiós.')).toEqual(['Hola', 'mundo', 'adiós']);
  });

  test('mantiene signos internos dentro del lexema', () => {
    expect(lexemas('Pi vale 3.14 y son las 10:30')).toEqual(['Pi', 'vale', '3.14', 'y', 'son', 'las', '10:30']);
    expect(lexemas('Visite https://www.umg.edu.gt hoy')).toContain('https://www.umg.edu.gt');
    expect(lexemas("I don't know")).toContain("don't");
  });

  test('detecta fin de oración y marca la palabra siguiente', () => {
    const { tokens } = escanear('Uno. Dos!');
    const finales = tokens.filter((t) => t.tipo === TIPOS_TOKEN.FIN_ORACION);
    expect(finales.length).toBe(2);
    expect(tokens.find((t) => t.valor === 'Dos').inicioOracion).toBe(true);
  });

  test('no corta la oración en abreviaturas conocidas', () => {
    const { tokens } = escanear('Habló el Sr. Pérez', { abreviaturas: new Set(['sr']) });
    expect(tokens.some((t) => t.tipo === TIPOS_TOKEN.FIN_ORACION)).toBe(false);
  });

  test('reconoce la puntuación del chino y del árabe', () => {
    const { tokens } = escanear('我爱你。你好！ هل أنت بخير؟ نعم، شكرا');
    expect(tokens.filter((t) => t.tipo === TIPOS_TOKEN.FIN_ORACION).length).toBe(3);
    expect(lexemas('نعم، شكرا')).toEqual(['نعم', 'شكرا']);
  });
});

describe('Patrones (expresiones regulares)', () => {
  const casos = [
    ['soporte@miumg.edu.gt', CATEGORIAS.CORREO],
    ['https://example.com/a?b=1', CATEGORIAS.URL],
    ['15/03/2026', CATEGORIAS.FECHA],
    ['2026-03-15', CATEGORIAS.FECHA],
    ['08:30', CATEGORIAS.HORA],
    ['5555-1234', CATEGORIAS.TELEFONO],
    ['Q1500.00', CATEGORIAS.MONEDA],
    ['95%', CATEGORIAS.PORCENTAJE],
    ['3.14', CATEGORIAS.NUMERO],
    ['#Autómatas', CATEGORIAS.HASHTAG],
    ['@kevin', CATEGORIAS.MENCION],
    ['UMG', CATEGORIAS.SIGLA],
    ['canción', CATEGORIAS.PALABRA],
    ['книга', CATEGORIAS.PALABRA],
    ['كتاب', CATEGORIAS.PALABRA],
    ['COVID-19', CATEGORIAS.CODIGO]
  ];
  test.each(casos)('%s -> %s', (lexema, esperado) => {
    expect(clasificarLexema(lexema)).toBe(esperado);
  });
});

describe('Analizador - español', () => {
  const r = analizarTexto('Juan Pérez llegó temprano. Él dijo que la educación es importante. Yo estudio autómatas y ella estudia lenguajes.', 'es');

  test('cuenta palabras y oraciones', () => {
    expect(r.resumen.totalPalabras).toBe(18);
    expect(r.resumen.totalOraciones).toBe(3);
  });
  test('reconoce pronombres personales', () => {
    const p = r.pronombresPersonales.map((x) => x.palabra);
    expect(p).toEqual(expect.arrayContaining(['él', 'yo', 'ella']));
  });
  test('reconoce nombres de personas', () => {
    expect(r.nombresPersonas.map((x) => x.nombre)).toContain('Juan Pérez');
  });
  test('agrupa verbos por raíz', () => {
    const raices = r.verbos.map((v) => v.raiz);
    expect(raices).toEqual(expect.arrayContaining(['decir', 'ser']));
    const estudiar = r.verbos.find((v) => v.formas.includes('estudio'));
    expect(estudiar.formas).toEqual(expect.arrayContaining(['estudio', 'estudia']));
  });
  test('reconoce sustantivos por terminación y contexto', () => {
    const formas = r.sustantivos.flatMap((s) => s.formas);
    expect(formas).toContain('educación');
  });
});

describe('Analizador - inglés y ruso', () => {
  test('inglés: contracciones, pronombres y verbos irregulares', () => {
    const r = analizarTexto("She wrote the report. I don't like it.", 'en');
    expect(r.pronombresPersonales.map((x) => x.palabra)).toEqual(expect.arrayContaining(['she', 'i', 'it']));
    expect(r.verbos.map((v) => v.raiz)).toContain('write');
  });
  test('ruso: nombres con patronímico y verbos', () => {
    const r = analizarTexto('Лев Николаевич Толстой написал роман. Он работает.', 'ru');
    expect(r.nombresPersonas.map((x) => x.nombre)).toContain('Лев Николаевич Толстой');
    expect(r.verbos.flatMap((v) => v.formas)).toEqual(expect.arrayContaining(['написал', 'работает']));
  });
  test('rechaza idiomas no soportados', () => {
    expect(() => analizarTexto('hola', 'xx')).toThrow('IDIOMA_NO_SOPORTADO');
  });
});

describe('Analizador básico - chino y árabe', () => {
  test('chino: separa palabras sin espacios y reconoce pronombres, nombres y patrones', () => {
    const r = analizarTextoBasico('王小明先生去北京大学学习。他喜欢读书。会议在2026-03-15的08:30开始。', 'zh');
    expect(r.resumen.totalPalabras).toBeGreaterThan(8);
    expect(r.pronombresPersonales.map((x) => x.palabra)).toContain('他');
    expect(r.nombresPersonas.map((x) => x.nombre)).toContain('王小明');
    expect(r.otrosNombresPropios.map((x) => x.nombre)).toContain('北京大学');
    expect(r.verbos.map((v) => v.raiz)).toEqual(expect.arrayContaining(['学习', '喜欢']));
    expect(r.otrosPatrones.FECHA.map((x) => x.valor)).toContain('2026-03-15');
    expect(r.otrosPatrones.HORA.map((x) => x.valor)).toContain('08:30');
  });

  test('árabe: quita diacríticos, reconoce pronombres, nombres y raíces', () => {
    const r = analizarTextoBasico('ذَهَبَ الدكتور أحمد حسن إلى جامعة القاهرة. هو يدرس الكتاب، ونحن نكتب.', 'ar');
    expect(r.pronombresPersonales.map((x) => x.palabra)).toEqual(expect.arrayContaining(['هو', 'نحن']));
    expect(r.nombresPersonas.map((x) => x.nombre)).toContain('أحمد حسن');
    expect(r.otrosNombresPropios.map((x) => x.nombre)).toContain('جامعة القاهرة');
    expect(r.verbos.map((v) => v.raiz)).toEqual(expect.arrayContaining(['ذهب', 'درس', 'كتب']));
    expect(r.sustantivos.flatMap((s) => s.formas)).toContain('الكتاب');
  });
});

describe('Servicio (lexer.service)', () => {
  test('devuelve los campos que usan la vista y el PDF', () => {
    const r = analyzeText('Ana canta. Ana baila y Ana estudia.', 'es');
    expect(r.totalWords).toBe(7);
    expect(r.mostRepeated[0]).toEqual({ word: 'ana', count: 3 });
    expect(r.persons.map((p) => p.name)).toContain('Ana');
    expect(Array.isArray(r.nouns) && Array.isArray(r.verbs) && Array.isArray(r.patterns)).toBe(true);
  });

  test('corrige el error anterior: el ruso ya no queda vacío', () => {
    expect(analyzeText('Мы изучаем языки.', 'ru').totalWords).toBe(3);
  });

  test('texto vacío e idioma desconocido no fallan', () => {
    expect(analyzeText('   ', 'es').totalWords).toBe(0);
    expect(analyzeText('hola mundo', 'xx').language.code).toBe('es');
  });
});

describe('Lectura del archivo .txt', () => {
  test('UTF-8 con BOM', () => {
    expect(decodeTextFile(Buffer.from('﻿canción', 'utf8'))).toBe('canción');
  });
  test('ANSI (Windows-1252) no pierde tildes', () => {
    expect(decodeTextFile(Buffer.from([0x63, 0x61, 0x6e, 0x63, 0x69, 0xf3, 0x6e]))).toBe('canción');
  });
  test('nombre de archivo sin rutas ni caracteres peligrosos', () => {
    expect(safeFileName('../../<script>x.txt')).toBe('scriptx.txt');
  });
});

describe('Revisión de Osman: libro completo, puntos y guiones', () => {
  test('siglas con puntos (L.A., O.N.U., EE.UU.) son un solo lexema con su punto', () => {
    expect(lexemas('Vive en L.A. con la O.N.U. y EE.UU. hoy')).toEqual(['Vive', 'en', 'L.A.', 'con', 'la', 'O.N.U.', 'y', 'EE.UU.', 'hoy']);
    expect(clasificarLexema('L.A.')).toBe(CATEGORIAS.SIGLA);
    expect(clasificarLexema('a.m.')).toBe(CATEGORIAS.SIGLA);
  });

  test('si después de la sigla viene una mayúscula, también termina la oración', () => {
    const { tokens } = escanear('Vive en L.A. Mañana viaja.');
    expect(tokens.filter((t) => t.tipo === TIPOS_TOKEN.FIN_ORACION).length).toBe(2);
    expect(tokens.find((t) => t.valor === 'Mañana').inicioOracion).toBe(true);
  });

  test('una sigla con puntos se cuenta como nombre que se repite', () => {
    const r = analyzeText('Viajé a L.A. en mayo. Volví a L.A. en junio y otra vez a L.A. en julio.', 'es');
    expect(r.properNouns).toContainEqual({ name: 'L.A.', count: 3 });
    const siglas = r.patterns.find((p) => p.category === 'SIGLA');
    expect(siglas.items).toContainEqual({ value: 'L.A.', count: 3 });
  });

  test('dominios y extensiones con punto al inicio (.LA, .com, .txt)', () => {
    expect(lexemas('Compré el dominio .LA y el .com para el .txt')).toEqual(['Compré', 'el', 'dominio', '.LA', 'y', 'el', '.com', 'para', 'el', '.txt']);
    expect(clasificarLexema('.LA')).toBe(CATEGORIAS.DOMINIO);
    expect(clasificarLexema('.5')).not.toBe(CATEGORIAS.DOMINIO);
    const r = analyzeText('El .LA y el .LA otra vez.', 'es');
    expect(r.patterns.find((p) => p.category === 'DOMINIO').items).toEqual([{ value: '.LA', count: 2 }]);
  });

  test('nombres con guion se cuentan todas las veces, también al inicio de oración', () => {
    const r = analyzeText('Jean-Paul llegó tarde. Ayer vino Jean-Paul y luego María-José. María-José ríe.', 'es');
    const todos = [...r.persons, ...r.properNouns];
    expect(todos).toContainEqual({ name: 'Jean-Paul', count: 2 });
    expect(r.persons).toContainEqual({ name: 'María-José', count: 2 });
  });

  test('palabras que menos se repiten: todas y agrupadas de la A a la Z', () => {
    const letras = 'abcdefghijlmnopqrstuvz'.split('');
    // 5 palabras distintas por letra = 110 palabras que aparecen 1 vez (antes solo salían 40: "A")
    const texto = letras.flatMap((l) => [1, 2, 3, 4, 5].map((n) => `${l}${'xyw'.slice(0, n % 3)}ola${'r'.repeat(n)}`)).join(' ');
    const r = analyzeText(texto, 'es');
    expect(r.leastRepeated.length).toBe(r.leastRepeatedTotal);
    expect(r.leastRepeated.length).toBeGreaterThan(40);
    const grupos = r.leastRepeatedByLetter.map((g) => g.letter);
    expect(grupos[0]).toBe('A');
    expect(grupos).toContain('Z');
    expect(r.leastRepeatedByLetter.find((g) => g.letter === 'Z').words.every((w) => w.startsWith('z'))).toBe(true);
  });

  test('una palabra común al inicio de oración no se vuelve nombre ("Era", "Cien")', () => {
    const r = analyzeText('Llegó Úrsula a casa y llegó tarde.\nEra Úrsula la que mandaba. Era tarde y era de noche. Úrsula sonrió.', 'es');
    const nombres = [...r.persons, ...r.properNouns].map((n) => n.name);
    expect(nombres).not.toContain('Era');
    expect(nombres).not.toContain('Era Úrsula');
    expect(nombres).not.toContain('Llegó Úrsula');
    expect([...r.persons, ...r.properNouns].find((n) => n.name === 'Úrsula').count).toBe(3);
  });

  test('el PDF agrupa de la A a la Z aunque el análisis venga de la sesión sin grupos', async () => {
    const { createAnalysisPDF } = require('../src/services/pdf.service');
    const { leastRepeatedByLetter, ...sinGrupos } = analyzeText('árbol barco casa dado', 'es');
    const pdf = await createAnalysisPDF(sinGrupos, { user: 'prueba', fileName: 'x.txt' });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(leastRepeatedByLetter.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D']);
  });

  test('"ho.a" (letras con un punto en medio) cuenta como palabra y sale en su clasificación', () => {
    expect(clasificarLexema('ho.a')).toBe(CATEGORIAS.PALABRA_SIGNOS);
    const r = analyzeText('Mi hermano escribió ho.a josaft en el texto. Luego ho.a otra vez.', 'es');
    expect(r.mostRepeated).toContainEqual({ word: 'ho.a', count: 2 });
    expect(r.leastRepeated.map((x) => x.word)).toContain('josaft');
    const grupo = r.patterns.find((p) => p.category === 'PALABRA_SIGNOS');
    expect(grupo.items).toEqual([{ value: 'ho.a', count: 2 }]);
  });

  test('sin espacio después del punto ("casa.El perro") se separan las oraciones', () => {
    expect(lexemas('Fue a la casa.El perro ladró.')).toEqual(['Fue', 'a', 'la', 'casa', 'El', 'perro', 'ladró']);
    // Correos y direcciones web no se cortan
    expect(lexemas('Escribe a juan.Perez@umg.edu.gt o www.umg.edu.gt')).toEqual(['Escribe', 'a', 'juan.Perez@umg.edu.gt', 'o', 'www.umg.edu.gt']);
  });

  test('línea en blanco = fin de oración: el encabezado no se une con el párrafo', () => {
    const r = analyzeText('Gabriel García Márquez\n\nAños después, el coronel volvió.\n\nGabriel García Márquez\n\nEs tarde y es de noche.', 'es');
    const nombres = [...r.persons, ...r.properNouns].map((n) => n.name);
    expect(nombres).toContain('Gabriel García Márquez');
    expect(nombres.some((n) => n.includes('Años') || n.endsWith(' Es'))).toBe(false);
    // Un salto de línea simple (texto cortado en renglones) NO corta la oración
    expect(analyzeText('El coronel había de\nrecordar aquella tarde.', 'es').summary.sentences).toBe(1);
  });

  test('números romanos aparte y palabras en MAYÚSCULAS comunes no son siglas', () => {
    expect(clasificarLexema('XVI')).toBe(CATEGORIAS.ROMANO);
    expect(clasificarLexema('UMG')).toBe(CATEGORIAS.SIGLA);
    const r = analyzeText('Capítulo XVI. EDITADO POR LA CUEVA. La cueva era oscura por la noche. La UMG abrió.', 'es');
    const siglas = (r.patterns.find((p) => p.category === 'SIGLA') || { items: [] }).items.map((i) => i.value);
    expect(siglas).toContain('UMG');
    expect(siglas).not.toContain('LA');
    expect(siglas).not.toContain('POR');
    expect(r.patterns.find((p) => p.category === 'ROMANO').items).toEqual([{ value: 'XVI', count: 1 }]);
  });

  test('las tildes no crean grupos aparte, la Ñ sí', () => {
    const { agruparPorLetra } = require('../src/services/lexer.service');
    const g = agruparPorLetra(['árbol', 'avión', 'nube', 'ñandú', 'Óscar', '3d'], 'es');
    expect(g.map((x) => x.letter)).toEqual(['A', 'N', 'Ñ', 'O', '#']);
    expect(g[0].words).toEqual(['árbol', 'avión']);
  });
});
