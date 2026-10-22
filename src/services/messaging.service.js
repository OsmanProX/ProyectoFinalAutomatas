const nodemailer = require('nodemailer');

/**
 * Envío de mensajes al usuario según su método de notificación:
 *   - Correo electrónico (SMTP con nodemailer)
 *   - WhatsApp: Wawp (preferido, plan gratis de 120 mensajes al mes),
 *               Green-API (respaldo) o Twilio (necesita una URL pública para el archivo).
 *               Se usa el primero que esté configurado en .env, en ese orden.
 *
 * Variables de entorno (.env), nunca en el código:
 *   Correo:    SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
 *   Wawp:      WAWP_INSTANCE_ID, WAWP_ACCESS_TOKEN (Dev Tools & API en app.wawp.net),
 *              WAWP_API_URL (opcional, https://api.wawp.net por defecto)
 *   Green-API: GREEN_API_ID_INSTANCE, GREEN_API_TOKEN,
 *              GREEN_API_URL (apiUrl de la consola), GREEN_API_MEDIA_URL (mediaUrl de la consola)
 *   Twilio:    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM,
 *              PUBLIC_BASE_URL (URL pública https del sitio)
 *   Ambos:     DEFAULT_COUNTRY_CODE (502 por defecto)
 */
const TIEMPO_MAXIMO_MS = 20000;

class MessagingService {
  constructor() {
    this.transporter = null;
  }

  isEmailConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  isWawpConfigured() {
    return Boolean(process.env.WAWP_INSTANCE_ID && process.env.WAWP_ACCESS_TOKEN);
  }

  isGreenApiConfigured() {
    return Boolean(process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN);
  }

  isTwilioConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      && process.env.TWILIO_WHATSAPP_FROM && process.env.PUBLIC_BASE_URL);
  }

  isWhatsAppConfigured() {
    return this.isWawpConfigured() || this.isGreenApiConfigured() || this.isTwilioConfigured();
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
   * WhatsApp con texto y, opcionalmente, un archivo.
   * @param {{ to: string, body: string,
   *           file?: { content: Buffer, filename: string, contentType?: string },
   *           mediaUrl?: string }} mensaje
   *   file     -> se envía directo con Wawp o Green-API (no necesita sitio público)
   *   mediaUrl -> enlace público que usa Twilio para descargar el archivo
   */
  async sendWhatsApp({ to, body, file, mediaUrl }) {
    if (!this.isWhatsAppConfigured()) throw new Error('whatsapp_no_configurado');
    const numero = this.normalizePhone(to);
    if (!numero) throw new Error('telefono_invalido');

    if (this.isWawpConfigured()) return this.sendWawp(numero, body, file);
    if (this.isGreenApiConfigured()) return this.sendGreenApi(numero, body, file);
    return this.sendTwilio(numero, body, mediaUrl);
  }

  // ------------------------------------------------------------ Wawp
  /**
   * Wawp (https://api.wawp.net): instance_id y access_token van en la URL.
   * Nunca se imprime la URL en consola para no exponer el token.
   */
  async wawpFetch(metodo, body) {
    const base = (process.env.WAWP_API_URL || 'https://api.wawp.net').replace(/\/+$/, '');
    const params = new URLSearchParams({
      instance_id: process.env.WAWP_INSTANCE_ID,
      access_token: process.env.WAWP_ACCESS_TOKEN
    });
    const respuesta = await fetch(`${base}/v2/send/${metodo}?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
    });
    if (!respuesta.ok) {
      console.error(`Wawp (${metodo}) respondió`, respuesta.status, (await respuesta.text()).slice(0, 200));
      throw new Error([402, 429].includes(respuesta.status) ? 'whatsapp_cuota' : 'whatsapp_error_envio');
    }
    return respuesta.json().catch(() => ({}));
  }

  async sendWawp(numero, body, file) {
    const chatId = `${numero.replace(/\D/g, '')}@c.us`;

    // 1. Texto
    if (body) await this.wawpFetch('text', { chatId, message: body });

    // 2. PDF (credencial o reporte) en base64: no necesita que el sitio sea público
    if (file && file.content) {
      await this.wawpFetch('pdf', {
        chatId,
        file: {
          data: Buffer.from(file.content).toString('base64'),
          filename: file.filename || 'archivo.pdf',
          mimetype: file.contentType || 'application/pdf'
        }
      });
    }
  }

  // ------------------------------------------------------------ Green-API
  greenUrl(base, metodo) {
    const id = process.env.GREEN_API_ID_INSTANCE;
    return `${base.replace(/\/+$/, '')}/waInstance${id}/${metodo}/${process.env.GREEN_API_TOKEN}`;
  }

  /** El token viaja en la URL (así funciona Green-API): nunca se imprime la URL en consola */
  async greenFetch(url, opciones, metodo) {
    const respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    if (!respuesta.ok) {
      console.error(`Green-API (${metodo}) respondió`, respuesta.status, (await respuesta.text()).slice(0, 200));
      // 466 = se acabó la cuota mensual del plan gratis
      throw new Error(respuesta.status === 466 ? 'whatsapp_cuota' : 'whatsapp_error_envio');
    }
    return respuesta.json().catch(() => ({}));
  }

  async sendGreenApi(numero, body, file) {
    const chatId = `${numero.replace(/\D/g, '')}@c.us`;
    const apiUrl = process.env.GREEN_API_URL || 'https://api.green-api.com';
    const mediaUrl = process.env.GREEN_API_MEDIA_URL || 'https://media.green-api.com';

    // 1. Texto (en un PDF el "caption" no se muestra, por eso va como mensaje aparte)
    if (body) {
      await this.greenFetch(this.greenUrl(apiUrl, 'sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: body })
      }, 'sendMessage');
    }

    // 2. Archivo (credencial o reporte en PDF), subido directamente
    if (file && file.content) {
      const form = new FormData();
      form.append('chatId', chatId);
      form.append('fileName', file.filename || 'archivo.pdf');
      form.append('file', new Blob([file.content], { type: file.contentType || 'application/pdf' }), file.filename || 'archivo.pdf');
      await this.greenFetch(this.greenUrl(mediaUrl, 'sendFileByUpload'), { method: 'POST', body: form }, 'sendFileByUpload');
    }
  }

  // ------------------------------------------------------------ Twilio (alternativa)
  /** Twilio descarga el archivo desde mediaUrl, por eso debe ser una URL pública (enlace firmado y temporal) */
  async sendTwilio(numero, body, mediaUrl) {
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
      body: params,
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
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
