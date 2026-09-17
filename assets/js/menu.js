document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', function () {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
  }

  const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (wasCollapsed && sidebar) {
    sidebar.classList.add('collapsed');
  }
});
