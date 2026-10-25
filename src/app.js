require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const profileRoutes = require('./routes/profile.routes');
const credentialRoutes = require('./routes/credential.routes');
const passwordResetRoutes = require('./routes/password-reset.routes');
const analysisRoutes = require('./routes/analysis.routes');
const faceRoutes = require('./routes/face.routes');
const apiRoutes = require('./routes/api.routes');
const webhookRoutes = require('./routes/webhook.routes');
const roleRoutes = require('./routes/role.routes');
const roleRepository = require('./repositories/role.repository');
const menuPermissionRepository = require('./repositories/menu-permission.repository');
const { authMiddleware, activeRoleMiddleware, menuPermissionMiddleware } = require('./middlewares/auth.middleware');
const recaptchaService = require('./services/recaptcha.service');
// Seguridad web (OWASP): límite de intentos, protección CSRF y cabeceras seguras
const { limiteIntentos, verificarOrigen, cabecerasSeguras } = require('./middlewares/security.middleware');
const { jwtAuth } = require('./middlewares/jwt.middleware');
const { getTranslation } = require('./utils/i18n');
const { noEncontrado, manejarError } = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// No anunciar la tecnología del servidor y agregar cabeceras de seguridad a todo
app.disable('x-powered-by');
app.use(cabecerasSeguras);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Segmentacion y verificacion facial locales (reemplazan la API externa).
// Va ANTES de /api: ese router tiene un 404 catch-all para todo /api/*.
// Ahora requieren token JWT (antes eran públicos) y tienen límite de peticiones:
// la web no los usa (el login y el registro llaman al servicio directo en el servidor).
const limiteRostroApi = limiteIntentos({ nombre: 'api-rostro', max: 30, ventanaMs: 10 * 60 * 1000, contarTodo: true });
app.use('/api/rostro', limiteRostroApi, jwtAuth, faceRoutes);
// API REST con JWT (Authorization: Bearer <token>). Va antes de la sesión y del
// lector de JSON de la web: tiene su propio lector, límites y errores en JSON.
app.use('/api', apiRoutes);
// Webhook de Wawp (estado de entrega de los WhatsApp, sin polling). Público, protegido con clave en la URL
app.use('/webhooks', webhookRoutes);

// Límite de 4 MB: el registro envía la foto original y la modificada (data URL)
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Rendimiento: los modelos del rostro (varios MB) y las imágenes casi no cambian;
// el navegador los guarda 7 días y no los vuelve a descargar en cada página.
// (CSS y JS siguen sin caché larga para que los cambios se vean al recargar.)
const CACHE_LARGO = { maxAge: '7d', index: false };
app.use('/models', express.static(path.join(__dirname, '..', 'assets', 'models'), CACHE_LARGO));
app.use('/img', express.static(path.join(__dirname, '..', 'assets', 'img'), CACHE_LARGO));
app.use(express.static(path.join(__dirname, '..', 'assets')));
// face-api.js para el navegador (guía del rostro en la cámara); solo la carpeta dist
app.use('/vendor/face-api', express.static(path.join(__dirname, '..', 'node_modules', '@vladmandic', 'face-api', 'dist'), CACHE_LARGO));
app.use('/js', express.static(path.join(__dirname, '..', 'assets', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'assets', 'css')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  // httpOnly: JavaScript no puede leer la cookie (XSS); sameSite lax: otro sitio no puede enviar
  // formularios con la sesión del usuario (CSRF)
  cookie: { maxAge: 1000 * 60 * 60 * 2, httpOnly: true, sameSite: 'lax' }
}));

// Clave pública del reCAPTCHA para las vistas de login y registro (null = desactivado)
app.use((req, res, next) => {
  res.locals.recaptchaSiteKey = recaptchaService.siteKey();
  res.locals.recaptchaVersion = recaptchaService.version();
  next();
});

// Usuario en todas las vistas + estado ACTUAL del rol y permisos de menu
// (si el admin los cambia, el cambio se refleja sin cerrar sesion)
app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.menuPermissions = null;
  if (res.locals.user && res.locals.user.id_role) {
    try {
      const role = await roleRepository.findById(res.locals.user.id_role);
      if (role) {
        res.locals.user.role = role.name;
        res.locals.user.role_active = role.active;
      }
    } catch (err) {
      // Si falla la consulta se conservan los valores de la sesion
    }
    try {
      res.locals.menuPermissions = await menuPermissionRepository.findByRole(res.locals.user.id_role);
    } catch (err) {
      // Si falla la consulta no se restringe el menu
    }
  }
  next();
});

// CSRF: todo POST/PUT/DELETE de las páginas debe venir de este mismo sitio
app.use(verificarOrigen);

// Límite de intentos (fuerza bruta). Los fallidos se cuentan por apodo (max) y por IP
// (3 veces más, porque en un salón varias personas comparten IP); al entrar bien, el
// contador se limpia. El aviso sale en la misma pantalla.
const QUINCE_MIN = 15 * 60 * 1000;
const mensajeEspera = (req, segundos) => {
  const t = getTranslation(req.session.lang || 'es');
  return t.security_too_many.replace('{min}', Math.max(1, Math.ceil(segundos / 60)));
};
app.post('/login', limiteIntentos({
  nombre: 'login', max: 8, ventanaMs: QUINCE_MIN,
  alBloquear: (req, res, seg) => res.status(429).render('login', {
    t: getTranslation(req.session.lang || 'es'), lang: req.session.lang || 'es', error: mensajeEspera(req, seg), success: null
  })
}));
app.post('/login/face', limiteIntentos({ nombre: 'login-rostro', max: 10, ventanaMs: QUINCE_MIN }));
app.post('/login/qr', limiteIntentos({ nombre: 'login-qr', max: 10, ventanaMs: QUINCE_MIN }));
app.post('/register', limiteIntentos({
  nombre: 'registro', max: 10, maxIp: 40, ventanaMs: 60 * 60 * 1000, contarTodo: true,
  alBloquear: (req, res, seg) => res.status(429).render('register', {
    t: getTranslation(req.session.lang || 'es'), lang: req.session.lang || 'es', error: mensajeEspera(req, seg), values: {}
  })
}));
app.post('/recuperar/codigo', limiteIntentos({ nombre: 'recuperar-codigo', max: 8, maxIp: 30, ventanaMs: QUINCE_MIN, contarTodo: true }));
app.post('/recuperar/confirmar', limiteIntentos({ nombre: 'recuperar-confirmar', max: 10, maxIp: 30, ventanaMs: QUINCE_MIN, contarTodo: true }));

app.use('/', authRoutes);
app.use('/users', authMiddleware, userRoutes);
app.use('/perfil', authMiddleware, menuPermissionMiddleware('perfil'), profileRoutes);
app.use('/analyze', authMiddleware, activeRoleMiddleware, menuPermissionMiddleware('analisis'), analysisRoutes);
app.use('/roles', authMiddleware, roleRoutes);
app.use('/credencial', credentialRoutes);
app.use('/recuperar', passwordResetRoutes);

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/users/dashboard');
  }
  res.redirect('/login');
});

// ------------------------------------------------------------------ errores
// 404 y errores con el diseño del sitio, sin detalles internos (ver error.middleware.js)
app.use(noEncontrado);
app.use(manejarError);

// Migracion automatica: crea role_menu_permissions si no existe y puebla permisos por defecto
async function migrateMenuPermissions() {
  const pool = require('./config/db');
  const { MENU_KEYS } = require('./config/constants');
  try {
    // Ojo: roles.id es INT (con signo); id_role debe ser INT tambien o la FK falla
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_menu_permissions (
        id       INT NOT NULL AUTO_INCREMENT,
        id_role  INT NOT NULL,
        menu_key VARCHAR(50) NOT NULL,
        active   BIT(1) NOT NULL DEFAULT b'1',
        PRIMARY KEY (id),
        CONSTRAINT uq_role_menu UNIQUE (id_role, menu_key),
        CONSTRAINT fk_rmp_role FOREIGN KEY (id_role) REFERENCES roles (id) ON DELETE CASCADE
      )
    `);
    for (const key of MENU_KEYS) {
      await pool.query(
        "INSERT IGNORE INTO role_menu_permissions (id_role, menu_key, active) SELECT id, ?, b'1' FROM roles",
        [key]
      );
    }
    console.log('Migracion role_menu_permissions: tabla lista');
  } catch (err) {
    console.warn('No se pudo migrar role_menu_permissions:', err.message);
  }
}

migrateMenuPermissions().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    // Reconocimiento facial: carga los modelos en segundo plano para que el primer login sea rápido
    require('./services/face-local.service').precalentar()
      .then(() => console.log('[Rostro] Modelos listos'))
      .catch((err) => console.warn('[Rostro] No se pudieron precargar los modelos:', err.message));
  });
});