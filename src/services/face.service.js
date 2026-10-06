const FACE_API_BASE = process.env.FACE_API_BASE || 'https://reversal-sedate-catnip.ngrok-free.dev';

function stripDataUrl(image) {
  if (!image) return image;
  const idx = image.indexOf('base64,');
  if (idx !== -1) return image.substring(idx + 7);
  return image;
}

function isLikelyBase64(value) {
  if (!value || typeof value !== 'string') return false;
  const stripped = stripDataUrl(value);
  return stripped.length > 100 && /^[A-Za-z0-9+/=]+$/.test(stripped);
}

class FaceService {
  async callSegmentar(rostroBase64) {
    const url = `${FACE_API_BASE}/api/Rostro/Segmentar`;
    const image = stripDataUrl(rostroBase64);
    const payload = { RostroA: image, RostroB: image };

    console.log('[FaceAPI] Segmentar →', url);
    console.log('[FaceAPI] Payload size:', payload.RostroA ? payload.RostroA.length : 0, 'chars');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    console.log('[FaceAPI] Segmentar status:', response.status);
    console.log('[FaceAPI] Segmentar response (primeros 500 chars):', raw.substring(0, 500));

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error(`segmentar_respuesta_no_json: ${raw.substring(0, 200)}`);
    }

    const resultado = data.resultado === true;
    const segmentado = data.segmentado === true;
    const errorMsg = data.error || data.mensaje || data.message || null;

    if (!response.ok) {
      const err = new Error(`segmentar_http_${response.status}: ${errorMsg || raw.substring(0, 100)}`);
      err.code = 'segmentar_failed';
      err.detail = data;
      throw err;
    }

    if (resultado === false || segmentado === false) {
      const err = new Error(`segmentar_fallo: ${errorMsg || 'sin detalle'}`);
      err.code = 'segmentar_failed';
      err.detail = data;
      throw err;
    }

    if (!data.rostro) {
      const err = new Error('segmentar_sin_rostro');
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

    console.log('[FaceAPI] Verificar →', url);
    console.log('[FaceAPI] Payload sizes - A:', payload.RostroA.length, 'B:', payload.RostroB.length);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    console.log('[FaceAPI] Verificar status:', response.status);
    console.log('[FaceAPI] Verificar response:', raw.substring(0, 500));

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
        segmentedImage: segmentedLive,
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