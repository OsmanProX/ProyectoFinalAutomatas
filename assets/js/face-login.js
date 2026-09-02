document.addEventListener('DOMContentLoaded', function () {
  const btnFace = document.getElementById('btnFaceLogin');
  const faceSection = document.getElementById('faceSection');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const faceStatus = document.getElementById('faceStatus');
  const usernameInput = document.getElementById('username');

  let stream = null;
  let detecting = false;
  let modelsLoaded = false;

  if (btnFace) {
    btnFace.addEventListener('click', toggleFaceLogin);
  }

  async function toggleFaceLogin() {
    if (stream) {
      stopCamera();
      return;
    }

    const username = usernameInput.value.trim();
    if (!username) {
      showStatus('Ingrese su usuario primero', 'error');
      return;
    }

    faceSection.style.display = 'block';
    btnFace.textContent = 'Cancelar';

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

      showStatus('Buscando rostro...', 'loading');
      startDetection();
    } catch (err) {
      console.error('Error:', err);
      showStatus('No se pudo acceder a la cámara', 'error');
      stopCamera();
    }
  }

  function startDetection() {
    detecting = true;
    detectFace();
  }

  async function detectFace() {
    if (!detecting || !stream) return;

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        const resized = faceapi.resizeResults(detection, displaySize);

        const ctx = canvas.getContext('2d');
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
        ctx.drawImage(video, 0, 0);

        const box = resized.detection.box;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const descriptor = Array.from(detection.descriptor);

        if (descriptor.length === 128) {
          detecting = false;
          await sendDescriptor(descriptor);
          return;
        }
      }

      requestAnimationFrame(detectFace);
    } catch (err) {
      console.error('Error en detección:', err);
      requestAnimationFrame(detectFace);
    }
  }

  async function sendDescriptor(descriptor) {
    const username = usernameInput.value.trim();
    showStatus('Verificando rostro...', 'loading');

    try {
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
        }, 1000);
      } else {
        showStatus('Rostro no coincide. Similitud: ' + (data.similarity || 0) + '%', 'error');
        detecting = true;
        detectFace();
      }
    } catch (err) {
      console.error('Error:', err);
      showStatus('Error de conexión', 'error');
      detecting = true;
      detectFace();
    }
  }

  function stopCamera() {
    detecting = false;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    faceSection.style.display = 'none';
    btnFace.textContent = 'Login con Rostro';
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function showStatus(msg, type) {
    if (!faceStatus) return;
    faceStatus.textContent = msg;
    faceStatus.className = 'face-status face-' + type;
  }
});
