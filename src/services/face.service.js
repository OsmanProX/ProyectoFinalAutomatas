const faceLocal = require('./face-local.service');

/**
 * Servicio facial usado por auth.controller (registro y login facial).
 *
 * Antes llamaba a una API externa (ngrok). Ahora delega en el motor local
 * face-local.service, pero se mantiene igual su API publica:
 *   - segment(image)            -> base64 del rostro segmentado (o lanza error con .code)
 *   - verify(live, stored)      -> { match, similarity, segmentedImage, detail } (nunca lanza)
 * y los mismos codigos de error: invalid_image, invalid_image_format,
 * segmentar_failed, missing_image.
 */

function stripDataUrl(image) {
  if (!image) return image;
  const idx = image.indexOf('base64,');
  if (idx !== -1) return image.substring(idx + 7);
  return image;
}

function isLikelyBase64(value) {
  if (!value || typeof value !== 'string') return false;
  const stripped = stripDataUrl(value);
  return stripped.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(stripped);
}

class FaceService {
  async segment(imageBase64) {
    if (!imageBase64 || !isLikelyBase64(imageBase64)) {
      const err = new Error('imagen_invalida');
      err.code = 'invalid_image';
      throw err;
    }
    try {
      return await faceLocal.segmentar(imageBase64);
    } catch (err) {
      if (err.code) throw err;
      const e = new Error(err.message || 'segmentacion_fallida');
      e.code = 'segmentar_failed';
      throw e;
    }
  }

  async verify(liveImageBase64, storedImageBase64) {
    if (!liveImageBase64 || !storedImageBase64) {
      return { match: false, error: 'missing_image' };
    }

    if (!isLikelyBase64(liveImageBase64) || !isLikelyBase64(storedImageBase64)) {
      return { match: false, error: 'invalid_image_format' };
    }

    try {
      const inicio = Date.now();
      const resultado = await faceLocal.verificar(liveImageBase64, storedImageBase64);

      console.log('[Rostro] Verificar → coincide:', resultado.coincide,
        '| score:', resultado.score, '| distancia:', resultado.distancia, `| ${Date.now() - inicio} ms`);

      return {
        match: resultado.coincide === true,
        similarity: resultado.score,
        segmentedImage: resultado.segmentadoA,
        detail: {
          coincide: resultado.coincide,
          score: resultado.score,
          distancia: resultado.distancia
        }
      };
    } catch (err) {
      console.error('Error en verificación facial:', err.message);
      return {
        match: false,
        error: err.code || 'verification_error',
        detail: err.detail || null
      };
    }
  }
}

module.exports = new FaceService();
