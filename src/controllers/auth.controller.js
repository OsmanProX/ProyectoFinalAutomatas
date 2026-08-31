const userService = require('../services/user.service');
const { getTranslation } = require('../utils/i18n');
const { LoginDTO, RegisterDTO } = require('../dto');

class AuthController {
  getLogin(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);
    const error = req.query.error || null;
    res.render('login', { t, lang, error });
  }

  async postLogin(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    try {
      const loginDTO = new LoginDTO(req.body);
      const result = await userService.authenticate(loginDTO);

      if (!result.success) {
        let errorMsg;
        switch (result.error) {
          case 'credentials_required':
          case 'invalid_credentials':
          case 'account_disabled':
            errorMsg = t.login_error;
            break;
          default:
            errorMsg = t.login_error;
        }
        return res.render('login', { t, lang, error: errorMsg });
      }
      req.session.user = result.user;
      res.redirect('/users/dashboard');
    } catch (err) {
      console.error('Error en login:', err);
      res.render('login', { t, lang, error: 'Error del servidor' });
    }
  }

  getRegister(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);
    const error = req.query.error || null;
    res.render('register', { t, lang, error });
  }

  async postRegister(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    try {
      const registerDTO = new RegisterDTO(req.body);

      if (!registerDTO.passwordsMatch()) {
        return res.render('register', { t, lang, error: t.register_error_password });
      }

      const result = await userService.register(registerDTO);
      if (!result.success) {
        let errorMsg;
        switch (result.error) {
          case 'username_exists':
            errorMsg = t.register_error_exists;
            break;
          default:
            errorMsg = result.error;
        }
        return res.render('register', { t, lang, error: errorMsg });
      }

      res.redirect('/login');
    } catch (err) {
      console.error('Error en registro:', err);
      res.render('register', { t, lang, error: 'Error del servidor' });
    }
  }

  logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }

  setLanguage(req, res) {
    const { lang } = req.params;
    req.session.lang = lang;
    const referer = req.get('Referer') || '/';
    res.redirect(referer);
  }
}

module.exports = new AuthController();
