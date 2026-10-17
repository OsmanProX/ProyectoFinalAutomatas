const router = require('express').Router();
const multer = require('multer');
const { getTranslation } = require('../utils/i18n');

// Importamos el analizador léxico y el generador de PDF que creaste
const { analyzeText } = require('../services/lexer.service');
const { createAnalysisPDF } = require('../services/pdf.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const okExt = file.originalname.toLowerCase().endsWith('.txt');
    const okMime = file.mimetype === 'text/plain';
    if (okExt && okMime) cb(null, true);
    else cb(new Error('Solo se permiten archivos .txt'));
  }
});

const LANGS = ['es', 'en', 'ru', 'zh', 'ar'];

// Renderiza el formulario con las traducciones y los resultados del análisis
function renderForm(req, res, error = null, result = null) {
  const lang = req.session ? (req.session.lang || 'es') : 'es';
  const t = getTranslation(lang);
  res.render('analyze', { t, lang, error, result });
}

// GET /analyze -> Muestra la vista principal
router.get('/', (req, res) => {
  renderForm(req, res);
});

// POST /analyze -> Recibe el archivo .txt y ejecuta el Análisis Léxico (Inciso e)
router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {

    if (err || !req.file) {
      return renderForm(req, res, err ? err.message : 'Selecciona un archivo .txt');
    }

    const language = LANGS.includes(req.body.language) ? req.body.language : 'es';
    const text = req.file.buffer.toString('utf8');

    if (!text.trim()) {
      return renderForm(req, res, 'El archivo está vacío');
    }

    // Ejecutar el Análisis Léxico
    const result = analyzeText(text, language);

    // Guardar el resultado en la sesión para generar el PDF posteriormente
    if (req.session) {
      req.session.lastAnalysis = result;
    }

    // Renderizar la vista pasando los resultados
    return renderForm(req, res, null, result);
  });
});

// POST /analyze/send-report -> Genera y descarga el reporte en formato PDF (Inciso f)
router.post('/send-report', async (req, res) => {
  try {
    const lastAnalysis = req.session ? req.session.lastAnalysis : null;

    if (!lastAnalysis) {
      return renderForm(req, res, 'No hay un análisis previo para generar el reporte PDF.');
    }

    // Generar el buffer del archivo PDF
    const pdfBuffer = await createAnalysisPDF(lastAnalysis);

    // Configurar encabezados para forzar la descarga del PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_analisis_lexico.pdf"');
    return res.send(pdfBuffer);

  } catch (err) {
    console.error('Error al generar el PDF:', err);
    return renderForm(req, res, 'Error al generar el reporte PDF.');
  }
});

module.exports = router;