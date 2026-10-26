// src/services/pdf.service.js
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/**
 * ============================================================================
 * REPORTE PDF DEL ANÁLISIS LÉXICO
 * ============================================================================
 * - Fuente DejaVu Sans (incluida en assets/fonts): acentos, ñ, ruso y árabe.
 *   La fuente por defecto de PDFKit (Helvetica) no tiene esas letras.
 * - Chino: necesita una fuente CJK. Se usa la variable PDF_CJK_FONT (ruta a un
 *   .ttf/.otf/.ttc) o una del sistema (Microsoft YaHei / SimSun en Windows,
 *   Noto Sans CJK o WenQuanYi en Linux). Si no hay ninguna, se avisa en el PDF.
 * - Colores 60-30-10: fondo blanco, títulos azul marino, acento azul.
 * ============================================================================
 */
const FUENTES = {
  normal: path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf'),
  negrita: path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf')
};

/** Fuentes CJK conocidas: [ruta, nombre dentro del .ttc] */
const CANDIDATAS_CJK = [
  ['C:\\Windows\\Fonts\\msyh.ttc', 'MicrosoftYaHei'],
  ['C:\\Windows\\Fonts\\simsun.ttc', 'SimSun'],
  ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'NotoSansCJKsc-Regular'],
  ['/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc', 'NotoSansCJKsc-Regular'],
  ['/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 'WenQuanYiMicroHei'],
  ['/System/Library/Fonts/PingFang.ttc', 'PingFangSC-Regular']
];

const COLOR = { marino: '#1a1a2e', acento: '#4361ee', texto: '#333333', suave: '#6b7280' };
const RE_HAN = /([\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF]+)/u;
/** Frase en árabe con espacios ("جامعة القاهرة"): se une con espacios duros para que PDFKit no la parta y respete el orden de derecha a izquierda */
const RE_FRASE_ARABE = /[\u0600-\u06FF]+(?: [\u0600-\u06FF]+)+/gu;
const unirArabe = (texto) => texto.replace(RE_FRASE_ARABE, (frase) => frase.replace(/ /g, '\u00A0'));

let cjkCache;
function buscarFuenteCJK() {
  if (cjkCache !== undefined) return cjkCache;
  const propia = process.env.PDF_CJK_FONT ? [[process.env.PDF_CJK_FONT, process.env.PDF_CJK_FONT_FAMILY]] : [];
  cjkCache = [...propia, ...CANDIDATAS_CJK].find(([ruta]) => ruta && fs.existsSync(ruta)) || null;
  return cjkCache;
}

const fecha = () => new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' });

/**
 * @param {object} analysisResults resultado de lexer.service.analyzeText
 * @param {{ user?: string, fileName?: string }} meta datos opcionales para el encabezado
 * @returns {Promise<Buffer>}
 */
function createAnalysisPDF(analysisResults, meta = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: 'Reporte de Análisis Léxico' } });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    try {
      const tieneDejaVu = fs.existsSync(FUENTES.normal) && fs.existsSync(FUENTES.negrita);
      if (tieneDejaVu) {
        doc.registerFont('normal', FUENTES.normal);
        doc.registerFont('negrita', FUENTES.negrita);
      }
      const cjk = buscarFuenteCJK();
      let cjkDisponible = false;
      if (cjk) {
        try { doc.registerFont('cjk', cjk[0], cjk[1]); cjkDisponible = true; } catch (err) { cjkDisponible = false; }
      }
      const fuente = (negrita) => (tieneDejaVu ? (negrita ? 'negrita' : 'normal') : (negrita ? 'Helvetica-Bold' : 'Helvetica'));

      /** Escribe una línea mezclando fuentes: caracteres chinos con la fuente CJK, lo demás con DejaVu */
      const linea = (partes, opciones = {}) => {
        const tramos = [];
        partes.forEach(({ texto, negrita, color }) => {
          unirArabe(String(texto)).split(RE_HAN).filter(Boolean).forEach((t) => {
            const esHan = RE_HAN.test(t);
            tramos.push({ t, f: esHan && cjkDisponible ? 'cjk' : fuente(negrita), color: color || COLOR.texto });
          });
        });
        if (!tramos.length) tramos.push({ t: ' ', f: fuente(false), color: COLOR.texto });
        tramos.forEach((tr, i) => {
          doc.font(tr.f).fillColor(tr.color).text(tr.t, { ...opciones, continued: i < tramos.length - 1 });
        });
      };

      const titulo = (texto) => {
        doc.moveDown(0.6);
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc.font(fuente(true)).fontSize(13).fillColor(COLOR.marino).text(texto);
        const y = doc.y + 2;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).lineWidth(1).strokeColor(COLOR.acento).stroke();
        doc.moveDown(0.4);
        doc.fontSize(10.5);
      };
      const vacio = (texto) => linea([{ texto, color: COLOR.suave }]);
      const lista = (items, formatear, textoVacio) => {
        if (!items || !items.length) return vacio(textoVacio);
        items.forEach((item) => {
          if (doc.y > doc.page.height - 70) doc.addPage();
          linea([{ texto: '• ', color: COLOR.acento }, ...formatear(item)]);
        });
      };

      // ------------------------------------------------------------ Encabezado
      doc.rect(0, 0, doc.page.width, 80).fill(COLOR.marino);
      doc.font(fuente(true)).fontSize(20).fillColor('#ffffff').text('Reporte de Análisis Léxico', 50, 28, { align: 'center' });
      doc.y = 100;
      doc.fontSize(10).fillColor(COLOR.suave);

      if (!analysisResults) {
        linea([{ texto: 'No hay resultados disponibles.' }]);
        doc.end();
        return;
      }

      const r = analysisResults;
      const idioma = r.language ? `${r.language.name}${r.language.mode === 'basico' ? ' (análisis básico)' : ''}` : '';
      const datos = [
        idioma && `Idioma: ${idioma}`,
        meta.fileName && `Archivo: ${meta.fileName}`,
        meta.user && `Usuario: ${meta.user}`,
        `Fecha: ${fecha()}`
      ].filter(Boolean);
      linea([{ texto: datos.join('   |   '), color: COLOR.suave }]);

      // ------------------------------------------------------------ Resumen
      titulo('Resumen');
      const s = r.summary || {};
      linea([{ texto: 'Cantidad total de palabras: ', negrita: true }, { texto: r.totalWords || 0 }]);
      if (r.summary) {
        linea([{ texto: `Palabras distintas: ${s.uniqueWords}   ·   Oraciones: ${s.sentences}   ·   Caracteres: ${s.characters}   ·   Promedio de letras por palabra: ${s.avgWordLength}` }]);
      }

      // ------------------------------------------------------------ Frecuencias
      titulo('Palabras que más se repiten');
      lista(r.mostRepeated, (i) => [{ texto: i.word, negrita: true }, { texto: `  (${i.count})` }], 'Ninguna');

      titulo('Palabras que menos se repiten');
      if (r.leastRepeated && r.leastRepeated.length) {
        const total = r.leastRepeatedTotal || r.leastRepeated.length;
        linea([{ texto: `${total} palabra(s) aparecen ${r.leastRepeated[0].count} vez/veces${total > r.leastRepeated.length ? ` (se muestran ${r.leastRepeated.length})` : ''}. Todas, en orden alfabético:`, color: COLOR.suave }]);
        // Una línea por letra: "A  abeja, árbol…"  "B  barco…"
        // Si el análisis viene de la sesión (sin los grupos, para que pese menos) se agrupan aquí
        const grupos = r.leastRepeatedByLetter && r.leastRepeatedByLetter.length
          ? r.leastRepeatedByLetter
          : require('./lexer.service').agruparPorLetra(r.leastRepeated.map((i) => i.word), r.language && r.language.code);
        grupos.forEach((g) => {
          if (doc.y > doc.page.height - 70) doc.addPage();
          linea([{ texto: `${g.letter}  `, negrita: true, color: COLOR.acento }, { texto: g.words.join(', ') }]);
        });
      } else vacio('Ninguna');

      // ------------------------------------------------------------ Clasificaciones
      const conConteo = (clave) => (i) => [{ texto: i[clave], negrita: true }, { texto: `  (${i.count})` }];
      const conRaiz = (i) => [
        { texto: i.root, negrita: true },
        { texto: `  (${i.count})  ←  ` , color: COLOR.suave },
        { texto: (i.forms || []).join(', ') }
      ];

      titulo('Pronombres personales');
      lista(r.pronouns, conConteo('word'), 'No se detectaron pronombres.');

      titulo('Nombres de personas');
      lista(r.persons, conConteo('name'), 'No se detectaron nombres de personas.');

      titulo('Otros nombres propios (lugares, instituciones)');
      lista(r.properNouns, conConteo('name'), 'No se detectaron otros nombres propios.');

      titulo('Sustantivos (forma raíz ← formas encontradas)');
      lista(r.nouns, conRaiz, 'No se detectaron sustantivos.');

      titulo('Verbos (forma raíz ← formas encontradas)');
      lista(r.verbs, conRaiz, 'No se detectaron verbos.');

      titulo('Otras clasificaciones reconocidas por patrón');
      linea([{ texto: 'Adverbios: ', negrita: true }, { texto: r.adverbs && r.adverbs.length ? r.adverbs.map((i) => `${i.word} (${i.count})`).join(', ') : 'ninguno' }]);
      (r.patterns || []).forEach((p) => {
        linea([{ texto: `${p.label}: `, negrita: true }, { texto: p.items.map((i) => (i.count > 1 ? `${i.value} (${i.count})` : i.value)).join(', ') }]);
      });

      // ------------------------------------------------------------ Notas
      doc.moveDown(1);
      const notas = ['Análisis basado en un autómata finito determinista (AFD), expresiones regulares y reglas del idioma; las raíces se obtienen con el algoritmo Snowball.'];
      if (r.language && r.language.mode === 'basico') notas.push('Para chino y árabe el análisis es básico: no hay mayúsculas para reconocer nombres y la clasificación es aproximada.');
      if (r.language && r.language.code === 'zh' && !cjkDisponible) notas.push('Este servidor no tiene una fuente china instalada: configure PDF_CJK_FONT para ver los caracteres chinos en el PDF.');
      doc.fontSize(8.5);
      notas.forEach((n) => linea([{ texto: n, color: COLOR.suave }]));

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { createAnalysisPDF };
