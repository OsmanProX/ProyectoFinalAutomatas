const profileService = require('../services/profile.service');
const credentialService = require('../services/credential.service');

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

ProfileController.prototype.downloadCredential = async function downloadCredential(req, res) {
  // GET /perfil/credencial -> PDF de la credencial vigente (con QR) del usuario en sesión
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
};

module.exports = new ProfileController();
