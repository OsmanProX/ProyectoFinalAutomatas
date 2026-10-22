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
const apiRoutes = require('./routes/api.routes');
const roleRoutes = require('./routes/role.routes');
const roleRepository = require('./repositories/role.repository');
const menuPermissionRepository = require('./repositories/menu-permission.repository');
const { authMiddleware, activeRoleMiddleware, menuPermissionMiddleware } = require('./middlewares/auth.middleware');
const recaptchaService = require('./services/recaptcha.service');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// API REST con JWT (Authorization: Bearer <token>). Va antes de la sesión y del
// lector de JSON de la web: tiene su propio lector, límites y errores en JSON.
app.use('/api', apiRoutes);

// Límite de 4 MB: el registro envía la foto original y la modificada (data URL)
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

app.use(express.static(path.join(__dirname, '..', 'assets')));
app.use('/js', express.static(path.join(__dirname, '..', 'assets', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'assets', 'css')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));

// Clave pública del reCAPTCHA para las vistas de login y registro (null = desactivado)
app.use((req, res, next) => {
  res.locals.recaptchaSiteKey = recaptchaService.siteKey();
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
  });
});