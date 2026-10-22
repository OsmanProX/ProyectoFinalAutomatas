/**
 * ============================================================================
 * SELECTOR DE CÁMARA (compartido: registro y Gestión de Perfil)
 * ============================================================================
 * - Pide la cámara elegida; si ya no está conectada (p. ej. DroidCam apagado)
 *   usa la de por defecto.
 * - Llena una lista <select> con las cámaras del equipo (solo se muestra si
 *   hay más de una) y recuerda la elección en este navegador.
 * - Usa la misma elección que el login con QR y con rostro.
 * ============================================================================
 */
(function () {
  'use strict';

  const CLAVE_CAMARA = 'qrCameraId';

  function guardada() {
    try { return localStorage.getItem(CLAVE_CAMARA); } catch (err) { return null; }
  }

  function guardar(id) {
    try { localStorage.setItem(CLAVE_CAMARA, id); } catch (err) { /* sin almacenamiento: no se recuerda */ }
  }

  /** @param {string|null} deviceId  @param {MediaTrackConstraints} base */
  async function pedir(deviceId, base) {
    const video = base || { width: 640, height: 480 };
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { ...video, deviceId: { exact: deviceId } } });
      } catch (err) {
        // la cámara guardada no está disponible: se usa la de por defecto
      }
    }
    return navigator.mediaDevices.getUserMedia({ video: { ...video, facingMode: 'user' } });
  }

  /** Llena la lista con las cámaras; los nombres solo aparecen después de dar permiso */
  async function llenar(select, caja, stream, etiqueta) {
    if (!select || !caja || !navigator.mediaDevices.enumerateDevices) return;
    const camaras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const pista = stream && stream.getVideoTracks()[0];
    const actual = pista ? pista.getSettings().deviceId : '';
    select.textContent = '';
    camaras.forEach((camara, indice) => {
      const opcion = document.createElement('option');
      opcion.value = camara.deviceId;
      opcion.textContent = camara.label || `${etiqueta || 'Cámara'} ${indice + 1}`;
      if (camara.deviceId === actual) opcion.selected = true;
      select.appendChild(opcion);
    });
    caja.hidden = camaras.length < 2;
  }

  window.CameraPicker = { guardada, guardar, pedir, llenar };
})();
