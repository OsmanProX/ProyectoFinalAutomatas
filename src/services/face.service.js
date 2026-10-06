const FACE_API_BASE = process.env.FACE_API_BASE || 'https://reversal-sedate-catnip.ngrok-free.dev';

function stripDataUrl(image) {
  if (!image) return image;
  const idx = image.indexOf('base64,');
  if (idx !== -1) return image.substring(idx + 7);
  return image;
}

function isLikelyBase64(value) {
  if (!value || typeof value !== 'string') return false;
  return /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 100;
}

class FaceService {
  async callSegmentar(rostroBase64) {
    const url = `${FACE_API_BASE}/api/Rostro/Segmentar`;
    const payload = { RostroA: stripDataUrl(rostroBase64) };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(`segmentar_respuesta_no_json: ${raw.substring(0, 200)}`);
    }

    if (!response.ok || data.resultado === false || data.segmentado === false) {
      const msg = data && (data.error || data.mensaje) || `http_${response.status}`;
      const err = new Error(`segmentar_fallo: ${msg}`);
      err.code = 'segmentar_failed';
      err.detail = data;
      throw err;
    }

    return data.rostro;
  }

  async callVerificar(rostroABase64, rostroBBase64) {
    const url = `${FACE_API_BASE}/api/Rostro/Verificar`;
    const payload = {
      RostroA: stripDataUrl(rostroABase64),
      RostroB: stripDataUrl(rostroBBase64)
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(`verificar_respuesta_no_json: ${raw.substring(0, 200)}`);
    }

    if (!response.ok) {
      const msg = data && (data.error || data.mensaje) || `http_${response.status}`;
      const err = new Error(`verificar_fallo: ${msg}`);
      err.code = 'verificar_http_error';
      err.detail = data;
      throw err;
    }

    return data;
  }

  async segment(imageBase64) {
    if (!imageBase64 || !isLikelyBase64(imageBase64)) {
      const err = new Error('imagen_invalida');
      err.code = 'invalid_image';
      throw err;
    }
    return await this.callSegmentar(imageBase64);
  }

  async verify(liveImageBase64, storedImageBase64) {
    if (!liveImageBase64 || !storedImageBase64) {
      return { match: false, error: 'missing_image' };
    }

    if (!isLikelyBase64(liveImageBase64) || !isLikelyBase64(storedImageBase64)) {
      return { match: false, error: 'invalid_image_format' };
    }

    try {
      const segmentedLive = await this.callSegmentar(liveImageBase64);

      const result = await this.callVerificar(segmentedLive, storedImageBase64);

      const match = result.resultado === true || result.coincide === true || result.match === true;
      const similarity = result.similitud || result.similarity || result.score || null;

      return {
        match,
        similarity,
        detail: result
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