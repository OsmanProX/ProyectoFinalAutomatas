const credentialService = require('../services/credential.service');
const { getTranslation } = require('../utils/i18n');

/** Código HTTP de cada error (los mensajes visibles salen de i18n, sin detalles internos) */
const HTTP_POR_ERROR = { qr_invalid: 401, account_pending: 403, account_disabled: 403 };

class QrLoginController {
  /**
   * POST /login/qr   body: { token: "LFA1.<id>.<secreto>" }
   * El navegador lee el QR de la credencial con la cámara y envía su texto.
   */
  async postQrLogin(req, res) {
    const t = getTranslation(req.session.lang || 'es');
    try {
      const token = typeof (req.body && req.body.token) === 'string' ? req.body.token.trim() : '';
      const result = await credentialService.authenticateByQr(token);

      if (!result.success) {
        return res.status(HTTP_POR_ERROR[result.error] || 401).json({
          success: false,
          error: result.error,
          message: t[`login_qr_error_${result.error}`] || t.login_qr_error_qr_invalid
        });
      }

      req.session.user = result.user.toSession();
      return res.json({ success: true, redirect: '/users/dashboard', nickname: result.user.nickname });
    } catch (err) {
      console.error('Error en login con QR:', err.message);
      return res.status(500).json({ success: false, error: 'server_error', message: t.validation_server_error });
    }
  }
}

module.exports = new QrLoginController();
