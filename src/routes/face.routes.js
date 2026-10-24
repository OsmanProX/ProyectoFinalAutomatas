const express = require('express');
const faceLocal = require('../services/face-local.service');

/**
 * Endpoints de segmentacion y verificacion facial LOCALES.
 * Mismo contrato que la API externa que se usaba antes (ngrok):
 *   POST /api/rostro/segmentar  { image }            -> { resultado, rostro, error }
 *   POST /api/rostro/verificar  { rostroA, rostroB } -> { resultado, coincide, score, distancia, error }
 *
 * Publicos a proposito: el registro (sin sesion) los necesita.
 */
const router = express.Router();

// Las fotos llegan como data URL/base64 en JSON (webcam ~200 KB, recortes ~80 KB)
router.use(express.json({ limit: '4mb' }));

function imagenValida(valor) {
  return typeof valor === 'string' && valor.length > 100;
}

function fallo(res, err, extra = {}) {
  console.warn('[Rostro] fallo:', err && err.message ? err.message : err);
  // La API externa respondia 200 con resultado:false en errores de proceso
  return res.json({
    resultado: false,
    error: (err && err.message) || 'no se pudo procesar el rostro',
    ...extra
  });
}

router.post('/segmentar', async (req, res) => {
  try {
    const body = req.body || {};
    const imagen = body.image || body.imagen || body.rostro;
    if (!imagenValida(imagen)) {
      return res.status(400).json({ resultado: false, error: 'falta la imagen (image)' });
    }
    const rostro = await faceLocal.segmentar(imagen);
    return res.json({ resultado: true, rostro, error: null });
  } catch (err) {
    return fallo(res, err);
  }
});

router.post('/verificar', async (req, res) => {
  try {
    const body = req.body || {};
    const { rostroA, rostroB } = body;
    if (!imagenValida(rostroA) || !imagenValida(rostroB)) {
      return res.status(400).json({
        resultado: false,
        coincide: false,
        score: '',
        error: 'faltan rostroA o rostroB (base64 valido)'
      });
    }
    const r = await faceLocal.verificar(rostroA, rostroB);
    return res.json({
      resultado: true,
      coincide: r.coincide,
      score: r.score,
      distancia: r.distancia,
      error: null
    });
  } catch (err) {
    return fallo(res, err, { coincide: false, score: '' });
  }
});

module.exports = router;
