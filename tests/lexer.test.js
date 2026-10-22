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
