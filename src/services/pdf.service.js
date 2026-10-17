// src/services/pdf.service.js
const PDFDocument = require('pdfkit');

function createAnalysisPDF(analysisResults) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    doc.fontSize(20).text('Reporte de Análisis Léxico', { align: 'center' });
    doc.moveDown();

    if (!analysisResults) {
      doc.fontSize(12).text('No hay resultados disponibles.');
      doc.end();
      return;
    }

    doc.fontSize(14).text(`Total de palabras: ${analysisResults.totalWords || 0}`);
    doc.moveDown();

    doc.fontSize(14).text('Palabras más repetidas:');
    doc.fontSize(11);
    if (analysisResults.mostRepeated && analysisResults.mostRepeated.length > 0) {
      analysisResults.mostRepeated.forEach(item => {
        doc.text(` - ${item.word}: ${item.count} vez/veces`);
      });
    } else {
      doc.text(' - Ninguna');
    }
    doc.moveDown();

    doc.fontSize(14).text('Palabras menos repetidas:');
    doc.fontSize(11);
    if (analysisResults.leastRepeated && analysisResults.leastRepeated.length > 0) {
      analysisResults.leastRepeated.forEach(item => {
        doc.text(` - ${item.word}: ${item.count} vez/veces`);
      });
    } else {
      doc.text(' - Ninguna');
    }
    doc.moveDown();

    doc.fontSize(14).text('Pronombres Personales:');
    doc.fontSize(11).text(
      analysisResults.pronouns && analysisResults.pronouns.length > 0 
        ? analysisResults.pronouns.join(', ') 
        : 'Ninguno'
    );
    doc.moveDown();

    doc.fontSize(14).text('Nombres de Personas / Propios:');
    doc.fontSize(11).text(
      analysisResults.properNouns && analysisResults.properNouns.length > 0 
        ? analysisResults.properNouns.join(', ') 
        : 'Ninguno'
    );

    doc.end();
  });
}

module.exports = { createAnalysisPDF };