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
const roleRoutes = require('./routes/role.routes');
const roleRepository = require('./repositories/role.repository');
const { authMiddleware, activeRoleMiddleware } = require('./middlewares/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// Usuario en todas las vistas + estado ACTUAL del rol (si el admin lo desactiva,
// el cambio se refleja sin necesidad de cerrar sesion)
app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
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
  }
  next();
});

app.use('/', authRoutes);
app.use('/users', authMiddleware, userRoutes);
app.use('/perfil', authMiddleware, profileRoutes);
app.use('/analyze', authMiddleware, activeRoleMiddleware, analysisRoutes);
app.use('/roles', authMiddleware, roleRoutes);
app.use('/credencial', credentialRoutes);
app.use('/recuperar', passwordResetRoutes);

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/users/dashboard');
  }
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});