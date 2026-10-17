const router = require('express').Router();
const multer = require('multer');
const { getTranslation } = require('../utils/i18n');
// Importamos tu servicio de análisis léxico recien creado
const { analyzeText } = require('../services/lexer.service');

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

// Renderiza el formulario con las traducciones y el idioma de la sesión
function renderForm(req, res, error = null, result = null) {
  const lang = req.session ? (req.session.lang || 'es') : 'es';
  const t = getTranslation(lang);
  res.render('analyze', { t, lang, error, result });
}

// GET /analyze -> muestra el formulario
router.get('/', (req, res) => {
  renderForm(req, res);
});

// POST /analyze -> recibe archivo + idioma y realiza el análisis léxico
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

    // === PUNTO DE UNIÓN ACTIVADO ===
    // Ejecutamos tu analizador léxico con el texto e idioma recibidos
    const result = analyzeText(text, language);

    // Guardamos el resultado en la sesión para el reporte PDF (Inciso f)
    if (req.session) {
      req.session.lastAnalysis = result;
    }

    // Renderizamos la misma vista 'analyze' pasándole el resultado obtenido
    return renderForm(req, res, null, result);
  });
});

module.exports = router;