const profileService = require('../services/profile.service');

class ProfileController {
  /** GET /perfil/foto -> imagen de perfil (modificada) del usuario en sesión */
  async getAvatar(req, res) {
    try {
      const avatar = await profileService.getAvatar(req.session.user.id);
      if (!avatar) return res.status(404).end();
      res.set({
        'Content-Type': avatar.mime,
        'Cache-Control': 'private, max-age=300'
      });
      return res.send(avatar.buffer);
    } catch (err) {
      console.error('Error al obtener foto de perfil:', err.message);
      return res.status(500).end();
    }
  }
}

module.exports = new ProfileController();
