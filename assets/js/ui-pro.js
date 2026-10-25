/**
 * UI PRO: detalles de interfaz que no cambian la lógica de ninguna página.
 *  1. Barra de progreso arriba al cambiar de página o enviar un formulario.
 *  2. Saludo según la hora (Buenos días / tardes / noches) en el Inicio.
 *  3. Números que "cuentan" hasta su valor (Inicio y resultados del análisis).
 *  4. Análisis léxico: zona de arrastrar y soltar, pasos 1-2-3 y botón
 *     "Procesando...". El archivo sigue en el mismo <input name="file">.
 * Todo es opcional: si este archivo no carga, las páginas funcionan igual.
 */
(function () {
  'use strict';

  var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 1 */
  var barra = document.createElement('div');
  barra.className = 'ui-progreso';
  barra.setAttribute('aria-hidden', 'true');
  document.body.appendChild(barra);

  function iniciarBarra() {
    barra.classList.remove('activo');
    void barra.offsetWidth; // reinicia la transición
    barra.classList.add('activo');
  }

  function detenerBarra() {
    barra.classList.remove('activo');
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
    if (a.origin && a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.search === location.search && a.hash) return;
    iniciarBarra();
  });

  // Solo formularios que de verdad navegan (los que usan fetch llaman preventDefault)
  document.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    if (e.target.target === '_blank') return;
    iniciarBarra();
  });

  // Al volver con el botón "atrás" la página puede venir de la caché
  window.addEventListener('pageshow', detenerBarra);

  /* ---------------------------------------------------------------- 2 */
  var saludo = document.querySelector('[data-saludo]');
  if (saludo) {
    var h = new Date().getHours();
    var texto = h < 12 ? saludo.dataset.manana : (h < 19 ? saludo.dataset.tarde : saludo.dataset.noche);
    if (texto) saludo.textContent = texto;
  }

  /* ---------------------------------------------------------------- 3 */
  function contar(el) {
    var original = el.textContent.trim();
    if (!/^\d+$/.test(original)) return;
    var fin = parseInt(original, 10);
    if (reducir || fin === 0) return;
    var inicio = null;
    var duracion = Math.min(1200, 500 + fin * 4);
    el.textContent = '0';
    function paso(t) {
      if (inicio === null) inicio = t;
      var p = Math.min(1, (t - inicio) / duracion);
      var suave = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(fin * suave));
      if (p < 1) requestAnimationFrame(paso);
      else el.textContent = original;
    }
    requestAnimationFrame(paso);
  }

  var numeros = document.querySelectorAll('[data-contar], .lex-stat span');
  if (numeros.length) {
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (en) {
          if (en.isIntersecting) {
            obs.unobserve(en.target);
            contar(en.target);
          }
        });
      }, { threshold: 0.4 });
      numeros.forEach(function (n) { obs.observe(n); });
    } else {
      numeros.forEach(contar);
    }
  }

  /* ---------------------------------------------------------------- 4 */
  var form = document.getElementById('analyzeForm');
  if (!form) return;

  var input = document.getElementById('file');
  var zona = document.querySelector('[data-dropzone]');
  var vista = document.getElementById('filePreview');
  var pasos = document.querySelectorAll('[data-paso]');
  var nombreZona = document.querySelector('[data-dropzone-nombre]');
  var boton = form.querySelector('.ana-enviar');

  function archivoValido() {
    return !!(input && input.files && input.files.length && vista && !vista.hidden && !vista.classList.contains('file-preview-error'));
  }

  function actualizarPasos() {
    var ok = archivoValido();
    if (zona) zona.classList.toggle('con-archivo', !!(input.files && input.files.length));
    if (nombreZona) {
      nombreZona.textContent = input.files && input.files.length ? input.files[0].name : nombreZona.dataset.vacio;
    }
    pasos.forEach(function (li) {
      var n = li.getAttribute('data-paso');
      li.classList.toggle('listo', ok && (n === '1' || n === '2'));
      li.classList.toggle('actual', ok ? n === '3' : n === '1');
    });
  }

  if (zona && input) {
    var cuenta = 0; // dragenter/dragleave se disparan por cada hijo
    zona.addEventListener('dragenter', function () { cuenta++; zona.classList.add('arrastrando'); });
    zona.addEventListener('dragleave', function () { if (--cuenta <= 0) { cuenta = 0; zona.classList.remove('arrastrando'); } });
    zona.addEventListener('drop', function () { cuenta = 0; zona.classList.remove('arrastrando'); });
    input.addEventListener('change', actualizarPasos);
  }

  // La vista previa (analyze-preview.js) decide si el archivo es válido
  if (vista && 'MutationObserver' in window) {
    new MutationObserver(actualizarPasos).observe(vista, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  actualizarPasos();

  // Botón "Procesando..." solo si el envío sigue adelante
  form.addEventListener('submit', function (e) {
    if (e.defaultPrevented || !boton) return;
    setTimeout(function () {
      if (e.defaultPrevented) return;
      boton.classList.add('procesando');
      var t = boton.querySelector('[data-texto]');
      if (t && boton.dataset.procesando) t.textContent = boton.dataset.procesando;
    }, 0);
  });

  window.addEventListener('pageshow', function () {
    if (!boton) return;
    boton.classList.remove('procesando');
    var t = boton.querySelector('[data-texto]');
    if (t && t.dataset.original) t.textContent = t.dataset.original;
  });
})();
