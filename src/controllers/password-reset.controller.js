const passwordResetService = require('../services/password-reset.service');
const { getTranslation } = require('../utils/i18n');

const HTTP_POR_ERROR = {
  identifier_required: 400, code_invalid: 400, code_expired: 400, code_blocked: 429,
  password_not_match: 400, validation_password_min: 400, validation_password_max: 400, validation_password_required: 400
};

class PasswordResetController {
  t(req) {
    return getTranslation(req.session.lang || 'es');
  }

  error(req, res, codigo, status) {
    const t = this.t(req);
    return res.status(status || HTTP_POR_ERROR[codigo] || 500).json({
      success: false,
      error: codigo,
      message: t[`reset_error_${codigo}`] || t[codigo] || t.validation_server_error
    });
  }

  /** GET /recuperar */
  getPage(req, res) {
    const lang = req.session.lang || 'es';
    res.render('forgot-password', { t: getTranslation(lang), lang });
  }

  /** POST /recuperar/codigo   body JSON: { identifier } */
  async postRequestCode(req, res) {
    if (!req.is('application/json')) return res.status(415).json({ success: false });
    try {
      const result = await passwordResetService.requestCode(req.body && req.body.identifier);
      if (!result.success) return this.error(req, res, result.error);
      return res.json({ success: true, message: this.t(req).reset_code_sent, waitSeconds: result.waitSeconds || 60 });
    } catch (err) {
      console.error('Error al generar código de recuperación:', err.message);
      return this.error(req, res, 'server_error', 500);
    }
  }

  /** POST /recuperar/confirmar   body JSON: { identifier, code, new_password, confirm_password } */
  async postConfirm(req, res) {
    if (!req.is('application/json')) return res.status(415).json({ success: false });
    try {
      const b = req.body || {};
      const texto = (v) => (typeof v === 'string' ? v : '');
      const result = await passwordResetService.confirm({
        identificador: texto(b.identifier),
        code: texto(b.code),
        newPassword: texto(b.new_password),
        confirmPassword: texto(b.confirm_password)
      });
      if (!result.success) return this.error(req, res, result.error);
      req.session.flash = this.t(req).reset_success;
      return res.json({ success: true, redirect: '/login' });
    } catch (err) {
      console.error('Error al restablecer contraseña:', err.message);
      return this.error(req, res, 'server_error', 500);
    }
  }
}

module.exports = new PasswordResetController();
