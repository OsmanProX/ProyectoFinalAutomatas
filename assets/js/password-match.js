/**
 * Aviso en vivo: "Las contraseñas coinciden / no coinciden"
 * (Gestión de Perfil y Reiniciar contraseña; el registro usa register-extras.js).
 * Uso en la vista:
 *   <small class="form-hint password-match" data-password-match
 *          data-for="new_password" data-confirm="confirm_password"
 *          data-hint="..." data-ok="..." data-error="..."></small>
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  document.querySelectorAll('[data-password-match]').forEach(function (aviso) {
    const clave = document.getElementById(aviso.dataset.for);
    const confirmar = document.getElementById(aviso.dataset.confirm);
    if (!clave || !confirmar) return;

    function revisar() {
      if (!confirmar.value) {
        aviso.textContent = aviso.dataset.hint || '';
        aviso.className = 'form-hint password-match';
        confirmar.setCustomValidity('');
        return;
      }
      const iguales = clave.value === confirmar.value;
      aviso.textContent = iguales ? aviso.dataset.ok : aviso.dataset.error;
      aviso.className = 'form-hint password-match ' + (iguales ? 'password-match-ok' : 'password-match-error');
      confirmar.setCustomValidity(iguales ? '' : (aviso.dataset.error || ''));
    }

    clave.addEventListener('input', revisar);
    confirmar.addEventListener('input', revisar);
    // Si el formulario se limpia después de guardar, el aviso vuelve al texto inicial
    if (confirmar.form) confirmar.form.addEventListener('reset', function () { setTimeout(revisar, 0); });
    revisar();
  });
});
