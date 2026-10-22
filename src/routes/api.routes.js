const express = require('express');
const multer = require('multer');

const router = express.Router();

const userService = require('../services/user.service');
const jwtService = require('../services/jwt.service');
const { analyzeText, LANGUAGES, SUPPORTED_LANGUAGES } = require('../services/lexer.service');
const { createAnalysisPDF } = require('../services/pdf.service');
const { LoginDTO } = require('../dto');
const { decodeTextFile, safeFileName, MAX_TEXT_BYTES } = require('../utils/text-file');
const { jwtAuth, requireActiveRole, requireMenu, requireRole } = require('../middlewares/jwt.middleware');
const loginAuditService = require('../services/login-audit.service');
const loginAuditRepository = require('../repositories/login-audit.repository');

/**
 * ============================================================================
 * API REST protegida con JWT  (prefijo /api)
 * ============================================================================
 *   GET  /api/health                 público: estado del servicio
 *   POST /api/auth/login             público: { nickname, password } -> token
 *   GET  /api/auth/me                JWT: datos del usuario del token
 *   POST /api/auth/logout            JWT: invalida el token
 *   GET  /api/analysis/languages     JWT: idiomas disponibles
 *   POST /api/analysis               JWT: análisis léxico -> JSON
 *   POST /api/analysis/report        JWT: análisis léxico -> PDF
 *
 * El análisis acepta JSON { "language": "es", "text": "..." } o multipart/form-data
 * con los campos "language" y "file" (.txt, máx. 5 MB).
 * ============================================================================
 */

// Respuestas de la API: no se guardan en caché y no se interpretan como HTML
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

// La API lee su propio JSON (hasta 6 MB: un texto de 5 MB más el resto del cuerpo);
// así los errores de JSON mal formado llegan al manejador de errores de abajo
router.use(express.json({ limit: '6mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TEXT_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith('.txt') && file.mimetype === 'text/plain';
    cb(ok ? null : Object.assign(new Error('solo_txt'), { code: 'SOLO_TXT' }), ok);
  }
});

const error = (res, status, code, message) => res.status(status).json({ success: false, error: code, message });

// ------------------------------------------------------------------ límite de intentos de login
// 10 intentos fallidos por IP cada 15 minutos (fuerza bruta, OWASP A07)
const VENTANA_MS = 15 * 60 * 1000;
const MAX_FALLIDOS = 10;
const fallidos = new Map();

function intentosBloqueados(ip) {
  const registro = fallidos.get(ip);
  if (!registro) return 0;
  if (registro.hasta < Date.now()) { fallidos.delete(ip); return 0; }
  return registro.cantidad >= MAX_FALLIDOS ? Math.ceil((registro.hasta - Date.now()) / 1000) : 0;
}

function registrarFallido(ip) {
  const ahora = Date.now();
  const registro = fallidos.get(ip);
  if (!registro || registro.hasta < ahora) fallidos.set(ip, { cantidad: 1, hasta: ahora + VENTANA_MS });
  else registro.cantidad++;
  if (fallidos.size > 5000) for (const [clave, r] of fallidos) if (r.hasta < ahora) fallidos.delete(clave);
}

// ------------------------------------------------------------------ rutas públicas
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

router.post('/auth/login', async (req, res) => {
  const ip = req.ip;
  const espera = intentosBloqueados(ip);
  if (espera) {
    loginAuditService.record(req, { method: 'api', success: false, nickname: req.body && req.body.nickname, detail: 'too_many_attempts' });
    res.set('Retry-After', String(espera));
    return error(res, 429, 'demasiados_intentos', `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(espera / 60)} minuto(s).`);
  }

  const body = req.body || {};
  if (typeof body.nickname !== 'string' || typeof body.password !== 'string'
    || body.nickname.length > 100 || body.password.length > 200) {
    return error(res, 400, 'credenciales_requeridas', 'Envía nickname y password (texto) en un JSON.');
  }

  try {
    const result = await userService.authenticate(new LoginDTO(body));
    loginAuditService.record(req, {
      method: 'api',
      success: result.success,
      user: result.success ? result.user : null,
      nickname: body.nickname,
      detail: result.success ? 'ok' : result.error
    });
    if (!result.success) {
      if (result.error === 'credentials_required') return error(res, 400, 'credenciales_requeridas', 'Envía nickname y password.');
      if (result.error === 'account_pending') return error(res, 403, 'cuenta_pendiente', 'Tu cuenta aún no ha sido activada.');
      if (result.error === 'account_disabled') return error(res, 403, 'cuenta_deshabilitada', 'Tu cuenta está deshabilitada.');
      registrarFallido(ip);
      return error(res, 401, 'credenciales_invalidas', 'Usuario o contraseña incorrectos.');
    }

    fallidos.delete(ip);
    const user = result.user;
    const { token, expiresIn, expiresAt } = jwtService.sign({ sub: user.id, nickname: user.nickname, role: user.role });
    return res.json({
      success: true,
      tokenType: 'Bearer',
      token,
      expiresIn,
      expiresAt,
      user: { id: user.id, nickname: user.nickname, fullName: user.full_name, role: user.role }
    });
  } catch (err) {
    console.error('Error en POST /api/auth/login:', err.message);
    return error(res, 500, 'error_servidor', 'No se pudo iniciar sesión. Intenta de nuevo.');
  }
});

// ------------------------------------------------------------------ rutas protegidas
router.get('/auth/me', jwtAuth, (req, res) => {
  const u = req.apiUser;
  res.json({
    success: true,
    user: {
      id: u.id,
      fullName: u.fullName,
      nickname: u.nickname,
      email: u.email,
      phone: u.phone,
      role: u.roleDisplayName(),
      roleActive: u.roleActive,
      notificationMethod: u.notificationMethod
    },
    token: { expiresAt: new Date(req.tokenPayload.exp * 1000).toISOString() }
  });
});

router.post('/auth/logout', jwtAuth, (req, res) => {
  jwtService.revoke(req.tokenPayload);
  res.json({ success: true, message: 'Sesión cerrada: el token ya no es válido.' });
});

// Bitácora de accesos (solo ADMIN): GET /api/audit/logins?usuario=&metodo=&resultado=ok|fallido&limite=
router.get('/audit/logins', jwtAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const q = req.query || {};
    const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const registros = await loginAuditRepository.find({
      nickname: texto(q.usuario, 100) || undefined,
      method: Object.prototype.hasOwnProperty.call(loginAuditService.METODOS, q.metodo) ? q.metodo : undefined,
      success: ['ok', 'fallido'].includes(q.resultado) ? q.resultado === 'ok' : undefined,
      limite: Number(q.limite) || 100
    });
    return res.json({ success: true, total: registros.length, registros });
  } catch (err) {
    console.error('Error en GET /api/audit/logins:', err.message);
    return error(res, 500, 'error_servidor', 'No se pudo leer la bitácora.');
  }
});

const accesoAnalisis = [jwtAuth, requireActiveRole, requireMenu('analisis')];

router.get('/analysis/languages', ...accesoAnalisis, (req, res) => {
  res.json({
    success: true,
    languages: SUPPORTED_LANGUAGES.map((code) => ({ code, name: LANGUAGES[code].name, mode: LANGUAGES[code].mode }))
  });
});

/** Acepta multipart (campo "file") o JSON ("text"); valida y deja req.analysisInput */
function leerEntrada(req, res, next) {
  const esMultipart = (req.get('content-type') || '').startsWith('multipart/form-data');
  const continuar = () => {
    const body = req.body || {};
    const language = typeof body.language === 'string' ? body.language.trim().toLowerCase() : '';
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return error(res, 400, 'idioma_invalido', `El campo "language" debe ser uno de: ${SUPPORTED_LANGUAGES.join(', ')}.`);
    }

    let text;
    let fileName = 'texto.txt';
    if (req.file) {
      text = decodeTextFile(req.file.buffer);
      fileName = safeFileName(req.file.originalname);
    } else if (typeof body.text === 'string') {
      text = body.text;
      if (typeof body.fileName === 'string') fileName = safeFileName(body.fileName);
    } else {
      return error(res, 400, 'texto_requerido', 'Envía el texto en "text" (JSON) o el archivo .txt en "file" (multipart).');
    }

    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) return error(res, 413, 'texto_muy_grande', 'El texto supera el límite de 5 MB.');
    if (!text.trim()) return error(res, 400, 'texto_vacio', 'El texto está vacío.');
    req.analysisInput = { language, text, fileName };
    return next();
  };

  if (!esMultipart) return continuar();
  return upload.single('file')(req, res, (err) => {
    if (!err) return continuar();
    if (err.code === 'LIMIT_FILE_SIZE') return error(res, 413, 'texto_muy_grande', 'El archivo supera el límite de 5 MB.');
    if (err.code === 'SOLO_TXT') return error(res, 400, 'solo_txt', 'Solo se permiten archivos .txt.');
    return error(res, 400, 'archivo_invalido', 'No se pudo leer el archivo enviado.');
  });
}

router.post('/analysis', ...accesoAnalisis, leerEntrada, (req, res) => {
  try {
    const { language, text, fileName } = req.analysisInput;
    const result = analyzeText(text, language);
    return res.json({ success: true, fileName, result });
  } catch (err) {
    console.error('Error en POST /api/analysis:', err.message);
    return error(res, 500, 'error_analisis', 'No se pudo analizar el texto.');
  }
});

router.post('/analysis/report', ...accesoAnalisis, leerEntrada, async (req, res) => {
  try {
    const { language, text, fileName } = req.analysisInput;
    const result = analyzeText(text, language);
    const pdf = await createAnalysisPDF(result, { user: req.apiUser.nickname, fileName });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="reporte_analisis_lexico.pdf"');
    return res.send(pdf);
  } catch (err) {
    console.error('Error en POST /api/analysis/report:', err.message);
    return error(res, 500, 'error_reporte', 'No se pudo generar el reporte PDF.');
  }
});

// Ruta /api desconocida -> JSON (no la página HTML)
router.use((req, res) => error(res, 404, 'no_encontrado', 'Endpoint no encontrado.'));

// JSON mal formado u otro error -> mensaje claro, sin detalles internos
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') return error(res, 400, 'json_invalido', 'El cuerpo no es un JSON válido.');
  if (err && err.type === 'entity.too.large') return error(res, 413, 'texto_muy_grande', 'El cuerpo de la petición es demasiado grande.');
  console.error('Error en la API:', err && err.message);
  return error(res, 500, 'error_servidor', 'Ocurrió un error inesperado.');
});

module.exports = router;
