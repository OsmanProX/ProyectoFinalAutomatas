document.addEventListener('DOMContentLoaded', function () {
  const btnCamera = document.getElementById('btnCamera');
  const btnUpload = document.getElementById('btnUpload');
  const fileInput = document.getElementById('fileInput');
  const cameraSection = document.getElementById('cameraSection');
  const regVideo = document.getElementById('regVideo');
  const regCanvas = document.getElementById('regCanvas');
  const btnCapture = document.getElementById('btnCapture');
  const btnCancelCamera = document.getElementById('btnCancelCamera');
  const cameraStatus = document.getElementById('cameraStatus');
  const photoPreview = document.getElementById('photoPreview');
  const previewImg = document.getElementById('previewImg');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');
  const photoInput = document.getElementById('photo');
  const registerForm = document.getElementById('registerForm');

  let stream = null;

  btnCamera.addEventListener('click', openCamera);
  btnUpload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileUpload);
  btnCapture.addEventListener('click', capturePhoto);
  btnCancelCamera.addEventListener('click', closeCamera);
  btnRemovePhoto.addEventListener('click', removePhoto);

  registerForm.addEventListener('submit', function (e) {
    if (!photoInput.value) {
      e.preventDefault();
      showCameraStatus('Debe tomar o subir una foto', 'error');
    }
  });

  async function openCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      regVideo.srcObject = stream;
      regVideo.play();
      cameraSection.style.display = 'block';
      photoPreview.style.display = 'none';
      showCameraStatus('Coloque su rostro en el centro', 'loading');
    } catch (err) {
      showCameraStatus('No se pudo acceder a la cámara', 'error');
    }
  }

  function closeCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    regVideo.srcObject = null;
    cameraSection.style.display = 'none';
  }

  function capturePhoto() {
    const ctx = regCanvas.getContext('2d');
    regCanvas.width = regVideo.videoWidth;
    regCanvas.height = regVideo.videoHeight;
    ctx.drawImage(regVideo, 0, 0);

    const dataURL = regCanvas.toDataURL('image/jpeg', 0.8);
    photoInput.value = dataURL;
    previewImg.src = dataURL;
    photoPreview.style.display = 'block';
    closeCamera();
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showCameraStatus('Seleccione una imagen válida', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        const maxSize = 640;
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxSize) { h *= maxSize / w; w = maxSize; }
        } else {
          if (h > maxSize) { w *= maxSize / h; h = maxSize; }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const dataURL = canvas.toDataURL('image/jpeg', 0.8);
        photoInput.value = dataURL;
        previewImg.src = dataURL;
        photoPreview.style.display = 'block';
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  }

  function removePhoto() {
    photoInput.value = '';
    previewImg.src = '';
    photoPreview.style.display = 'none';
  }

  function showCameraStatus(msg, type) {
    if (!cameraStatus) return;
    cameraStatus.textContent = msg;
    cameraStatus.className = 'face-status face-' + type;
  }
});
