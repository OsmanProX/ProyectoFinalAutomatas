const router = require('express').Router();
const multer = require('multer');
const { getTranslation } = require('../utils/i18n');

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

const LANGS = ['es', 'en'];

// Renderiza el formulario con las traducciones y el idioma de la sesión
function renderForm(req, res, error = null) {
  const lang = req.session.lang || 'es';
  const t = getTranslation(lang);
  res.render('analyze', { t, lang, error });
}

// GET /analyze -> muestra el formulario
router.get('/', (req, res) => {
  renderForm(req, res);
});

// POST /analyze -> recibe archivo + idioma
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

    // === PUNTO DE UNIÓN CON TU COMPAÑERO ===
    // const { analyze } = require('../services/lexicalAnalyzer');
    // const result = analyze(text, language);
    // req.session.lastAnalysis = result;
    // return res.render('results', { t, lang, result });

    // Mientras tanto, para probar:
    res.send(`Archivo: ${req.file.originalname} | Idioma: ${language} | Caracteres: ${text.length}`);
  });
});

module.exports = router;