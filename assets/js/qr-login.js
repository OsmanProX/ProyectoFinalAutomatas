/**
 * ============================================================================
 * LOGIN CON CÓDIGO QR
 * ============================================================================
 * 1. Abre la cámara y analiza cada cuadro del video con jsQR (en el navegador).
 * 2. Cuando encuentra un QR de credencial (texto "LFA1.<id>.<secreto>") lo envía
 *    a POST /login/qr, donde el servidor lo valida contra el secreto cifrado.
 * 3. También permite subir una imagen/captura del QR (si no hay cámara).
 * 4. Si hay varias cámaras (integrada, DroidCam, USB…) se elige en una lista;
 *    la elección se recuerda en este navegador.
 * Muestra el tiempo total del login (requisito: menos de 15 segundos).
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const i18n = window.QR_I18N || {};
  const btnQr = document.getElementById('btnQrLogin');
  const section = document.getElementById('qrSection');
  const video = document.getElementById('qrVideo');
  const status = document.getElementById('qrStatus');
  const btnCancel = document.getElementById('btnQrCancel');
  const btnUpload = document.getElementById('btnQrUpload');
  const fileInput = document.getElementById('qrFileInput');
  const cameraBox = document.getElementById('qrCameraBox');
  const cameraSelect = document.getElementById('qrCamera');
  if (!btnQr || !section || typeof window.jsQR !== 'function') return;

  const PREFIJO = 'LFA1.';
  const CLAVE_CAMARA = 'qrCameraId';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let stream = null;
  let escaneando = false;
  let verificando = false;
  let inicio = 0;
  let ultimoAnalisis = 0;

  btnQr.addEventListener('click', abrir);
  btnCancel.addEventListener('click', cerrar);
  btnUpload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', leerImagen);
  if (cameraSelect) cameraSelect.addEventListener('change', cambiarCamara);

  function mostrarEstado(texto, tipo) {
    status.textContent = texto;
    status.className = `face-status face-${tipo}`;
  }

  // ------------------------------------------------------------ cámara elegida (localStorage puede no estar disponible)
  function leerCamaraGuardada() {
    try { return localStorage.getItem(CLAVE_CAMARA); } catch (err) { return null; }
  }

  function guardarCamara(id) {
    try { localStorage.setItem(CLAVE_CAMARA, id); } catch (err) { /* sin almacenamiento: no se recuerda */ }
  }

  /** Pide la cámara indicada; si no se indica (o ya no existe) usa la trasera/por defecto */
  async function pedirCamara(deviceId) {
    const base = { width: { ideal: 1280 }, height: { ideal: 720 } };
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { ...base, deviceId: { exact: deviceId } } });
      } catch (err) {
        // La cámara guardada se desconectó (p. ej. DroidCam apagado): se usa la de por defecto
      }
    }
    return navigator.mediaDevices.getUserMedia({ video: { ...base, facingMode: { ideal: 'environment' } } });
  }

  /** Llena la lista con las cámaras del equipo (los nombres solo se ven después de dar permiso) */
  async function cargarCamaras() {
    if (!cameraSelect || !cameraBox || !navigator.mediaDevices.enumerateDevices) return;
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const camaras = dispositivos.filter((d) => d.kind === 'videoinput');
    const actual = stream && stream.getVideoTracks()[0] ? stream.getVideoTracks()[0].getSettings().deviceId : '';

    cameraSelect.textContent = '';
    camaras.forEach((camara, indice) => {
      const opcion = document.createElement('option');
      opcion.value = camara.deviceId;
      opcion.textContent = camara.label || `${i18n.camera || 'Cámara'} ${indice + 1}`;
      if (camara.deviceId === actual) opcion.selected = true;
      cameraSelect.appendChild(opcion);
    });
    // Solo se muestra la lista si hay más de una cámara
    cameraBox.hidden = camaras.length < 2;
  }

  async function iniciarVideo(deviceId) {
    detenerCamara();
    stream = await pedirCamara(deviceId);
    video.srcObject = stream;
    await video.play();
    escaneando = true;
    requestAnimationFrame(analizarCuadro);
  }

  async function abrir() {
    inicio = performance.now();
    section.style.display = 'block';
    btnQr.style.display = 'none';
    mostrarEstado(i18n.hint, 'loading');
    try {
      await iniciarVideo(leerCamaraGuardada());
      await cargarCamaras();
      mostrarEstado(i18n.scanning, 'loading');
    } catch (err) {
      mostrarEstado(i18n.cameraError, 'error');
    }
  }

  async function cambiarCamara() {
    const id = cameraSelect.value;
    guardarCamara(id);
    mostrarEstado(i18n.hint, 'loading');
    try {
      await iniciarVideo(id);
      mostrarEstado(i18n.scanning, 'loading');
    } catch (err) {
      mostrarEstado(i18n.cameraError, 'error');
    }
  }

  function detenerCamara() {
    escaneando = false;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function cerrar() {
    detenerCamara();
    section.style.display = 'none';
    btnQr.style.display = '';
    status.textContent = '';
  }

  /** Analiza ~8 cuadros por segundo para no saturar el procesador */
  function analizarCuadro(ahora) {
    if (!escaneando) return;
    if (!verificando && ahora - ultimoAnalisis > 120 && video.readyState === video.HAVE_ENOUGH_DATA) {
      ultimoAnalisis = ahora;
      const escala = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const codigo = window.jsQR(datos.data, datos.width, datos.height, { inversionAttempts: 'dontInvert' });
      if (codigo && codigo.data) procesarTexto(codigo.data);
    }
    requestAnimationFrame(analizarCuadro);
  }

  /** Lee el QR desde una imagen o captura de pantalla */
  function leerImagen(evento) {
    const archivo = evento.target.files[0];
    fileInput.value = '';
    if (!archivo || !archivo.type.startsWith('image/')) return;
    if (!inicio) inicio = performance.now();
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1200 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const codigo = window.jsQR(datos.data, datos.width, datos.height, { inversionAttempts: 'attemptBoth' });
      URL.revokeObjectURL(img.src);
      if (codigo && codigo.data) procesarTexto(codigo.data);
      else mostrarEstado(i18n.noCode, 'error');
    };
    img.src = URL.createObjectURL(archivo);
  }

  async function procesarTexto(texto) {
    if (verificando) return;
    if (!texto.startsWith(PREFIJO)) {
      mostrarEstado(i18n.notCredential, 'error');
      return;
    }
    verificando = true;
    mostrarEstado(i18n.verifying, 'loading');
    try {
      const respuesta = await fetch('/login/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token: texto })
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.ok && datos.success) {
        detenerCamara();
        const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
        mostrarEstado(`${i18n.success} ${segundos} ${i18n.seconds}`, 'success');
        setTimeout(() => { window.location.href = datos.redirect || '/users/dashboard'; }, 700);
        return;
      }
      mostrarEstado(datos.message || i18n.invalid, 'error');
      // Espera un momento antes de volver a intentar con otro QR
      setTimeout(() => { verificando = false; }, 2000);
    } catch (err) {
      mostrarEstado(i18n.connectionError, 'error');
      setTimeout(() => { verificando = false; }, 2000);
    }
  }
});
