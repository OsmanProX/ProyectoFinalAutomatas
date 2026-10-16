const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const passwordResetRepository = require('../repositories/password-reset.repository');
const profileRepository = require('../repositories/profile.repository');
const userRepository = require('../repositories/user.repository');
const userService = require('./user.service');
const messagingService = require('./messaging.service');
const { safeEqual } = require('../utils/crypto');

/**
 * ============================================================================
 * REINICIO DE CONTRASEÑA
 * ============================================================================
 * 1. El usuario escribe su apodo o correo -> se genera un código de 6 dígitos
 *    y se envía por su método de notificación (correo, WhatsApp o ambos).
 * 2. Escribe el código y su nueva contraseña -> se valida y se cambia.
 *
 * Seguridad (OWASP):
 *  - Respuesta genérica: no se revela si la cuenta existe.
 *  - El código se guarda como HMAC-SHA256, vence en 10 min y admite 5 intentos.
 *  - Solo se puede pedir un código nuevo cada 60 segundos.
 * ============================================================================
 */
const MINUTOS_VIGENCIA = 10;
const MAX_INTENTOS = 5;
const SEGUNDOS_REENVIO = 60;

class PasswordResetService {
  hashCode(userId, codigo) {
    const secreto = process.env.CREDENTIAL_SECRET || process.env.SESSION_SECRET;
    if (!secreto) throw new Error('secreto_no_configurado');
    return crypto.createHmac('sha256', `reset:${secreto}`).update(`${userId}:${codigo}`).digest('hex');
  }

  normalizar(identificador) {
    return typeof identificador === 'string' ? identificador.trim().toLowerCase().slice(0, 254) : '';
  }

  /** Paso 1: genera y envía el código. Siempre responde igual exista o no la cuenta. */
  async requestCode(identificadorRecibido) {
    const identificador = this.normalizar(identificadorRecibido);
    if (!identificador) return { success: false, error: 'identifier_required' };

    const userId = await passwordResetRepository.findUserIdByIdentifier(identificador);
    if (!userId) return { success: true };

    const vigente = await passwordResetRepository.findByUserId(userId);
    if (vigente && !vigente.expired && vigente.ageSeconds < SEGUNDOS_REENVIO) {
      return { success: true, waitSeconds: SEGUNDOS_REENVIO - vigente.ageSeconds };
    }

    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await passwordResetRepository.save(userId, this.hashCode(userId, codigo), MINUTOS_VIGENCIA);

    const user = await userRepository.findById(userId);
    const resultados = await messagingService.sendByPreference(user.notificationMethod, {
      email: { to: user.email, subject: `🔑 Tu código para restablecer la contraseña: ${codigo}`, html: this.emailHtml(user, codigo) },
      whatsapp: { to: user.phone, body: `Tu código para restablecer la contraseña de @${user.nickname} es: ${codigo}. Vence en ${MINUTOS_VIGENCIA} minutos. Si no lo pediste, ignora este mensaje.` }
    });

    if (!resultados.some((r) => r.ok)) {
      resultados.forEach((r) => console.warn(`Código de recuperación no enviado por ${r.canal} (${r.error})`));
      // Solo en desarrollo (sin correo configurado) se muestra en la consola para poder probar
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DESARROLLO] Código de recuperación para @${user.nickname}: ${codigo}`);
      }
    }
    return { success: true };
  }

  /** Paso 2: valida el código y cambia la contraseña */
  async confirm({ identificador: identificadorRecibido, code, newPassword, confirmPassword }) {
    const identificador = this.normalizar(identificadorRecibido);
    const codigo = typeof code === 'string' ? code.trim() : '';
    if (!identificador || !/^\d{6}$/.test(codigo)) return { success: false, error: 'code_invalid' };

    const userId = await passwordResetRepository.findUserIdByIdentifier(identificador);
    const registro = userId ? await passwordResetRepository.findByUserId(userId) : null;
    if (!registro) return { success: false, error: 'code_invalid' };

    if (registro.expired) {
      await passwordResetRepository.delete(userId);
      return { success: false, error: 'code_expired' };
    }
    if (registro.attempts >= MAX_INTENTOS) {
      await passwordResetRepository.delete(userId);
      return { success: false, error: 'code_blocked' };
    }
    if (!safeEqual(registro.codeHash, this.hashCode(userId, codigo))) {
      await passwordResetRepository.incrementAttempts(userId);
      if (registro.attempts + 1 >= MAX_INTENTOS) {
        await passwordResetRepository.delete(userId);
        return { success: false, error: 'code_blocked' };
      }
      return { success: false, error: 'code_invalid' };
    }

    // Código correcto: ahora se valida la contraseña nueva (mismas reglas del registro)
    const validacion = userService.validatePassword(newPassword);
    if (!validacion.valid) return { success: false, error: validacion.error };
    if (newPassword !== confirmPassword) return { success: false, error: 'password_not_match' };

    const hash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await profileRepository.updatePassword(userId, hash);
    await passwordResetRepository.delete(userId);
    this.notifyReset(userId); // aviso en segundo plano
    return { success: true };
  }

  async notifyReset(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) return;
      const fecha = new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' });
      const texto = `Hola ${user.fullName}, la contraseña de @${user.nickname} fue restablecida el ${fecha}. Si no fuiste tú, contacta al administrador.`;
      await messagingService.sendByPreference(user.notificationMethod, {
        email: { to: user.email, subject: '🔒 Tu contraseña fue restablecida', html: `<p style="font-family:Arial,sans-serif">${texto.replace(/[<>&]/g, '')}</p>` },
        whatsapp: { to: user.phone, body: texto }
      });
    } catch (err) {
      console.error('Error al avisar el restablecimiento:', err.message);
    }
  }

  emailHtml(user, codigo) {
    const escapar = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
        <div style="background:#1a1a2e;color:#fff;padding:20px 24px;border-bottom:4px solid #4361ee">
          <h2 style="margin:0">🔑 Restablecer contraseña</h2>
        </div>
        <div style="padding:22px 24px;color:#2d2d3a;text-align:center">
          <p>Hola <b>${escapar(user.fullName || user.nickname)}</b>, tu código es:</p>
          <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#4361ee;margin:12px 0">${codigo}</p>
          <p style="color:#6b7280;font-size:13px">Vence en ${MINUTOS_VIGENCIA} minutos. Si no lo pediste, ignora este correo.</p>
        </div>
      </div>`;
  }
}

module.exports = new PasswordResetService();
