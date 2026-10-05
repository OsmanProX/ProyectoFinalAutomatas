const userService = require('../services/user.service');
const faceService = require('../services/face.service');
const { getTranslation } = require('../utils/i18n');
const { LoginDTO, RegisterDTO } = require('../dto');
const { INACTIVE_STATE } = require('../config/constants');

class AuthController {
  getLogin(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);
    const error = req.query.error || null;
    const success = req.session.flash || null;
    delete req.session.flash;
    res.render('login', { t, lang, error, success });
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
            errorMsg = t.login_error;
            break;
          case 'account_pending':
            errorMsg = t.login_account_pending;
            break;
          case 'account_disabled':
            errorMsg = t.login_account_disabled;
            break;
          default:
            errorMsg = t.login_error;
        }
        return res.render('login', { t, lang, error: errorMsg, success: null });
      }
      req.session.user = result.user;
      res.redirect('/users/dashboard');
    } catch (err) {
      console.error('Error en login:', err);
      res.render('login', { t, lang, error: t.validation_server_error, success: null });
    }
  }

  getRegister(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);
    const error = req.query.error || null;
    res.render('register', { t, lang, error, values: {} });
  }

  async postRegister(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);

    try {
      const registerDTO = new RegisterDTO(req.body);

      if (!registerDTO.passwordsMatch()) {
        return res.render('register', {
          t,
          lang,
          error: t.register_error_password,
          values: registerDTO.toFormValues()
        });
      }

      const result = await userService.register(registerDTO);
      if (!result.success) {
        let errorMsg;
        switch (result.error) {
          case 'nickname_exists':
            errorMsg = t.register_error_exists;
            break;
          case 'email_exists':
            errorMsg = t.register_error_email_exists;
            break;
          case 'validation_nickname_required':
            errorMsg = t.validation_nickname_required;
            break;
          case 'validation_nickname_min':
            errorMsg = t.validation_nickname_min;
            break;
          case 'validation_nickname_max':
            errorMsg = t.validation_nickname_max;
            break;
          case 'validation_nickname_pattern':
            errorMsg = t.validation_nickname_pattern;
            break;
          case 'validation_role_invalid':
            errorMsg = t.validation_role_invalid;
            break;
          case 'validation_notification_invalid':
            errorMsg = t.validation_notification_invalid;
            break;
          case 'validation_password_required':
            errorMsg = t.validation_password_required;
            break;
          case 'validation_password_min':
            errorMsg = t.validation_password_min;
            break;
          case 'validation_password_max':
            errorMsg = t.validation_password_max;
            break;
          case 'validation_fullname_required':
            errorMsg = t.validation_fullname_required;
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
          case 'validation_email_required':
            errorMsg = t.validation_email_required;
            break;
          case 'validation_email_invalid':
            errorMsg = t.validation_email_invalid;
            break;
          case 'validation_phone_invalid':
            errorMsg = t.validation_phone_invalid;
            break;
          case 'passwords_not_match':
            errorMsg = t.register_error_password;
            break;
          case 'validation_required':
            errorMsg = t.validation_required;
            break;
          default:
            errorMsg = t.validation_server_error;
        }
        return res.render('register', {
          t,
          lang,
          error: errorMsg,
          values: registerDTO.toFormValues()
        });
      }

      req.session.flash = t.register_success;
      res.redirect('/login');
    } catch (err) {
      console.error('Error en registro:', err);
      res.render('register', {
        t,
        lang,
        error: t.validation_server_error,
        values: {}
      });
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
      const { nickname, descriptor } = req.body;

      if (!nickname || !descriptor) {
        return res.status(400).json({ success: false, error: 'missing_data' });
      }

      const user = await userService.findWithPhoto(nickname.trim().toLowerCase());
      if (!user) {
        return res.status(401).json({ success: false, error: 'user_not_found' });
      }

      if (!user.isActive()) {
        return res.status(401).json({
          success: false,
          error: user.state === INACTIVE_STATE ? 'account_pending' : 'account_disabled'
        });
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
