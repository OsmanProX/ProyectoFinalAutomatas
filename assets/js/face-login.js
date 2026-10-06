document.addEventListener('DOMContentLoaded', function () {
  const i18n = window.FACE_I18N || {};
  const btnFace = document.getElementById('btnFaceLogin');
  const faceModal = document.getElementById('faceModal');
  const faceModalClose = document.getElementById('btnCloseModal');
  const faceSection = document.getElementById('faceSection');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const faceStatus = document.getElementById('faceStatus');
  const nicknameInput = document.getElementById('nickname');
  const btnVerify = document.getElementById('btnVerify');
  const btnCloseCamera = document.getElementById('btnCloseCamera');

  let stream = null;
  let modalOpen = false;

  btnFace.addEventListener('click', openCamera);
  if (btnVerify) btnVerify.addEventListener('click', verifyFace);
  if (btnCloseCamera) btnCloseCamera.addEventListener('click', closeCamera);
  if (faceModalClose) faceModalClose.addEventListener('click', closeCamera);

  if (faceModal) {
    faceModal.addEventListener('click', function (e) {
      if (e.target === faceModal) closeCamera();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (modalOpen && e.key === 'Escape') closeCamera();
  });

  function getNickname() {
    return nicknameInput ? nicknameInput.value.trim() : '';
  }

  function setControlsDisabled(disabled) {
    if (btnVerify) btnVerify.disabled = disabled;
    if (btnCloseCamera) btnCloseCamera.disabled = disabled;
    if (faceModalClose) faceModalClose.disabled = disabled;
  }

  function openModal() {
    if (!faceModal) return;
    faceModal.style.display = 'flex';
    faceModal.setAttribute('aria-hidden', 'false');
    modalOpen = true;
  }

  async function openCamera() {
    const nickname = getNickname();
    if (!nickname) {
      showStatus(i18n.promptNickname, 'error');
      return;
    }

    openModal();

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      video.srcObject = stream;
      await video.play();

      showStatus(i18n.readyHint, 'loading');
    } catch (err) {
      console.error('Error:', err);
      showStatus(i18n.cameraError, 'error');
      closeCamera();
    }
  }

  function captureFrame() {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  async function verifyFace() {
    const nickname = getNickname();
    if (!nickname) {
      showStatus(i18n.promptNickname, 'error');
      return;
    }

    if (!video.videoWidth) {
      showStatus(i18n.cameraError, 'error');
      return;
    }

    showStatus(i18n.detecting, 'loading');
    setControlsDisabled(true);

    try {
      const image = captureFrame();

      showStatus(i18n.verifying, 'loading');

      const response = await fetch('/login/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, image })
      });

      const data = await response.json();

      if (data.success) {
        const simText = data.similarity ? ' ' + data.similarity + '%' : '';
        showStatus(i18n.verified + simText, 'success');
        setTimeout(() => {
          window.location.href = data.redirect || '/users/dashboard';
        }, 1500);
      } else {
        let msg = i18n.noMatch;
        if (data.error === 'user_not_found') msg = i18n.userNotFound;
        else if (data.error === 'no_photo_registered') msg = i18n.noPhoto;
        else if (data.error === 'account_disabled') msg = i18n.accountDisabled;
        else if (data.error === 'account_pending') msg = i18n.accountPending;
        else if (data.error === 'invalid_image') msg = i18n.invalidImage || msg;
        else if (data.error === 'segmentation_failed') msg = i18n.segmentationFailed || msg;
        else if (data.error === 'server_error') msg = i18n.connectionError;
        if (data.similarity) msg += '. ' + data.similarity + '%';
        showStatus(msg, 'error');
        setControlsDisabled(false);
      }
    } catch (err) {
      console.error('Error:', err);
      showStatus(i18n.connectionError, 'error');
      setControlsDisabled(false);
    }
  }

  function closeCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
    if (faceModal) {
      faceModal.style.display = 'none';
      faceModal.setAttribute('aria-hidden', 'true');
    }
    modalOpen = false;
    setControlsDisabled(false);
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (faceStatus) {
      faceStatus.textContent = '';
      faceStatus.className = 'face-status';
    }
  }

  function showStatus(msg, type) {
    if (!faceStatus) return;
    faceStatus.textContent = msg;
    faceStatus.className = 'face-status face-' + type;
  }
});