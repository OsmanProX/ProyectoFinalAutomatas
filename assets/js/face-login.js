document.addEventListener('DOMContentLoaded', function () {
  const i18n = window.FACE_I18N || {};
  const btnFace = document.getElementById('btnFaceLogin');
  const faceSection = document.getElementById('faceSection');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const faceStatus = document.getElementById('faceStatus');
  const nicknameInput = document.getElementById('nickname');
  const btnVerify = document.getElementById('btnVerify');
  const btnCloseCamera = document.getElementById('btnCloseCamera');

  let stream = null;
  let modelsLoaded = false;

  btnFace.addEventListener('click', openCamera);
  if (btnVerify) btnVerify.addEventListener('click', verifyFace);
  if (btnCloseCamera) btnCloseCamera.addEventListener('click', closeCamera);

  function getNickname() {
    return nicknameInput ? nicknameInput.value.trim() : '';
  }

  async function openCamera() {
    const nickname = getNickname();
    if (!nickname) {
      showStatus(i18n.promptNickname, 'error');
      return;
    }

    faceSection.style.display = 'block';
    btnFace.style.display = 'none';

    try {
      if (!modelsLoaded) {
        showStatus(i18n.loadingModels, 'loading');
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

      showStatus(i18n.readyHint, 'loading');
    } catch (err) {
      console.error('Error:', err);
      showStatus(i18n.cameraError, 'error');
      closeCamera();
    }
  }

  async function verifyFace() {
    const nickname = getNickname();
    if (!nickname) {
      showStatus(i18n.promptNickname, 'error');
      return;
    }

    showStatus(i18n.detecting, 'loading');

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        showStatus(i18n.noFace, 'error');
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      showStatus(i18n.verifying, 'loading');

      const response = await fetch('/login/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, descriptor })
      });

      const data = await response.json();

      if (data.success) {
        showStatus(i18n.verified + ' ' + data.similarity + '%', 'success');
        setTimeout(() => {
          window.location.href = data.redirect || '/users/dashboard';
        }, 1500);
      } else {
        let msg = i18n.noMatch;
        if (data.error === 'user_not_found') msg = i18n.userNotFound;
        else if (data.error === 'no_photo_registered') msg = i18n.noPhoto;
        else if (data.error === 'account_disabled') msg = i18n.accountDisabled;
        else if (data.error === 'account_pending') msg = i18n.accountPending;
        else if (data.similarity) msg += '. ' + data.similarity + '%';
        showStatus(msg, 'error');
      }
    } catch (err) {
      console.error('Error:', err);
      showStatus(i18n.connectionError, 'error');
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
