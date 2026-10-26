const router = require('express').Router();
const multer = require('multer');
const { getTranslation } = require('../utils/i18n');

// Importamos el analizador léxico y el generador de PDF que creaste
const { analyzeText, SUPPORTED_LANGUAGES, agruparPorLetra } = require('../services/lexer.service');
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

// Historial de análisis en la MEMORIA RAM (sesión del usuario), sin MySQL:
// solo un resumen pequeño de los últimos 5; se borra al cerrar sesión o reiniciar el servidor
const MAX_HISTORIAL = 5;

function guardarEnHistorial(req, result, archivo) {
  if (!req.session) return;
  const anteriores = Array.isArray(req.session.analysisHistory) ? req.session.analysisHistory : [];
  const resumen = {
    fileName: archivo,
    language: result.language ? result.language.name : '',
    totalWords: result.totalWords || 0,
    uniqueWords: result.summary ? result.summary.uniqueWords : 0,
    characters: result.summary ? result.summary.characters : 0,
    timeMs: result.summary ? result.summary.timeMs : 0,
    topWords: (result.mostRepeated || []).slice(0, 3).map((i) => `${i.word} (${i.count})`).join(', '),
    date: new Date().toISOString()
  };
  // Si el más reciente es el mismo análisis (mismo archivo, idioma y conteos), solo se actualiza:
  // así reenviar el formulario (F5 / volver atrás) no repite la entrada
  const ultimo = anteriores[0];
  const mismo = ultimo && ultimo.fileName === resumen.fileName && ultimo.language === resumen.language &&
    ultimo.totalWords === resumen.totalWords && ultimo.characters === resumen.characters;
  const resto = mismo ? anteriores.slice(1) : anteriores;
  req.session.analysisHistory = [resumen, ...resto].slice(0, MAX_HISTORIAL);
}

// El navegador envía el nombre del archivo en UTF-8, pero multer lo entrega leído como latin1
// ("español" llega como "espaÃ±ol"); se corrige solo si el resultado es UTF-8 válido
function nombreOriginal(nombre) {
  const texto = String(nombre || '');
  if (!/[\u0080-\u00ff]/.test(texto) || /[^\u0000-\u00ff]/.test(texto)) return texto;
  const utf8 = Buffer.from(texto, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? texto : utf8;
}

// El resultado guardado en la sesión no trae la lista agrupada por letra (para no duplicarla);
// se vuelve a agrupar al mostrarlo
function conGruposPorLetra(resultado) {
  if (!resultado || (resultado.leastRepeatedByLetter && resultado.leastRepeatedByLetter.length)) return resultado;
  const palabras = (resultado.leastRepeated || []).map((i) => i.word);
  const code = resultado.language ? resultado.language.code : 'es';
  return { ...resultado, leastRepeatedByLetter: agruparPorLetra(palabras, code) };
}

// Renderiza el formulario con las traducciones y los resultados del análisis
function renderForm(req, res, error = null, result = null, success = null) {
  const lang = req.session ? (req.session.lang || 'es') : 'es';
  const t = getTranslation(lang);
  const history = req.session && Array.isArray(req.session.analysisHistory) ? req.session.analysisHistory : [];
  res.render('analyze', { t, lang, error, result: conGruposPorLetra(result), success, history });
}

// Canales permitidos según el método de notificación elegido en el registro
const CANALES_POR_METODO = {
  correo_electronico: ['email'],
  whatsapp: ['phone'],
  ambos: ['email', 'phone', 'both']
};
const METODO_POR_CANAL = { email: 'correo_electronico', phone: 'whatsapp', both: 'ambos' };

// GET /analyze -> Muestra la vista principal
// GET /analyze?resultado=1 -> Muestra el último análisis guardado en la sesión
// (después de procesar se redirige aquí: así al refrescar la página NO se vuelve a enviar el archivo)
router.get('/', (req, res) => {
  const ultimo = req.query.resultado && req.session ? req.session.lastAnalysis : null;
  renderForm(req, res, null, ultimo || null);
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
    // (sin la lista agrupada por letra: es la misma información y con un libro de varios MB
    // haría la sesión el doble de pesada; el PDF la vuelve a agrupar)
    if (req.session) {
      const { leastRepeatedByLetter, ...paraSesion } = result;
      req.session.lastAnalysis = paraSesion;
      req.session.lastAnalysisFile = safeFileName(nombreOriginal(req.file.originalname));
      guardarEnHistorial(req, result, req.session.lastAnalysisFile);
      // Patrón Post/Redirect/Get: se guarda la sesión y se muestra el resultado con un GET
      return req.session.save((errorSesion) => {
        if (errorSesion) {
          console.error('No se pudo guardar la sesión del análisis:', errorSesion);
          return renderForm(req, res, null, result);
        }
        return res.redirect(303, `${req.baseUrl || '/analyze'}?resultado=1`);
      });
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