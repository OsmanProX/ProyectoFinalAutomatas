const nodemailer = require('nodemailer');
// Registro de cada WhatsApp enviado; su estado lo actualiza el webhook de Wawp (sin polling)
const whatsappLogRepository = require('../repositories/whatsapp-log.repository');

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
 *   Wawp y Green-API: WHATSAPP_TEXTO_APARTE (opcional): true = texto y PDF en 2 mensajes;
 *              vacío o false = PDF con el texto como descripción (1 mensaje)
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
   *           mediaUrl?: string, tipo?: string, userId?: number }} mensaje
   *   file     -> se envía directo con Wawp o Green-API (no necesita sitio público)
   *   mediaUrl -> enlace público que usa Twilio para descargar el archivo
   *   tipo     -> para el registro: credencial, reporte, codigo_recuperacion...
   */
  async sendWhatsApp({ to, body, file, mediaUrl, tipo, userId }) {
    if (!this.isWhatsAppConfigured()) throw new Error('whatsapp_no_configurado');
    const numero = this.normalizePhone(to);
    if (!numero) throw new Error('telefono_invalido');

    let proveedor = 'twilio';
    if (this.isWawpConfigured()) proveedor = 'wawp';
    else if (this.isGreenApiConfigured()) proveedor = 'green-api';
    const registro = { userId: userId || null, tipo: tipo || (file ? 'archivo' : 'texto'), proveedor, destino: enmascararTelefono(numero) };

    try {
      let respuesta;
      if (proveedor === 'wawp') respuesta = await this.sendWawp(numero, body, file);
      else if (proveedor === 'green-api') respuesta = await this.sendGreenApi(numero, body, file);
      else respuesta = await this.sendTwilio(numero, body, mediaUrl);
      // "aceptado" = el proveedor lo recibió; el webhook lo pasa a enviado / entregado / leído
      this.registrarEnvio({ ...registro, messageId: idDelMensaje(respuesta), estado: 'aceptado', error: null });
      return respuesta;
    } catch (err) {
      this.registrarEnvio({ ...registro, messageId: null, estado: 'fallido', error: err.message });
      throw err;
    }
  }

  /** Se guarda en segundo plano: si la base de datos falla, el envío no se afecta */
  registrarEnvio(registro) {
    whatsappLogRepository.insert(registro).catch((err) => {
      console.warn('No se pudo guardar el registro del WhatsApp:', err.message);
    });
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

    // Por defecto: un solo mensaje (el PDF con el texto como descripción) para
    // gastar 1 mensaje del plan en vez de 2. Con WHATSAPP_TEXTO_APARTE=true el
    // texto va primero en su propio mensaje. El PDF va en base64: no necesita
    // que el sitio sea público.
    if (file && file.content) {
      const textoAparte = process.env.WHATSAPP_TEXTO_APARTE === 'true';
      if (textoAparte && body) await this.wawpFetch('text', { chatId, message: body });
      return this.wawpFetch('pdf', {
        chatId,
        caption: textoAparte ? undefined : (body || undefined),
        file: {
          data: Buffer.from(file.content).toString('base64'),
          filename: file.filename || 'archivo.pdf',
          mimetype: file.contentType || 'application/pdf'
        }
      });
    }

    // Sin archivo: solo texto
    if (body) return this.wawpFetch('text', { chatId, message: body });
    return null;
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

    const conArchivo = Boolean(file && file.content);
    // Igual que con Wawp: por defecto el texto va como descripción del PDF (1 mensaje);
    // con WHATSAPP_TEXTO_APARTE=true, o si no hay archivo, el texto va en su propio mensaje
    const textoAparte = !conArchivo || process.env.WHATSAPP_TEXTO_APARTE === 'true';

    let ultimo = null;

    // 1. Texto
    if (body && textoAparte) {
      ultimo = await this.greenFetch(this.greenUrl(apiUrl, 'sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: body })
      }, 'sendMessage');
    }

    // 2. Archivo (credencial o reporte en PDF), subido directamente
    if (conArchivo) {
      const form = new FormData();
      form.append('chatId', chatId);
      form.append('fileName', file.filename || 'archivo.pdf');
      if (body && !textoAparte) form.append('caption', body);
      form.append('file', new Blob([file.content], { type: file.contentType || 'application/pdf' }), file.filename || 'archivo.pdf');
      ultimo = await this.greenFetch(this.greenUrl(mediaUrl, 'sendFileByUpload'), { method: 'POST', body: form }, 'sendFileByUpload');
    }
    return ultimo;
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

/** "+50258381311" -> "+502 ****1311" (el registro no guarda el número completo) */
function enmascararTelefono(numero) {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  return `+${d.slice(0, d.length - 8)} ****${d.slice(-4)}`;
}

/** Id del mensaje en la respuesta del proveedor (Wawp: id._serialized; Green-API: idMessage) */
function idDelMensaje(respuesta) {
  if (!respuesta || typeof respuesta !== 'object') return null;
  const id = respuesta.id && typeof respuesta.id === 'object' ? respuesta.id._serialized || respuesta.id.id : respuesta.id;
  const valor = id || respuesta.idMessage || respuesta.messageId || (respuesta.key && respuesta.key.id) || null;
  return valor ? String(valor).slice(0, 150) : null;
}

module.exports = new MessagingService();
module.exports.enmascararTelefono = enmascararTelefono;
module.exports.idDelMensaje = idDelMensaje;
