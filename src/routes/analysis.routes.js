const router = require('express').Router();
const multer = require('multer');
const { getTranslation } = require('../utils/i18n');

// Importamos el analizador léxico y el generador de PDF que creaste
const { analyzeText, SUPPORTED_LANGUAGES } = require('../services/lexer.service');
const { createAnalysisPDF } = require('../services/pdf.service');
const { decodeTextFile, safeFileName, MAX_TEXT_BYTES } = require('../utils/text-file');
// Envío del reporte por el medio de notificación del registro (correo / WhatsApp)
const userRepository = require('../repositories/user.repository');
const messagingService = require('../services/messaging.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TEXT_BYTES }, // 5 MB
  fileFilter: (req, file, cb) => {
    const okExt = file.originalname.toLowerCase().endsWith('.txt');
    const okMime = file.mimetype === 'text/plain';
    if (okExt && okMime) cb(null, true);
    else cb(new Error('Solo se permiten archivos .txt'));
  }
});

const LANGS = SUPPORTED_LANGUAGES; // es, en, ru, zh, ar

// Renderiza el formulario con las traducciones y los resultados del análisis
function renderForm(req, res, error = null, result = null, success = null) {
  const lang = req.session ? (req.session.lang || 'es') : 'es';
  const t = getTranslation(lang);
  res.render('analyze', { t, lang, error, result, success });
}

// Canales permitidos según el método de notificación elegido en el registro
const CANALES_POR_METODO = {
  correo_electronico: ['email'],
  whatsapp: ['phone'],
  ambos: ['email', 'phone', 'both']
};
const METODO_POR_CANAL = { email: 'correo_electronico', phone: 'whatsapp', both: 'ambos' };

// GET /analyze -> Muestra la vista principal
router.get('/', (req, res) => {
  renderForm(req, res);
});

// POST /analyze -> Recibe el archivo .txt y ejecuta el Análisis Léxico (Inciso e)
router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {

    if (err || !req.file) {
      const mensaje = err && err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el límite de 5 MB' : (err ? err.message : 'Selecciona un archivo .txt');
      return renderForm(req, res, mensaje);
    }

    if (!LANGS.includes(req.body.language)) {
      return renderForm(req, res, 'Selecciona un idioma válido');
    }
    const language = req.body.language;
    // UTF-8 o "ANSI" (Windows-1252), sin perder tildes ni ñ
    const text = decodeTextFile(req.file.buffer);

    if (!text.trim()) {
      return renderForm(req, res, 'El archivo está vacío');
    }

    // Ejecutar el Análisis Léxico
    let result;
    try {
      result = analyzeText(text, language);
    } catch (analysisError) {
      console.error('Error en el análisis léxico:', analysisError);
      return renderForm(req, res, 'No se pudo analizar el archivo. Verifica que sea un texto válido.');
    }

    // Guardar el resultado en la sesión para generar el PDF posteriormente
    if (req.session) {
      req.session.lastAnalysis = result;
      req.session.lastAnalysisFile = safeFileName(req.file.originalname);
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
    const pdfBuffer = await createAnalysisPDF(lastAnalysis, {
      user: req.session.user ? req.session.user.nickname : undefined,
      fileName: req.session.lastAnalysisFile
    });

    // Envío por correo y/o WhatsApp (según el medio elegido en el registro)
    const canal = req.body ? req.body.notifyChannel : null;
    if (canal && canal !== 'download') {
      const user = req.session && req.session.user ? await userRepository.findById(req.session.user.id) : null;
      if (!user) return renderForm(req, res, 'Tu sesión expiró. Inicia sesión de nuevo.');
      const permitidos = CANALES_POR_METODO[user.notificationMethod] || ['email'];
      if (!permitidos.includes(canal)) {
        return renderForm(req, res, 'Ese medio no coincide con el que elegiste al registrarte.', lastAnalysis);
      }

      const archivo = 'reporte_analisis_lexico.pdf';
      const resumen = `Total de palabras: ${lastAnalysis.totalWords}`;
      const resultados = await messagingService.sendByPreference(METODO_POR_CANAL[canal], {
        email: {
          to: user.email,
          subject: '📊 Tu reporte de análisis léxico',
          html: `<p style="font-family:Arial,sans-serif">Hola, adjuntamos el reporte PDF de tu análisis léxico.<br>${resumen}</p>`,
          attachments: [{ filename: archivo, content: pdfBuffer, contentType: 'application/pdf' }]
        },
        whatsapp: {
          to: user.phone,
          tipo: 'reporte',
          userId: user.id,
          body: `📊 Hola, aquí está el reporte PDF de tu análisis léxico. ${resumen}`,
          file: { content: pdfBuffer, filename: archivo, contentType: 'application/pdf' }
        }
      });

      const enviados = resultados.filter((r) => r.ok).map((r) => (r.canal === 'whatsapp' ? 'WhatsApp' : 'correo'));
      resultados.filter((r) => !r.ok).forEach((r) => console.warn(`Reporte no enviado por ${r.canal} (${r.error})`));
      if (!enviados.length) {
        // Motivo claro para el usuario (sin datos sensibles); el detalle queda en la consola del servidor
        const MOTIVOS = {
          correo_no_configurado: 'el envío por correo no está configurado en el servidor',
          whatsapp_no_configurado: 'el envío por WhatsApp no está configurado en el servidor',
          whatsapp_cuota: 'se alcanzó el límite mensual de mensajes de WhatsApp del plan gratis',
          telefono_invalido: 'el teléfono registrado no es válido',
          correo_destino_vacio: 'no hay un correo registrado'
        };
        const motivos = [...new Set(resultados.map((r) => MOTIVOS[r.error] || 'el servicio de envío no respondió'))];
        return renderForm(req, res, `No se pudo enviar el reporte: ${motivos.join(' y ')}. Puedes elegir "Solo descargar".`, lastAnalysis);
      }
      return renderForm(req, res, null, lastAnalysis, `Reporte enviado por ${enviados.join(' y ')}.`);
    }

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