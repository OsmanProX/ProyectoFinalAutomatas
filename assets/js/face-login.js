document.addEventListener('DOMContentLoaded', function () {
  const i18n = window.FACE_I18N || {};
  const btnFace = document.getElementById('btnFaceLogin');
  const faceModal = document.getElementById('faceModal');
  const faceModalClose = document.getElementById('btnCloseModal');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const faceStatus = document.getElementById('faceStatus');
  const faceStatusText = document.getElementById('faceStatusText');
  const faceStatusIcon = document.getElementById('faceStatusIcon');
  const nicknameInput = document.getElementById('faceNickname');
  const btnVerify = document.getElementById('btnVerify');
  const btnCapture = document.getElementById('btnCapture');
  const btnCloseCamera = document.getElementById('btnCloseCamera');
  const captureLabel = document.getElementById('captureLabel');
  const liveFrame = document.getElementById('liveFrame');
  const capturedPreview = document.getElementById('capturedPreview');
  const capturedImg = document.getElementById('capturedImg');
  const segmentedPreview = document.getElementById('segmentedPreview');
  const segmentedImg = document.getElementById('segmentedImg');
  const faceLoader = document.getElementById('faceLoader');
  const loaderText = document.getElementById('loaderText');

  let stream = null;
  let modalOpen = false;
  let capturedImage = null;
  let verifying = false;

  btnFace.addEventListener('click', openCamera);
  if (btnVerify) btnVerify.addEventListener('click', verifyFace);
  if (btnCapture) btnCapture.addEventListener('click', captureSnapshot);
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

  function openModal() {
    if (!faceModal) return;
    faceModal.style.display = 'flex';
    faceModal.setAttribute('aria-hidden', 'false');
    modalOpen = true;
  }

  function hideAllPreviews() {
    if (liveFrame) liveFrame.style.display = '';
    if (capturedPreview) capturedPreview.classList.add('face-preview-hidden');
    if (segmentedPreview) segmentedPreview.classList.add('face-preview-hidden');
    if (faceLoader) faceLoader.style.display = 'none';
    capturedImage = null;
  }

  function showStatus(kind, text) {
    if (!faceStatus) return;
    faceStatus.style.display = 'flex';
    faceStatus.className = 'face-status face-status-' + kind;
    faceStatusText.textContent = text;
    faceStatusIcon.innerHTML = iconFor(kind);
  }

  function hideStatus() {
    if (!faceStatus) return;
    faceStatus.style.display = 'none';
    faceStatusText.textContent = '';
  }

  function iconFor(kind) {
    if (kind === 'success') {
      return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    }
    if (kind === 'error') {
      return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  async function openCamera() {
    openModal();
    hideAllPreviews();
    hideStatus();
    if (captureLabel) captureLabel.textContent = i18n.face_capture;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      video.srcObject = stream;
      await video.play();
      enableControls(false);
      showStatus('info', i18n.readyHint);
    } catch (err) {
      console.error('Error:', err);
      showStatus('error', i18n.cameraError);
      enableControls(false);
    }
  }

  function captureSnapshot() {
    const nickname = getNickname();
    if (!nickname) {
      showStatus('error', i18n.promptNickname);
      return;
    }
    if (!stream || !video.videoWidth) {
      showStatus('error', i18n.cameraError);
      return;
    }
    if (verifying) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    capturedImage = dataUrl;

    if (capturedImg) capturedImg.src = dataUrl;
    if (capturedPreview) capturedPreview.classList.remove('face-preview-hidden');

    if (btnVerify) btnVerify.disabled = false;
    if (captureLabel) captureLabel.textContent = i18n.face_retake;

    showStatus('info', i18n.face_ready_to_verify);
  }

  async function verifyFace() {
    const nickname = getNickname();
    if (!nickname) {
      showStatus('error', i18n.promptNickname);
      return;
    }
    if (!capturedImage) {
      showStatus('error', i18n.face_no_capture);
      return;
    }
    if (verifying) return;

    verifying = true;
    enableControls(false);

    if (capturedPreview) capturedPreview.classList.add('face-preview-hidden');
    if (segmentedPreview) segmentedPreview.classList.add('face-preview-hidden');
    if (faceLoader) {
      faceLoader.style.display = 'flex';
      loaderText.textContent = i18n.face_segmenting;
    }
    hideStatus();

    try {
      const response = await fetch('/login/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, image: capturedImage })
      });

      const data = await response.json();

      if (faceLoader) faceLoader.style.display = 'none';

      if (data.segmentedImage && segmentedImg) {
        segmentedImg.src = data.segmentedImage.startsWith('data:')
          ? data.segmentedImage
          : 'data:image/jpeg;base64,' + data.segmentedImage;
        if (segmentedPreview) segmentedPreview.classList.remove('face-preview-hidden');
      } else if (segmentedPreview) {
        segmentedPreview.classList.add('face-preview-hidden');
      }

      if (data.success) {
        const simText = data.similarity ? ' (' + data.similarity + '%)' : '';
        showStatus('success', i18n.verified + simText);
        setTimeout(() => {
          window.location.href = data.redirect || '/users/dashboard';
        }, 1800);
      } else {
        const message = mapError(data.error, data.similarity);
        showStatus('error', message);
        verifying = false;
        enableControls(true);
        if (capturedPreview) capturedPreview.classList.remove('face-preview-hidden');
        if (btnVerify) btnVerify.disabled = true;
        if (captureLabel) captureLabel.textContent = i18n.face_retake;
      }
    } catch (err) {
      console.error('Error:', err);
      if (faceLoader) faceLoader.style.display = 'none';
      showStatus('error', i18n.connectionError);
      verifying = false;
      enableControls(true);
      if (capturedPreview) capturedPreview.classList.remove('face-preview-hidden');
      if (btnVerify) btnVerify.disabled = true;
      if (captureLabel) captureLabel.textContent = i18n.face_retake;
    }
  }

  function mapError(code, similarity) {
    let msg;
    switch (code) {
      case 'user_not_found': msg = i18n.userNotFound; break;
      case 'no_photo_registered': msg = i18n.noPhoto; break;
      case 'account_disabled': msg = i18n.accountDisabled; break;
      case 'account_pending': msg = i18n.accountPending; break;
      case 'invalid_image':
      case 'invalid_image_format': msg = i18n.invalidImage; break;
      case 'segmentation_failed': msg = i18n.segmentationFailed; break;
      case 'server_error': msg = i18n.connectionError; break;
      default: msg = i18n.noMatch;
    }
    if (similarity && code !== 'segmentation_failed') msg += ' (' + similarity + '%)';
    return msg;
  }

  function enableControls(canCapture) {
    if (btnCapture) btnCapture.disabled = false;
    if (btnCloseCamera) btnCloseCamera.disabled = false;
    if (faceModalClose) faceModalClose.disabled = false;
    if (btnVerify) {
      if (canCapture) btnVerify.disabled = !capturedImage;
      else btnVerify.disabled = true;
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
    verifying = false;
    hideAllPreviews();
    hideStatus();
    capturedImage = null;
    if (captureLabel) captureLabel.textContent = i18n.face_capture;
    if (btnVerify) btnVerify.disabled = true;
  }
});