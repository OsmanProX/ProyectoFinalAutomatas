const fs = require('fs');
const path = require('path');

/**
 * Reconocimiento facial LOCAL (sin API externa/ngrok).
 * Usa los modelos que ya estan en assets/models con @vladmandic/face-api
 * en build WASM (sin binarios nativos, compatible con Bun y Node).
 *
 * - segmentar(imagen): detecta el rostro y devuelve el recorte en base64 (sin prefijo).
 * - verificar(rostroA, rostroB): calcula los descriptores faciales (128d) de ambas
 *   imagenes y devuelve si son la misma persona + puntaje.
 */

const MODELS_DIR = path.join(__dirname, '..', '..', 'assets', 'models');
const UMBRAL_MATCH = 0.6;   // distancia euclidiana tipica para "misma persona"
const PADDING = 0.25;       // margen al recortar el rostro segmentado
const MIN_BASE64 = 100;     // una foto real ocupa mucho mas que esto

let faceapi = null;
let jpeg = null;
let PNG = null;
let modelos = null;          // promesa unica de carga (se reintenta si falla)

function cargarDependencias() {
  if (!faceapi) {
    // Build WASM: @vladmandic/face-api/node exige tfjs-node (nativo); este no.
    faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    jpeg = require('jpeg-js');
    PNG = require('pngjs').PNG;
  }
  return faceapi;
}

async function preparar() {
  const api = cargarDependencias();
  if (!modelos) {
    modelos = (async () => {
      try {
        await api.tf.setBackend('wasm');
        await api.tf.ready();
      } catch (err) {
        // si ya esta inicializado con otro backend, continuar
      }
      if (!fs.existsSync(MODELS_DIR)) {
        throw new Error(`no se encontraron los modelos en ${MODELS_DIR}`);
      }
      await api.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
      await api.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
      await api.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
    })();
    modelos.catch(() => { modelos = null; });
  }
  await modelos;
  return api;
}

function quitarDataUrl(image) {
  if (!image || typeof image !== 'string') return null;
  const idx = image.indexOf('base64,');
  return idx !== -1 ? image.substring(idx + 7) : image;
}

function errorConCodigo(codigo, mensaje) {
  const err = new Error(mensaje);
  err.code = codigo;
  return err;
}

function decodificar(image) {
  cargarDependencias(); // jpeg/png se cargan aqui (se ejecuta antes de preparar)
  const b64 = quitarDataUrl(image);
  if (!b64 || b64.length < MIN_BASE64) {
    throw errorConCodigo('invalid_image', 'imagen invalida o demasiado pequena');
  }
  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch (err) {
    throw errorConCodigo('invalid_image', 'base64 invalido');
  }
  if (buf.length < 64) {
    throw errorConCodigo('invalid_image', 'imagen corrupta');
  }
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) { // PNG
      const png = PNG.sync.read(buf);
      return { data: png.data, width: png.width, height: png.height };
    }
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { data: img.data, width: img.width, height: img.height };
  } catch (err) {
    throw errorConCodigo('invalid_image', 'no se pudo decodificar la imagen');
  }
}

function aTensor(img, api) {
  const rgb = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
    rgb[j] = img.data[i];
    rgb[j + 1] = img.data[i + 1];
    rgb[j + 2] = img.data[i + 2];
  }
  return api.tf.tensor3d(rgb, [img.height, img.width, 3], 'int32');
}

/** Detecta el rostro mas grande; devuelve la deteccion o null. */
async function detectar(img) {
  const api = await preparar();
  const tensor = aTensor(img, api);
  try {
    const dets = await api
      .detectAllFaces(tensor, new api.SsdMobilenetv1Options({ minConfidence: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (!dets || dets.length === 0) return null;
    let mejor = dets[0];
    for (const d of dets) {
      const a = d.detection.box.width * d.detection.box.height;
      const b = mejor.detection.box.width * mejor.detection.box.height;
      if (a > b) mejor = d;
    }
    return mejor;
  } finally {
    tensor.dispose();
  }
}

/** Recorta el rostro con margen y lo devuelve como base64 JPEG (sin prefijo). */
function recortar(img, det) {
  const b = det.detection.box;
  const padX = b.width * PADDING;
  const padY = b.height * PADDING;
  const x = Math.max(0, Math.round(b.x - padX));
  const y = Math.max(0, Math.round(b.y - padY));
  const w = Math.min(img.width - x, Math.round(b.width + padX * 2));
  const h = Math.min(img.height - y, Math.round(b.height + padY * 2));
  if (w <= 0 || h <= 0) {
    throw errorConCodigo('segmentar_failed', 'no se pudo recortar el rostro');
  }
  const out = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * img.width + x) * 4;
    out.set(img.data.subarray(src, src + w * 4), row * w * 4);
  }
  const enc = jpeg.encode({ data: out, width: w, height: h }, 88);
  return enc.data.toString('base64');
}

/**
 * Segmenta el rostro de una imagen (data URL o base64 puro).
 * Devuelve el recorte del rostro en base64 JPEG (sin prefijo data:).
 */
async function segmentar(image) {
  const img = decodificar(image);
  const det = await detectar(img);
  if (!det) {
    throw errorConCodigo('segmentar_failed', 'no se detecto ningun rostro en la imagen');
  }
  return recortar(img, det);
}

/**
 * Compara dos imagenes con rostro (registro/live vs foto guardada).
 * Devuelve { coincide, score (0-100), distancia, segmentadoA }.
 */
async function verificar(rostroA, rostroB) {
  const imgA = decodificar(rostroA);
  const detA = await detectar(imgA);
  if (!detA) {
    throw errorConCodigo('segmentar_failed', 'no se detecto rostro en la imagen A');
  }
  const segmentadoA = recortar(imgA, detA);

  const imgB = decodificar(rostroB);
  const detB = await detectar(imgB);
  if (!detB) {
    throw errorConCodigo('segmentar_failed', 'no se detecto rostro en la imagen B');
  }

  const api = cargarDependencias();
  const distancia = api.euclideanDistance(detA.descriptor, detB.descriptor);
  const score = Math.max(0, Math.round((1 - Math.min(distancia, 1)) * 100));

  return {
    coincide: distancia < UMBRAL_MATCH,
    score,
    distancia: Number(distancia.toFixed(4)),
    segmentadoA
  };
}

module.exports = { segmentar, verificar };
