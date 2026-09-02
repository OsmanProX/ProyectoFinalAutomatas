document.addEventListener('DOMContentLoaded', function () {
  const btnFace = document.getElementById('btnFaceLogin');
  const faceSection = document.getElementById('faceSection');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const faceStatus = document.getElementById('faceStatus');
  const usernameInput = document.getElementById('username');
  const btnVerify = document.getElementById('btnVerify');
  const btnCloseCamera = document.getElementById('btnCloseCamera');

  let stream = null;
  let modelsLoaded = false;

  btnFace.addEventListener('click', openCamera);
  if (btnVerify) btnVerify.addEventListener('click', verifyFace);
  if (btnCloseCamera) btnCloseCamera.addEventListener('click', closeCamera);

  async function openCamera() {
    const username = usernameInput.value.trim();
    if (!username) {
      showStatus('Ingrese su usuario primero', 'error');
      return;
    }

    faceSection.style.display = 'block';
    btnFace.style.display = 'none';

    try {
      if (!modelsLoaded) {
        showStatus('Cargando modelos...', 'loading');
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        modelsLoaded = true;
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      video.srcObject = stream;
      video.play();

      showStatus('Presione "Verificar" cuando su rostro sea visible', 'loading');
    } catch (err) {
      console.error('Error:', err);
      showStatus('No se pudo acceder a la cámara', 'error');
      closeCamera();
    }
  }

  async function verifyFace() {
    const username = usernameInput.value.trim();
    if (!username) {
      showStatus('Ingrese su usuario', 'error');
      return;
    }

    showStatus('Detectando rostro...', 'loading');

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        showStatus('No se detectó rostro. Intente de nuevo.', 'error');
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      showStatus('Verificando identidad...', 'loading');

      const response = await fetch('/login/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, descriptor })
      });

      const data = await response.json();

      if (data.success) {
        showStatus('Rostro verificado. Similitud: ' + data.similarity + '%', 'success');
        setTimeout(() => {
          window.location.href = data.redirect || '/users/dashboard';
        }, 1500);
      } else {
        let msg = 'Rostro no coincide';
        if (data.error === 'user_not_found') msg = 'Usuario no encontrado';
        else if (data.error === 'no_photo_registered') msg = 'Usuario sin foto registrada';
        else if (data.error === 'account_disabled') msg = 'Cuenta desactivada';
        else if (data.similarity) msg += '. Similitud: ' + data.similarity + '%';
        showStatus(msg, 'error');
      }
    } catch (err) {
      console.error('Error:', err);
      showStatus('Error de conexión', 'error');
    }
  }

  function closeCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    faceSection.style.display = 'none';
    btnFace.style.display = 'block';
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function showStatus(msg, type) {
    if (!faceStatus) return;
    faceStatus.textContent = msg;
    faceStatus.className = 'face-status face-' + type;
  }
});
