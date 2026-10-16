/**
 * Reinicio de contraseña en 2 pasos (apodo/correo -> código + contraseña nueva).
 * Mide el tiempo total del proceso (requisito: menos de 30 segundos).
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const i18n = window.RESET_I18N || {};
  const $ = (id) => document.getElementById(id);
  const status = $('resetStatus');
  let inicio = 0;
  let temporizador = null;

  function estado(texto, tipo) {
    status.textContent = texto || '';
    status.className = texto ? `face-status face-${tipo}` : 'face-status';
  }

  async function enviar(url, datos) {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(datos)
    });
    const cuerpo = await respuesta.json().catch(() => ({}));
    return { ok: respuesta.ok && cuerpo.success, cuerpo };
  }

  /** Cuenta regresiva para poder reenviar el código */
  function esperarReenvio(segundos) {
    const boton = $('btnResend');
    clearInterval(temporizador);
    let restante = segundos;
    boton.disabled = true;
    boton.textContent = `${i18n.resendIn} ${restante} s`;
    temporizador = setInterval(() => {
      restante -= 1;
      if (restante <= 0) {
        clearInterval(temporizador);
        boton.disabled = false;
        boton.textContent = i18n.resend;
      } else {
        boton.textContent = `${i18n.resendIn} ${restante} s`;
      }
    }, 1000);
  }

  async function pedirCodigo() {
    if (!inicio) inicio = performance.now();
    estado(i18n.sending, 'loading');
    $('btnRequest').disabled = true;
    try {
      const { ok, cuerpo } = await enviar('/recuperar/codigo', { identifier: $('identifier').value });
      if (!ok) { estado(cuerpo.message || i18n.serverError, 'error'); return; }
      estado('');
      $('sentMessage').textContent = cuerpo.message;
      $('requestForm').hidden = true;
      $('confirmForm').hidden = false;
      $('stepDot1').classList.remove('active');
      $('stepDot2').classList.add('active');
      $('code').focus();
      esperarReenvio(cuerpo.waitSeconds || 60);
    } catch (err) {
      estado(i18n.serverError, 'error');
    } finally {
      $('btnRequest').disabled = false;
    }
  }

  $('requestForm').addEventListener('submit', (e) => { e.preventDefault(); pedirCodigo(); });
  $('btnResend').addEventListener('click', pedirCodigo);

  // Solo dígitos en el código
  $('code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });

  $('confirmForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = $('btnConfirm');
    boton.disabled = true;
    estado(i18n.sending, 'loading');
    try {
      const { ok, cuerpo } = await enviar('/recuperar/confirmar', {
        identifier: $('identifier').value,
        code: $('code').value,
        new_password: $('new_password').value,
        confirm_password: $('confirm_password').value
      });
      if (!ok) {
        estado(cuerpo.message || i18n.serverError, 'error');
        // Código anulado o vencido: volver al paso 1
        if (cuerpo.error === 'code_blocked' || cuerpo.error === 'code_expired') {
          $('confirmForm').hidden = true;
          $('requestForm').hidden = false;
          $('stepDot2').classList.remove('active');
          $('stepDot1').classList.add('active');
        }
        return;
      }
      const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
      estado(`${i18n.done} ${segundos} ${i18n.seconds}`, 'success');
      setTimeout(() => { window.location.href = cuerpo.redirect || '/login'; }, 1200);
    } catch (err) {
      estado(i18n.serverError, 'error');
    } finally {
      boton.disabled = false;
    }
  });
});
