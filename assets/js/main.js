document.addEventListener('DOMContentLoaded', function () {
  const langBtn = document.querySelector('.btn-lang');
  if (langBtn) {
    langBtn.addEventListener('click', function (e) {
      e.preventDefault();
      const url = this.getAttribute('href');
      window.location.href = url;
    });
  }
});
