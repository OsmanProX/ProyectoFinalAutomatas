const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const userPhotoRepository = require('../repositories/user-photo.repository');
const profileRepository = require('../repositories/profile.repository');
const credentialRepository = require('../repositories/credential.repository');
const userService = require('./user.service');
const credentialService = require('./credential.service');
const messagingService = require('./messaging.service');
const { parseImageDataUrl, isValidImageDataUrl } = require('../utils/image');

/**
 * Lógica de la sección Gestión de Perfil:
 *  - foto (original y modificada), contraseña y credencial del usuario en sesión.
 * Todos los métodos devuelven { success, error?, data? } como user.service.
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

  /** Foto ORIGINAL (para volver a personalizarla en el estudio) */
  async getOriginalPhoto(userId) {
    const photos = await userPhotoRepository.findByUserId(userId);
    return photos ? parseImageDataUrl(photos.original) : null;
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) return null;
    const credencial = await credentialRepository.findByUserId(userId);
    return { user, credencial };
  }

  /**
   * Cambia la foto. Casos:
   *  - foto nueva: { photo, photoModified }  -> cambia la original y la modificada
   *  - solo personalizar: { photoModified }  -> cambia solo la modificada
   */
  async updatePhotos(userId, { photo, photoModified }) {
    if (!photoModified) return { success: false, error: 'photo_required' };
    if (!isValidImageDataUrl(photoModified) || (photo && !isValidImageDataUrl(photo))) {
      return { success: false, error: 'photo_invalid' };
    }
    if (photo) await profileRepository.updateOriginalPhoto(userId, photo);
    await userPhotoRepository.saveModified(userId, photoModified);
    return { success: true, data: { originalChanged: Boolean(photo) } };
  }

  /** Cambia la contraseña verificando la actual y avisa al usuario por su medio de notificación */
  async changePassword(userId, { currentPassword, newPassword, confirmPassword }) {
    if (!currentPassword || !newPassword || !confirmPassword) return { success: false, error: 'password_fields_required' };

    const hash = await profileRepository.findPasswordHash(userId);
    if (!hash || !(await bcrypt.compare(currentPassword, hash))) return { success: false, error: 'password_current_wrong' };

    const validacion = userService.validatePassword(newPassword); // mismas reglas que el registro
    if (!validacion.valid) return { success: false, error: validacion.error };
    if (newPassword !== confirmPassword) return { success: false, error: 'password_not_match' };
    if (await bcrypt.compare(newPassword, hash)) return { success: false, error: 'password_same' };

    const nuevoHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await profileRepository.updatePassword(userId, nuevoHash);
    this.notifyPasswordChanged(userId); // en segundo plano
    return { success: true };
  }

  /** Aviso de seguridad: "tu contraseña fue cambiada" (no bloquea la respuesta) */
  async notifyPasswordChanged(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) return;
      const fecha = new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
      const texto = `Hola ${user.fullName}, la contraseña de tu cuenta @${user.nickname} fue cambiada el ${fecha}. Si no fuiste tú, contacta al administrador.`;
      const resultados = await messagingService.sendByPreference(user.notificationMethod, {
        email: { to: user.email, subject: '🔒 Tu contraseña fue cambiada', html: `<p style="font-family:Arial,sans-serif">${texto.replace(/[<>&]/g, '')}</p>` },
        whatsapp: { to: user.phone, body: texto }
      });
      resultados.filter((r) => !r.ok).forEach((r) => console.warn(`Aviso de contraseña no enviado por ${r.canal} (${r.error})`));
    } catch (err) {
      console.error('Error al avisar cambio de contraseña:', err.message);
    }
  }

  /** Genera una credencial NUEVA (el QR anterior deja de funcionar) y la envía */
  async reissueCredential(userId) {
    const resultados = await credentialService.sendOnRegister(userId, { nueva: true });
    const credencial = await credentialRepository.findByUserId(userId);
    return { success: Boolean(credencial), data: { credencial, envios: resultados } };
  }
}

module.exports = new ProfileService();
