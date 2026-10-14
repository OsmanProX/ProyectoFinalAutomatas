const router = require('express').Router();
const multer = require('multer');

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

// GET /analyze -> muestra el formulario
router.get('/', (req, res) => {
  res.render('analyze', { error: null });
});

// POST /analyze -> recibe archivo + idioma
router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err || !req.file) {
      return res.render('analyze', {
        error: err ? err.message : 'Selecciona un archivo .txt'
      });
    }

    const language = LANGS.includes(req.body.language) ? req.body.language : 'es';
    const text = req.file.buffer.toString('utf8');


    if (!text.trim()) {
      return res.render('analyze', { error: 'El archivo está vacío' });
    }

    // const { analyze } = require('../services/lexicalAnalyzer');
    // const result = analyze(text, language);
    // req.session.lastAnalysis = result;
    // return res.render('results', { result });

    // Mientras tanto, para probar:
    res.send(`Archivo: ${req.file.originalname} | Idioma: ${language} | Caracteres: ${text.length}`);
  });
});

module.exports = router;