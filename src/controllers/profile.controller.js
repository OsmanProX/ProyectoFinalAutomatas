const profileService = require('../services/profile.service');
const credentialService = require('../services/credential.service');
const { getTranslation } = require('../utils/i18n');

/** Código HTTP por error; el mensaje visible sale de i18n (sin detalles internos) */
const HTTP_POR_ERROR = {
  photo_required: 400, photo_invalid: 400, password_fields_required: 400, password_current_wrong: 401,
  password_not_match: 400, password_same: 400, validation_password_min: 400, validation_password_max: 400,
  validation_password_required: 400
};

class ProfileController {
  t(req) {
    return getTranslation(req.session.lang || 'es');
  }

  /** Respuesta JSON de error con mensaje traducido */
  error(req, res, codigo, status) {
    const t = this.t(req);
    return res.status(status || HTTP_POR_ERROR[codigo] || 500).json({
      success: false,
      error: codigo,
      message: t[`profile_error_${codigo}`] || t[codigo] || t.validation_server_error
    });
  }

  /** Solo se aceptan peticiones JSON (ayuda a prevenir CSRF con formularios externos) */
  esJson(req, res) {
    if (req.is('application/json')) return true;
    res.status(415).json({ success: false, error: 'unsupported_media_type' });
    return false;
  }

  /** GET /perfil -> página de Gestión de Perfil */
  async getPage(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);
    try {
      const perfil = await profileService.getProfile(req.session.user.id);
      if (!perfil) return res.redirect('/logout');
      res.render('profile', { t, lang, perfil: perfil.user, credencial: perfil.credencial, version: Date.now() });
    } catch (err) {
      console.error('Error al cargar perfil:', err.message);
      res.status(500).send(t.validation_server_error);
    }
  }

  /** GET /perfil/foto -> imagen de perfil (modificada) del usuario en sesión */
  async getAvatar(req, res) {
    return this.enviarImagen(res, () => profileService.getAvatar(req.session.user.id));
  }

  /** GET /perfil/foto/original -> foto original (para personalizarla de nuevo) */
  async getOriginal(req, res) {
    return this.enviarImagen(res, () => profileService.getOriginalPhoto(req.session.user.id), 'no-store');
  }

  async enviarImagen(res, obtener, cache = 'private, max-age=300') {
    try {
      const imagen = await obtener();
      if (!imagen) return res.status(404).end();
      res.set({ 'Content-Type': imagen.mime, 'Cache-Control': cache });
      return res.send(imagen.buffer);
    } catch (err) {
      console.error('Error al obtener foto:', err.message);
      return res.status(500).end();
    }
  }

  /** GET /perfil/credencial -> PDF de la credencial vigente (con QR) del usuario en sesión */
  async downloadCredential(req, res) {
    try {
      const result = await credentialService.buildPdfForUser(req.session.user.id);
      if (!result) return res.status(404).send('Credencial no encontrada');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="credencial-${result.user.nickname}.pdf"`,
        'Cache-Control': 'no-store'
      });
      return res.send(result.pdf);
    } catch (err) {
      console.error('Error al generar la credencial:', err.message);
      return res.status(500).send('No se pudo generar la credencial');
    }
  }

  /** POST /perfil/foto   body JSON: { photo?, photo_modified } */
  async postPhoto(req, res) {
    if (!this.esJson(req, res)) return;
    try {
      const { photo, photo_modified: photoModified } = req.body || {};
      const result = await profileService.updatePhotos(req.session.user.id, { photo, photoModified });
      if (!result.success) return this.error(req, res, result.error);
      if (photo) req.session.user.photo = photo; // la sesión guarda la foto original
      return res.json({ success: true, message: this.t(req).profile_photo_saved });
    } catch (err) {
      console.error('Error al cambiar foto:', err.message);
      return this.error(req, res, 'server_error', 500);
    }
  }

  /** POST /perfil/password   body JSON: { current_password, new_password, confirm_password } */
  async postPassword(req, res) {
    if (!this.esJson(req, res)) return;
    try {
      const b = req.body || {};
      const result = await profileService.changePassword(req.session.user.id, {
        currentPassword: typeof b.current_password === 'string' ? b.current_password : '',
        newPassword: typeof b.new_password === 'string' ? b.new_password : '',
        confirmPassword: typeof b.confirm_password === 'string' ? b.confirm_password : ''
      });
      if (!result.success) return this.error(req, res, result.error);
      return res.json({ success: true, message: this.t(req).profile_password_saved });
    } catch (err) {
      console.error('Error al cambiar contraseña:', err.message);
      return this.error(req, res, 'server_error', 500);
    }
  }

  /** POST /perfil/credencial/nueva -> genera y envía una credencial nueva */
  async postNewCredential(req, res) {
    if (!this.esJson(req, res)) return;
    try {
      const result = await profileService.reissueCredential(req.session.user.id);
      if (!result.success) return this.error(req, res, 'server_error', 500);
      const t = this.t(req);
      const enviados = result.data.envios.filter((e) => e.ok).length;
      return res.json({
        success: true,
        code: result.data.credencial.credentialCode,
        message: enviados ? t.profile_credential_sent : t.profile_credential_created
      });
    } catch (err) {
      console.error('Error al generar credencial nueva:', err.message);
      return this.error(req, res, 'server_error', 500);
    }
  }
}

module.exports = new ProfileController();
