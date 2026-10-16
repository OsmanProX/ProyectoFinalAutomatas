const nodemailer = require('nodemailer');

/**
 * Envío de mensajes al usuario según su método de notificación:
 *   - Correo electrónico (SMTP con nodemailer)
 *   - WhatsApp (API de Twilio)
 *
 * Variables de entorno (.env), nunca en el código:
 *   Correo:   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
 *   WhatsApp: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM,
 *             PUBLIC_BASE_URL (URL pública https del sitio), DEFAULT_COUNTRY_CODE (502)
 */
class MessagingService {
  constructor() {
    this.transporter = null;
  }

  isEmailConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  isWhatsAppConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      && process.env.TWILIO_WHATSAPP_FROM && process.env.PUBLIC_BASE_URL);
  }

  getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
    }
    return this.transporter;
  }

  /** @param {{ to: string, subject: string, html: string, attachments?: Array }} mensaje */
  async sendEmail({ to, subject, html, attachments = [] }) {
    if (!this.isEmailConfigured()) throw new Error('correo_no_configurado');
    if (!to) throw new Error('correo_destino_vacio');
    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      attachments
    });
  }

  /**
   * WhatsApp con archivo adjunto: Twilio descarga el archivo desde mediaUrl,
   * por eso debe ser una URL pública (se usa un enlace firmado y temporal).
   */
  async sendWhatsApp({ to, body, mediaUrl }) {
    if (!this.isWhatsAppConfigured()) throw new Error('whatsapp_no_configurado');
    const numero = this.normalizePhone(to);
    if (!numero) throw new Error('telefono_invalido');

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const params = new URLSearchParams({
      From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      To: `whatsapp:${numero}`,
      Body: body
    });
    if (mediaUrl) params.append('MediaUrl', mediaUrl);

    const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    if (!respuesta.ok) {
      console.error('Twilio respondió', respuesta.status, await respuesta.text());
      throw new Error('whatsapp_error_envio');
    }
  }

  /** "5555-1234" -> "+50255551234"; "+52 123 456 7890" -> "+521234567890" */
  normalizePhone(telefono) {
    if (!telefono) return null;
    const texto = String(telefono).trim();
    const digitos = texto.replace(/\D/g, '');
    if (texto.startsWith('+') && digitos.length >= 10 && digitos.length <= 15) return `+${digitos}`;
    if (digitos.length === 8) return `+${process.env.DEFAULT_COUNTRY_CODE || '502'}${digitos}`;
    if (digitos.length >= 10 && digitos.length <= 15) return `+${digitos}`;
    return null;
  }

  /**
   * Envía por el/los canales del usuario. Nunca lanza error: devuelve el resultado de cada canal.
   * @param {'correo_electronico'|'whatsapp'|'ambos'} metodo
   * @returns {Promise<Array<{ canal: string, ok: boolean, error?: string }>>}
   */
  async sendByPreference(metodo, { email, whatsapp }) {
    const canales = metodo === 'ambos' ? ['correo_electronico', 'whatsapp'] : [metodo || 'correo_electronico'];
    const resultados = [];
    for (const canal of canales) {
      try {
        if (canal === 'whatsapp') await this.sendWhatsApp(whatsapp);
        else await this.sendEmail(email);
        resultados.push({ canal, ok: true });
      } catch (err) {
        resultados.push({ canal, ok: false, error: err.message });
      }
    }
    return resultados;
  }
}

module.exports = new MessagingService();
