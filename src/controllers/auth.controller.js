const userService = require('../services/user.service');
const faceService = require('../services/face.service');
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
      res.render('login', { t, lang, error: t.validation_server_error });
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
          case 'validation_username_min':
            errorMsg = t.validation_username_min;
            break;
          case 'validation_username_max':
            errorMsg = t.validation_username_max;
            break;
          case 'validation_username_pattern':
            errorMsg = t.validation_username_pattern;
            break;
          case 'validation_password_min':
            errorMsg = t.validation_password_min;
            break;
          case 'validation_password_max':
            errorMsg = t.validation_password_max;
            break;
          case 'validation_fullname_min':
            errorMsg = t.validation_fullname_min;
            break;
          case 'validation_fullname_max':
            errorMsg = t.validation_fullname_max;
            break;
          case 'validation_fullname_pattern':
            errorMsg = t.validation_fullname_pattern;
            break;
          case 'validation_required':
            errorMsg = t.validation_required;
            break;
          default:
            errorMsg = result.error;
        }
        return res.render('register', { t, lang, error: errorMsg });
      }

      res.redirect('/login');
    } catch (err) {
      console.error('Error en registro:', err);
      res.render('register', { t, lang, error: t.validation_server_error });
    }
  }

  logout(req, res) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }

  async postFaceLogin(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    try {
      const { username, descriptor } = req.body;

      if (!username || !descriptor) {
        return res.status(400).json({ success: false, error: 'missing_data' });
      }

      const user = await userService.findWithPhoto(username);
      if (!user) {
        return res.status(401).json({ success: false, error: 'user_not_found' });
      }

      if (!user.isActive()) {
        return res.status(401).json({ success: false, error: 'account_disabled' });
      }

      if (!user.photo) {
        return res.status(400).json({ success: false, error: 'no_photo_registered' });
      }

      let storedDescriptor;
      try {
        storedDescriptor = JSON.parse(user.photo);
      } catch (e) {
        return res.status(500).json({ success: false, error: 'invalid_photo_data' });
      }

      const result = await faceService.verifyFace(storedDescriptor, descriptor);

      if (result.match) {
        req.session.user = user.toSession();
        return res.json({
          success: true,
          similarity: result.similarity,
          redirect: '/users/dashboard'
        });
      }

      return res.status(401).json({
        success: false,
        error: 'face_not_match',
        similarity: result.similarity
      });
    } catch (err) {
      console.error('Error en login facial:', err);
      return res.status(500).json({ success: false, error: 'server_error' });
    }
  }

  setLanguage(req, res) {
    const { lang } = req.params;
    req.session.lang = lang;
    const referer = req.get('Referer') || '/';
    res.redirect(referer);
  }
}

module.exports = new AuthController();
