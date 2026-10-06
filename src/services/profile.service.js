const userPhotoRepository = require('../repositories/user-photo.repository');
const { parseImageDataUrl } = require('../utils/image');

/**
 * Lógica de la sección de perfil del usuario.
 */
class ProfileService {
  /**
   * Foto que se muestra en la barra de estado: la modificada o, si no existe, la original.
   * @returns {{ mime: string, buffer: Buffer } | null}
   */
  async getAvatar(userId) {
    const photos = await userPhotoRepository.findByUserId(userId);
    if (!photos) return null;
    return parseImageDataUrl(photos.modified) || parseImageDataUrl(photos.original);
  }
}

module.exports = new ProfileService();
