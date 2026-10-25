(function () {
  var i18n = {};
  try { i18n = JSON.parse(document.getElementById('users-i18n').textContent); } catch (e) {}

  document.querySelectorAll('.btn-save-role').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('tr');
      var userId = btn.getAttribute('data-user-id');
      var select = row.querySelector('[data-role-select]');
      var stateSelect = row.querySelector('[data-state-select]');
      var status = row.querySelector('[data-row-status]');
      var idRole = select.value;
      var payload = { idRole: Number(idRole) };
      if (stateSelect) payload.state = Number(stateSelect.value); // 1 = activo, 0 = inactivo

      btn.disabled = true;
      status.textContent = i18n.saving || 'Guardando…';
      status.className = 'row-status row-status-info';

      fetch('/users/' + userId + '/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          btn.disabled = false;
          if (result.ok && result.data.success) {
            status.textContent = i18n.saved || 'Rol actualizado';
            status.className = 'row-status row-status-success';
          } else if (result.data && result.data.error === 'self_change') {
            status.textContent = i18n.errorSelf || 'No puedes quitarte el rol ADMIN ni desactivar tu propia cuenta';
            status.className = 'row-status row-status-error';
          } else {
            status.textContent = i18n.error || 'No se pudo actualizar el rol';
            status.className = 'row-status row-status-error';
          }
        })
        .catch(function () {
          btn.disabled = false;
          status.textContent = i18n.error || 'No se pudo actualizar el rol';
          status.className = 'row-status row-status-error';
        });
    });
  });
})();
