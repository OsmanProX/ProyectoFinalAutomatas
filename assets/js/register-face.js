document.addEventListener('DOMContentLoaded', function () {
  const togglePassword = document.getElementById('togglePassword');
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm_password');

  if (togglePassword) {
    togglePassword.addEventListener('click', function () {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      this.innerHTML = type === 'password' ? '&#128065;' : '&#128064;';
    });
  }

  if (toggleConfirmPassword) {
    toggleConfirmPassword.addEventListener('click', function () {
      const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
      confirmPasswordInput.type = type;
      this.innerHTML = type === 'password' ? '&#128065;' : '&#128064;';
    });
  }

  const btnCamera = document.getElementById('btnCamera');
  const btnUpload = document.getElementById('btnUpload');
  const fileInput = document.getElementById('fileInput');
  const cameraSection = document.getElementById('cameraSection');
  const regVideo = document.getElementById('regVideo');
  const regCanvas = document.getElementById('regCanvas');
  const btnCapture = document.getElementById('btnCapture');
  const btnCancelCamera = document.getElementById('btnCancelCamera');
  const cropperSection = document.getElementById('cropperSection');
  const cropperImage = document.getElementById('cropperImage');
  const btnCrop = document.getElementById('btnCrop');
  const btnCancelCrop = document.getElementById('btnCancelCrop');
  const photoPreview = document.getElementById('photoPreview');
  const previewImg = document.getElementById('previewImg');
  const btnRemovePhoto = document.getElementById('btnRemovePhoto');
  const photoInput = document.getElementById('photo');
  const registerForm = document.getElementById('registerForm');
  const photoPlaceholder = document.getElementById('photoPlaceholder');

  let stream = null;
  let cropper = null;

  function hidePlaceholder() {
    if (photoPlaceholder) photoPlaceholder.style.display = 'none';
  }

  function showPlaceholder() {
    if (photoPlaceholder) photoPlaceholder.style.display = 'block';
  }

  btnCamera.addEventListener('click', openCamera);
  btnUpload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileUpload);
  btnCapture.addEventListener('click', capturePhoto);
  btnCancelCamera.addEventListener('click', closeCamera);
  btnCrop.addEventListener('click', cropImage);
  btnCancelCrop.addEventListener('click', cancelCrop);
  btnRemovePhoto.addEventListener('click', removePhoto);

  registerForm.addEventListener('submit', function (e) {
    if (!photoInput.value) {
      e.preventDefault();
      alert('Debe tomar o subir una foto');
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
      cropperSection.style.display = 'none';
      hidePlaceholder();
    } catch (err) {
      alert('No se pudo acceder a la cámara');
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
    closeCamera();
    openCropper(regCanvas.toDataURL('image/jpeg'));
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Seleccione una imagen válida');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (event) {
      openCropper(event.target.result);
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  }

  function openCropper(imageSrc) {
    cropperImage.src = imageSrc;
    cropperSection.style.display = 'block';
    photoPreview.style.display = 'none';
    hidePlaceholder();

    if (cropper) cropper.destroy();

    cropper = new Cropper(cropperImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.8,
      responsive: true,
      guides: true,
      center: true,
      highlight: true,
      cropBoxMovable: true,
      cropBoxResizable: true
    });
  }

  function cropImage() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
    const dataURL = canvas.toDataURL('image/jpeg', 0.85);
    photoInput.value = dataURL;
    previewImg.src = dataURL;
    photoPreview.style.display = 'block';
    cropperSection.style.display = 'none';
    hidePlaceholder();
    cropper.destroy();
    cropper = null;
  }

  function cancelCrop() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    cropperSection.style.display = 'none';
    showPlaceholder();
  }

  function removePhoto() {
    photoInput.value = '';
    previewImg.src = '';
    photoPreview.style.display = 'none';
    showPlaceholder();
  }
});
