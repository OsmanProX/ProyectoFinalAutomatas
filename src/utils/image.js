/**
 * Validación de imágenes recibidas como data URL (data:image/jpeg;base64,...).
 * Se revisa el tipo declarado, el tamaño y la "firma" real del archivo (magic bytes),
 * para no guardar contenido que no sea una imagen (prevención de XSS / archivos falsos).
 */
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024; // 1.5 MB por foto

const FIRMAS = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
};

const PATRON_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * @param {string} dataUrl
 * @returns {{ mime: string, buffer: Buffer } | null} null si no es una imagen válida
 */
function parseImageDataUrl(dataUrl, maxBytes = MAX_PHOTO_BYTES) {
  if (typeof dataUrl !== 'string') return null;
  // Tamaño máximo aproximado antes de decodificar (base64 ocupa 4/3)
  if (dataUrl.length > Math.ceil(maxBytes * 4 / 3) + 40) return null;

  const match = dataUrl.match(PATRON_DATA_URL);
  if (!match) return null;

  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) return null;
  if (!FIRMAS[mime](buffer)) return null;

  return { mime, buffer };
}

function isValidImageDataUrl(dataUrl, maxBytes) {
  return parseImageDataUrl(dataUrl, maxBytes) !== null;
}

module.exports = { MAX_PHOTO_BYTES, parseImageDataUrl, isValidImageDataUrl };
