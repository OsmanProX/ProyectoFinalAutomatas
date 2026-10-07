const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const userRepository = require('../repositories/user.repository');
const userPhotoRepository = require('../repositories/user-photo.repository');
const credentialRepository = require('../repositories/credential.repository');
const messagingService = require('./messaging.service');
const { parseImageDataUrl } = require('../utils/image');
const { encrypt, decrypt, safeEqual, randomToken, createSignedToken } = require('../utils/crypto');

/**
 * ============================================================================
 * CREDENCIAL / CONSTANCIA DE INSCRIPCIÓN (PDF con código QR)
 * ============================================================================
 * - Al registrarse se genera la credencial con la FOTO MODIFICADA (filtros/stickers)
 *   y se envía automáticamente por correo, WhatsApp o ambos.
 * - El QR contiene "LFA1.<idUsuario>.<secreto>". El secreto se guarda CIFRADO
 *   (AES-256-GCM) y servirá para iniciar sesión leyendo el QR.
 * ============================================================================
 */
const FUENTES = {
  normal: path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans.ttf'),
  negrita: path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf')
};

// 60% blanco · 30% azul marino · 10% acento (+ toques de color "fresco")
const COLOR = {
  marino: '#1a1a2e', acento: '#4361ee', acentoSuave: '#e8ecfd', texto: '#2d2d3a',
  gris: '#6b7280', fondoQr: '#f3f4f8', rosa: '#ff3cac', amarillo: '#ffca3a', celeste: '#2bd9fe', verde: '#8ac926'
};

const ANCHO = 360; // proporción de una tarjeta CR80 (85.6 x 54 mm)
const ALTO = 227;
const PREFIJO_QR = 'LFA1';
const PATRON_QR = /^LFA1\.(\d{1,10})\.([A-Za-z0-9_-]{20,64})$/;

class CredentialService {
  credentialCode(userId, fecha = new Date()) {
    return `LFA-${fecha.getFullYear()}-${String(userId).padStart(5, '0')}`;
  }

  /** Genera una credencial NUEVA (el QR anterior deja de funcionar) */
  async issue(userId) {
    const secreto = randomToken(24);
    const code = this.credentialCode(userId);
    await credentialRepository.save(userId, code, encrypt(secreto));
    return { code, qrToken: `${PREFIJO_QR}.${userId}.${secreto}` };
  }

  /** Recupera el contenido del QR vigente; si no existe credencial, la crea */
  async getOrIssue(userId) {
    const actual = await credentialRepository.findByUserId(userId);
    if (actual) {
      const secreto = decrypt(actual.qrTokenEnc);
      if (secreto) return { code: actual.credentialCode, qrToken: `${PREFIJO_QR}.${userId}.${secreto}`, issuedAt: actual.issuedAt };
    }
    return this.issue(userId);
  }

  /**
   * Valida el texto leído de un QR (lo usará el login con QR).
   * @returns {Promise<number|null>} id del usuario o null
   */
  async verifyQrToken(texto) {
    const match = typeof texto === 'string' ? texto.trim().match(PATRON_QR) : null;
    if (!match) return null;
    const userId = Number(match[1]);
    const credencial = await credentialRepository.findByUserId(userId);
    if (!credencial) return null;
    const secreto = decrypt(credencial.qrTokenEnc);
    return secreto && safeEqual(secreto, match[2]) ? userId : null;
  }

  /** PDF de la credencial vigente de un usuario (descarga desde el perfil o enlace de WhatsApp) */
  async buildPdfForUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) return null;
    const { code, qrToken, issuedAt } = await this.getOrIssue(userId);
    const foto = await this.getPhoto(userId);
    const pdf = await this.buildPdf({ user, foto, code, qrToken, issuedAt });
    return { pdf, user, code };
  }

  /**
   * Se llama al terminar el registro: genera la credencial y la envía según el
   * método de notificación del usuario. Nunca lanza error (el registro ya terminó).
   */
  async sendOnRegister(userId) {
    try {
      const user = await userRepository.findById(userId);
      if (!user) return [];
      const { code, qrToken } = await this.issue(userId);
      const foto = await this.getPhoto(userId);
      const pdf = await this.buildPdf({ user, foto, code, qrToken, issuedAt: new Date() });
      const archivo = `credencial-${user.nickname}.pdf`;

      const resultados = await messagingService.sendByPreference(user.notificationMethod, {
        email: {
          to: user.email,
          subject: '🎉 ¡Bienvenido! Aquí está tu credencial de inscripción',
          html: this.emailHtml(user, code),
          attachments: [{ filename: archivo, content: pdf, contentType: 'application/pdf' }]
        },
        whatsapp: {
          to: user.phone,
          body: `¡Hola ${user.fullName}! 🎉 Tu registro quedó listo. Te enviamos tu credencial ${code}. Guárdala: con su código QR podrás iniciar sesión.`,
          mediaUrl: `${process.env.PUBLIC_BASE_URL}/credencial/publica/${createSignedToken(userId, 120)}`
        }
      });

      const enviados = resultados.filter((r) => r.ok).map((r) => r.canal);
      if (enviados.length) {
        await credentialRepository.markSent(userId, enviados.length === 2 ? 'ambos' : enviados[0]);
      }
      resultados.filter((r) => !r.ok).forEach((r) => console.warn(`Credencial ${code}: no se envió por ${r.canal} (${r.error})`));
      return resultados;
    } catch (err) {
      console.error('Error al generar/enviar la credencial:', err.message);
      return [];
    }
  }

  /** Foto modificada (o la original si no hay) como Buffer JPEG/PNG */
  async getPhoto(userId) {
    const fotos = await userPhotoRepository.findByUserId(userId);
    if (!fotos) return null;
    const imagen = parseImageDataUrl(fotos.modified) || parseImageDataUrl(fotos.original);
    return imagen && imagen.mime !== 'image/webp' ? imagen.buffer : null;
  }

  // ==========================================================================
  // Diseño del PDF
  // ==========================================================================
  async buildPdf({ user, foto, code, qrToken, issuedAt }) {
    const qr = await QRCode.toBuffer(qrToken, {
      errorCorrectionLevel: 'M', margin: 1, width: 360,
      color: { dark: COLOR.marino, light: '#ffffff' }
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [ANCHO, ALTO], margin: 0, info: { Title: `Credencial ${code}`, Author: 'Proyecto Final Lenguajes Formales y Autómatas' } });
      const partes = [];
      doc.on('data', (p) => partes.push(p));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);
      doc.registerFont('normal', FUENTES.normal);
      doc.registerFont('negrita', FUENTES.negrita);

      this.frente(doc, { user, foto, code, qr, issuedAt });
      doc.addPage({ size: [ANCHO, ALTO], margin: 0 });
      this.reverso(doc, code);
      doc.end();
    });
  }

  frente(doc, { user, foto, code, qr, issuedAt }) {
    // Encabezado con degradado y confeti
    const degradado = doc.linearGradient(0, 0, ANCHO, 0);
    degradado.stop(0, COLOR.marino).stop(1, COLOR.acento);
    doc.rect(0, 0, ANCHO, 50).fill(degradado);
    this.confeti(doc, [[296, 14, 9, COLOR.rosa], [318, 34, 6, COLOR.amarillo], [340, 13, 5, COLOR.celeste], [278, 38, 4, COLOR.verde], [252, 12, 3, COLOR.amarillo]]);
    doc.font('negrita').fontSize(12).fillColor('#ffffff').text('CREDENCIAL DE ANALISTA', 16, 13, { lineBreak: false });
    doc.font('normal').fontSize(7.5).fillColor('#c7d0ff').text('Lenguajes Formales y Autómatas · UMG', 16, 31, { lineBreak: false });

    // Foto modificada en círculo
    const cx = 66;
    const cy = 128;
    const r = 43;
    doc.circle(cx, cy, r + 5).fill(COLOR.acento);
    doc.circle(cx, cy, r + 2).fill('#ffffff');
    if (foto) {
      doc.save();
      doc.circle(cx, cy, r).clip();
      doc.image(foto, cx - r, cy - r, { width: r * 2, height: r * 2 });
      doc.restore();
    } else {
      doc.circle(cx, cy, r).fill(COLOR.acentoSuave);
      const iniciales = (user.fullName || user.nickname || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
      doc.font('negrita').fontSize(26).fillColor(COLOR.acento).text(iniciales, cx - r, cy - 15, { width: r * 2, align: 'center' });
    }
    doc.circle(cx + 32, cy + 31, 11).fill(COLOR.rosa);
    doc.font('negrita').fontSize(11).fillColor('#ffffff').text('★', cx + 21, cy + 24, { width: 22, align: 'center', lineBreak: false });

    // Datos del usuario
    const x = 128;
    const ancho = 128;
    let y = 66;
    doc.font('negrita').fontSize(13).fillColor(COLOR.marino);
    const nombre = user.fullName || user.nickname;
    const altoNombre = Math.min(doc.heightOfString(nombre, { width: ancho }), 33);
    doc.text(nombre, x, y, { width: ancho, height: 33, ellipsis: true });
    y += altoNombre + 2;
    doc.font('normal').fontSize(9.5).fillColor(COLOR.acento).text(`@${user.nickname}`, x, y, { width: ancho, lineBreak: false, ellipsis: true });
    y += 17;
    doc.roundedRect(x, y, 60, 15, 7.5).fill(COLOR.acentoSuave);
    doc.font('negrita').fontSize(7).fillColor(COLOR.acento).text('ANALISTA', x, y + 4, { width: 60, align: 'center', lineBreak: false });
    y += 22;
    const fecha = new Date(issuedAt || Date.now()).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' });
    doc.font('normal').fontSize(7.5).fillColor(COLOR.gris)
      .text(`No. ${code}`, x, y, { lineBreak: false })
      .text(`Inscrito: ${fecha}`, x, y + 11, { lineBreak: false });

    // Código QR
    const qx = 270;
    const qy = 64;
    const qs = 76;
    doc.roundedRect(qx - 6, qy - 6, qs + 12, qs + 26, 9).fill(COLOR.fondoQr);
    doc.image(qr, qx, qy, { width: qs, height: qs });
    doc.font('negrita').fontSize(6.5).fillColor(COLOR.marino).text('Escanéame para entrar', qx - 6, qy + qs + 6, { width: qs + 12, align: 'center', lineBreak: false });

    // Pie
    doc.font('normal').fontSize(6.5).fillColor(COLOR.gris).text('Constancia de inscripción · Uso personal e intransferible', 16, ALTO - 22, { lineBreak: false });
    this.franjaInferior(doc);
  }

  reverso(doc, code) {
    doc.rect(0, 0, ANCHO, 34).fill(COLOR.marino);
    doc.rect(0, 34, ANCHO, 3).fill(COLOR.acento);
    this.confeti(doc, [[330, 17, 7, COLOR.rosa], [312, 9, 4, COLOR.amarillo], [346, 27, 3, COLOR.celeste]]);
    doc.font('negrita').fontSize(11).fillColor('#ffffff').text('¿Cómo usar tu credencial?', 16, 11, { lineBreak: false });

    const pasos = [
      ['1', 'Entrar con QR', 'En la pantalla de inicio de sesión elige "Entrar con QR" y muestra este código a la cámara.'],
      ['2', 'Es personal', 'No compartas tu credencial: el código QR funciona como tu llave de acceso.'],
      ['3', '¿La perdiste?', 'Genera una nueva en Gestión de Perfil. El QR anterior dejará de funcionar automáticamente.']
    ];
    let y = 52;
    pasos.forEach(([numero, titulo, texto], i) => {
      const color = [COLOR.acento, COLOR.rosa, COLOR.verde][i];
      doc.circle(28, y + 9, 10).fill(color);
      doc.font('negrita').fontSize(10).fillColor('#ffffff').text(numero, 18, y + 3.5, { width: 20, align: 'center', lineBreak: false });
      doc.font('negrita').fontSize(9).fillColor(COLOR.marino).text(titulo, 46, y, { lineBreak: false });
      doc.font('normal').fontSize(7.5).fillColor(COLOR.texto).text(texto, 46, y + 12, { width: ANCHO - 66 });
      y += 44;
    });
    doc.font('normal').fontSize(6.5).fillColor(COLOR.gris).text(`Credencial ${code}`, 16, ALTO - 22, { lineBreak: false });
    this.franjaInferior(doc);
  }

  confeti(doc, puntos) {
    puntos.forEach(([x, y, r, color]) => doc.circle(x, y, r).fillOpacity(0.9).fill(color));
    doc.fillOpacity(1);
  }

  franjaInferior(doc) {
    const franja = doc.linearGradient(0, 0, ANCHO, 0);
    franja.stop(0, COLOR.rosa).stop(0.5, '#784ba0').stop(1, COLOR.acento);
    doc.rect(0, ALTO - 8, ANCHO, 8).fill(franja);
  }

  emailHtml(user, code) {
    const escapar = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
        <div style="background:linear-gradient(90deg,#1a1a2e,#4361ee);color:#fff;padding:22px 26px">
          <h2 style="margin:0">🎉 ¡Bienvenido, ${escapar(user.fullName || user.nickname)}!</h2>
          <p style="margin:6px 0 0;color:#c7d0ff">Tu registro quedó listo</p>
        </div>
        <div style="padding:22px 26px;color:#2d2d3a;line-height:1.5">
          <p>Adjuntamos tu <b>credencial de inscripción ${escapar(code)}</b> en PDF, con la foto que personalizaste.</p>
          <p>Guárdala bien: con su <b>código QR</b> podrás iniciar sesión sin escribir tu contraseña.</p>
          <p style="color:#6b7280;font-size:13px">Usuario: <b>@${escapar(user.nickname)}</b></p>
        </div>
        <div style="height:6px;background:linear-gradient(90deg,#ff3cac,#784ba0,#4361ee)"></div>
      </div>`;
  }
}

module.exports = new CredentialService();
