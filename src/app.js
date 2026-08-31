require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const { authMiddleware } = require('./middlewares/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'assets')));
app.use('/js', express.static(path.join(__dirname, '..', 'assets', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'assets', 'css')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', authRoutes);
app.use('/users', authMiddleware, userRoutes);

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/users/dashboard');
  }
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
