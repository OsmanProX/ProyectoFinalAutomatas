const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const LADO_MAXIMO = 640;    // las fotos mas grandes se reducen antes de detectar (mas rapido)
const MAX_EN_CACHE = 200;   // descriptores de fotos guardadas que se recuerdan en memoria

// Descriptor de la foto GUARDADA de cada usuario (huella SHA-256 de la imagen -> descriptor):
// en cada login solo se analiza la foto en vivo; si la foto guardada cambia, cambia la huella
const descriptoresGuardados = new Map();

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

/**
 * Detecta el rostro mas grande; devuelve la deteccion o null.
 * Si no lo encuentra, reintenta con un margen gris alrededor y menos exigencia:
 * las fotos muy recortadas (el rostro llena toda la imagen, como las que
 * guardaba la API anterior de Neurotec) a veces no se detectan sin ese margen.
 */
async function detectar(img) {
  const det = await detectarUnaVez(img, 0.4);
  if (det) return det;

  const margen = Math.round(Math.max(img.width, img.height) * 0.35);
  const conMargen = agregarMargen(img, margen);
  const det2 = await detectarUnaVez(conMargen, 0.2);
  if (!det2) return null;

  // La caja se pasa a las coordenadas de la imagen original (para recortar)
  const b = det2.detection.box;
  const x = Math.max(0, b.x - margen);
  const y = Math.max(0, b.y - margen);
  return {
    descriptor: det2.descriptor,
    detection: {
      box: {
        x,
        y,
        width: Math.min(img.width - x, b.width),
        height: Math.min(img.height - y, b.height)
      }
    }
  };
}

/** Copia la imagen RGBA al centro de un lienzo gris con "margen" px por lado */
function agregarMargen(img, margen) {
  const width = img.width + margen * 2;
  const height = img.height + margen * 2;
  const data = new Uint8Array(width * height * 4).fill(128);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (let row = 0; row < img.height; row++) {
    const src = row * img.width * 4;
    data.set(img.data.subarray(src, src + img.width * 4), ((row + margen) * width + margen) * 4);
  }
  return { data, width, height };
}

/** Una pasada del detector con la confianza mínima indicada */
async function detectarUnaVez(img, confianza) {
  const api = await preparar();
  const tensor = aTensor(img, api);
  try {
    const dets = await api
      .detectAllFaces(tensor, new api.SsdMobilenetv1Options({ minConfidence: confianza }))
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

/** Reduce la imagen si su lado mayor pasa de LADO_MAXIMO (vecino más cercano: rápido y suficiente) */
function reducir(img) {
  const lado = Math.max(img.width, img.height);
  if (lado <= LADO_MAXIMO) return img;
  const escala = LADO_MAXIMO / lado;
  const width = Math.round(img.width * escala);
  const height = Math.round(img.height * escala);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const fila = Math.min(img.height - 1, Math.floor(y / escala)) * img.width;
    for (let x = 0; x < width; x++) {
      const src = (fila + Math.min(img.width - 1, Math.floor(x / escala))) * 4;
      const dst = (y * width + x) * 4;
      data[dst] = img.data[src];
      data[dst + 1] = img.data[src + 1];
      data[dst + 2] = img.data[src + 2];
      data[dst + 3] = 255;
    }
  }
  return { data, width, height };
}

/** Descriptor de la foto guardada, desde la memoria si ya se calculó antes */
async function descriptorGuardado(imagen) {
  const huella = crypto.createHash('sha256').update(imagen).digest('hex');
  if (descriptoresGuardados.has(huella)) return descriptoresGuardados.get(huella);
  const det = await detectar(reducir(decodificar(imagen)));
  if (!det) return null;
  if (descriptoresGuardados.size >= MAX_EN_CACHE) {
    descriptoresGuardados.delete(descriptoresGuardados.keys().next().value); // se olvida la más vieja
  }
  descriptoresGuardados.set(huella, det.descriptor);
  return det.descriptor;
}

/**
 * Carga los modelos y hace una detección de prueba al arrancar el servidor,
 * para que el primer login con rostro no tenga que esperar esa carga.
 */
async function precalentar() {
  const api = await preparar();
  const prueba = { width: 64, height: 64, data: new Uint8Array(64 * 64 * 4).fill(128) };
  const tensor = aTensor(prueba, api);
  try {
    await api.detectAllFaces(tensor, new api.SsdMobilenetv1Options({ minConfidence: 0.9 }));
  } finally {
    tensor.dispose();
  }
}

/**
 * Segmenta el rostro de una imagen (data URL o base64 puro).
 * Devuelve el recorte del rostro en base64 JPEG (sin prefijo data:).
 */
async function segmentar(image) {
  const img = reducir(decodificar(image));
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
  const imgA = reducir(decodificar(rostroA));
  const detA = await detectar(imgA);
  if (!detA) {
    throw errorConCodigo('segmentar_failed', 'no se detecto rostro en la imagen A');
  }
  const segmentadoA = recortar(imgA, detA);

  const descriptorB = await descriptorGuardado(rostroB);
  if (!descriptorB) {
    throw errorConCodigo('segmentar_failed', 'no se detecto rostro en la imagen B');
  }

  const api = cargarDependencias();
  const distancia = api.euclideanDistance(detA.descriptor, descriptorB);
  const score = Math.max(0, Math.round((1 - Math.min(distancia, 1)) * 100));

  return {
    coincide: distancia < UMBRAL_MATCH,
    score,
    distancia: Number(distancia.toFixed(4)),
    segmentadoA
  };
}

module.exports = { segmentar, verificar, precalentar };
