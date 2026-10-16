/**
 * ============================================================================
 * GESTIÓN DE PERFIL
 * ============================================================================
 *  - Cambiar foto: tomar/subir -> recortar -> estudio (filtros/stickers) -> guardar
 *  - Personalizar la foto actual sin cambiar la original
 *  - Cambiar contraseña (verifica la actual en el servidor)
 *  - Generar una credencial nueva (el QR anterior deja de funcionar)
 * Todas las peticiones son JSON (POST) y el contenido se muestra con textContent.
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const config = JSON.parse(document.getElementById('profile-i18n').textContent);
  const t = config.t;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ utilidades
  function estado(elemento, texto, tipo) {
    elemento.textContent = texto || '';
    elemento.className = `profile-status ${tipo ? `profile-status-${tipo}` : ''}`;
  }

  async function enviarJson(url, datos) {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(datos || {})
    });
    if (respuesta.status === 401 && !url.includes('password')) window.location.href = '/login';
    const cuerpo = await respuesta.json().catch(() => ({}));
    return { ok: respuesta.ok && cuerpo.success, cuerpo };
  }

  function refrescarFotos() {
    const v = Date.now();
    $('profilePhoto').src = `/perfil/foto?v=${v}`;
    document.querySelectorAll('.user-chip-avatar').forEach((img) => { img.src = `/perfil/foto?v=${v}`; });
  }

  // ------------------------------------------------------------ foto
  const photoStatus = $('photoStatus');
  let stream = null;
  let cropper = null;

  function mostrarHerramienta(id) {
    ['cameraBox', 'cropBox'].forEach((caja) => { $(caja).hidden = caja !== id; });
    $('photoView').hidden = Boolean(id);
    $('photoButtons').hidden = Boolean(id);
    $('btnCustomize').hidden = Boolean(id);
  }

  function cerrarCamara() {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    $('profileVideo').srcObject = null;
  }

  $('btnTakePhoto').addEventListener('click', async () => {
    estado(photoStatus, '');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      $('profileVideo').srcObject = stream;
      mostrarHerramienta('cameraBox');
    } catch (err) {
      estado(photoStatus, t.profile_camera_error, 'error');
    }
  });

  $('btnCapture').addEventListener('click', () => {
    const video = $('profileVideo');
    const lienzo = document.createElement('canvas');
    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    lienzo.getContext('2d').drawImage(video, 0, 0);
    cerrarCamara();
    abrirRecorte(lienzo.toDataURL('image/jpeg', 0.92));
  });

  $('btnCancelCamera').addEventListener('click', () => { cerrarCamara(); mostrarHerramienta(null); });

  $('btnUploadPhoto').addEventListener('click', () => $('photoFile').click());
  $('photoFile').addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo || !archivo.type.startsWith('image/')) return;
    const lector = new FileReader();
    lector.onload = () => abrirRecorte(lector.result);
    lector.readAsDataURL(archivo);
  });

  function abrirRecorte(src) {
    const img = $('cropImage');
    img.src = src;
    mostrarHerramienta('cropBox');
    if (cropper) cropper.destroy();
    cropper = new window.Cropper(img, { aspectRatio: 1, viewMode: 1, autoCropArea: 0.8 });
  }

  $('btnCancelCrop').addEventListener('click', () => {
    if (cropper) cropper.destroy();
    cropper = null;
    mostrarHerramienta(null);
  });

  // Foto nueva: la recortada es la ORIGINAL; el estudio genera la MODIFICADA
  $('btnCrop').addEventListener('click', async () => {
    if (!cropper) return;
    const original = cropper.getCroppedCanvas({ width: 400, height: 400 }).toDataURL('image/jpeg', 0.85);
    cropper.destroy();
    cropper = null;
    mostrarHerramienta(null);
    const modificada = await abrirEstudio(original);
    await guardarFoto({ photo: original, photo_modified: modificada || original });
  });

  // Solo personalizar: parte de la foto original actual y cambia solo la modificada
  $('btnCustomize').addEventListener('click', async () => {
    estado(photoStatus, '');
    const modificada = await abrirEstudio(`/perfil/foto/original?v=${Date.now()}`);
    if (modificada) await guardarFoto({ photo_modified: modificada });
  });

  function abrirEstudio(src) {
    return window.PhotoStudio.open(src, {
      etiqueta: config.nickname ? `@${config.nickname}` : '',
      textos: config.studio
    }).catch(() => null);
  }

  async function guardarFoto(datos) {
    estado(photoStatus, t.profile_saving, 'info');
    try {
      const { ok, cuerpo } = await enviarJson('/perfil/foto', datos);
      estado(photoStatus, cuerpo.message || t.server_error, ok ? 'ok' : 'error');
      if (ok) refrescarFotos();
    } catch (err) {
      estado(photoStatus, t.server_error, 'error');
    }
  }

  // ------------------------------------------------------------ contraseña
  $('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = $('btnPassword');
    const status = $('passwordStatus');
    boton.disabled = true;
    estado(status, t.profile_saving, 'info');
    try {
      const { ok, cuerpo } = await enviarJson('/perfil/password', {
        current_password: $('current_password').value,
        new_password: $('new_password').value,
        confirm_password: $('confirm_password').value
      });
      estado(status, cuerpo.message || t.server_error, ok ? 'ok' : 'error');
      if (ok) e.target.reset();
    } catch (err) {
      estado(status, t.server_error, 'error');
    } finally {
      boton.disabled = false;
    }
  });

  // ------------------------------------------------------------ credencial
  $('btnNewCredential').addEventListener('click', () => { $('confirmBox').hidden = false; });
  $('btnCancelNew').addEventListener('click', () => { $('confirmBox').hidden = true; });
  $('btnConfirmNew').addEventListener('click', async () => {
    const status = $('credentialStatus');
    $('confirmBox').hidden = true;
    estado(status, t.profile_saving, 'info');
    try {
      const { ok, cuerpo } = await enviarJson('/perfil/credencial/nueva');
      estado(status, cuerpo.message || t.server_error, ok ? 'ok' : 'error');
      if (ok && cuerpo.code && $('credentialCode')) $('credentialCode').textContent = cuerpo.code;
    } catch (err) {
      estado(status, t.server_error, 'error');
    }
  });
});
