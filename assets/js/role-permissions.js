(function () {
  var menuItems = [];
  var allPermissions = {};
  var i18n = {};

  try { menuItems = JSON.parse(document.getElementById('menu-items-data').textContent); } catch (e) {}
  try { allPermissions = JSON.parse(document.getElementById('menu-permissions-data').textContent); } catch (e) {}
  try { i18n = JSON.parse(document.getElementById('roles-i18n').textContent); } catch (e) {}

  var modal = document.getElementById('permissionsModal');
  var modalTitle = document.getElementById('permissionsModalTitle');
  var listEl = document.getElementById('permissionsList');
  var statusEl = document.getElementById('permissionsStatus');
  var btnSave = document.getElementById('permissionsSave');
  var btnCancel = document.getElementById('permissionsCancel');
  var btnClose = document.getElementById('permissionsModalClose');

  var currentRoleId = null;
  var currentRoleName = '';

  function openModal(roleId, roleName) {
    currentRoleId = roleId;
    currentRoleName = roleName;
    modalTitle.textContent = (i18n.permissionsFor || 'Permisos de') + ' ' + roleName;
    statusEl.textContent = '';
    statusEl.className = 'modal-status';

    var perms = allPermissions[roleId] || {};
    listEl.innerHTML = '';

    menuItems.forEach(function (item) {
      if (item.key === 'roles') return;

      var active = perms.hasOwnProperty(item.key) ? perms[item.key] : true;
      var label = i18n.menuLabels && i18n.menuLabels[item.key] ? i18n.menuLabels[item.key] : item.key;

      var row = document.createElement('label');
      row.className = 'permission-row';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'permission-checkbox';
      checkbox.value = item.key;
      checkbox.checked = active;

      var text = document.createElement('span');
      text.className = 'permission-label';
      text.textContent = label;

      var icon = document.createElement('span');
      icon.className = 'permission-icon';
      icon.innerHTML = item.icon;

      row.appendChild(checkbox);
      row.appendChild(icon);
      row.appendChild(text);
      listEl.appendChild(row);
    });

    modal.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
    currentRoleId = null;
  }

  function save() {
    if (!currentRoleId) return;

    var checkboxes = listEl.querySelectorAll('.permission-checkbox');
    var activeKeys = [];
    checkboxes.forEach(function (cb) {
      if (cb.checked) activeKeys.push(cb.value);
    });

    btnSave.disabled = true;
    statusEl.textContent = i18n.saving || 'Guardando…';
    statusEl.className = 'modal-status modal-status-info';

    fetch('/roles/' + currentRoleId + '/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeKeys: activeKeys })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        btnSave.disabled = false;
        if (data.success) {
          statusEl.textContent = i18n.saved || 'Guardado';
          statusEl.className = 'modal-status modal-status-success';

          allPermissions[currentRoleId] = {};
          activeKeys.forEach(function (key) { allPermissions[currentRoleId][key] = true; });

          setTimeout(function () { closeModal(); }, 800);
        } else {
          statusEl.textContent = i18n.error || 'Error al guardar';
          statusEl.className = 'modal-status modal-status-error';
        }
      })
      .catch(function () {
        btnSave.disabled = false;
        statusEl.textContent = i18n.error || 'Error al guardar';
        statusEl.className = 'modal-status modal-status-error';
      });
  }

  document.querySelectorAll('.btn-permissions').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openModal(btn.getAttribute('data-role-id'), btn.getAttribute('data-role-name'));
    });
  });

  btnSave.addEventListener('click', save);
  btnCancel.addEventListener('click', closeModal);
  btnClose.addEventListener('click', closeModal);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
})();
