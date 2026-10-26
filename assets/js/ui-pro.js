/**
 * UI PRO: detalles de interfaz que no cambian la lógica de ninguna página.
 *  1. Barra de progreso arriba al cambiar de página o enviar un formulario.
 *  2. Saludo según la hora (Buenos días / tardes / noches) en el Inicio.
 *  3. Números que "cuentan" hasta su valor (Inicio y resultados del análisis).
 *  4. Análisis léxico: zona de arrastrar y soltar, pasos 1-2-3 y botón
 *     "Procesando...". El archivo sigue en el mismo <input name="file">.
 *  8. Botón flotante "Volver arriba" en todas las páginas (con anillo de avance).
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

  /* ---------------------------------------------------------------- 5 */
  // Celular y tablet: el menú lateral se abre como cajón desde el botón ☰
  // (en computadora sigue igual, fijo a la izquierda)
  var lateral = document.getElementById('sidebar');
  var barraSup = document.querySelector('.topbar');
  if (lateral && barraSup) {
    var esIngles = (document.documentElement.lang || '').indexOf('en') === 0;
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ui-hamburguesa';
    boton.setAttribute('aria-controls', 'sidebar');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', esIngles ? 'Open menu' : 'Abrir menú');
    boton.innerHTML = '<span></span><span></span><span></span>';

    var logo = document.createElement('a');
    logo.className = 'ui-topbar-logo';
    logo.href = '/users/dashboard';
    logo.innerHTML = '<img src="/img/logo-umg-128.webp" width="34" height="34" alt="UMG" decoding="async">';

    barraSup.insertBefore(logo, barraSup.firstChild);
    barraSup.insertBefore(boton, barraSup.firstChild);

    var velo = document.createElement('div');
    velo.className = 'ui-velo';
    velo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(velo);

    var abrirMenu = function (abrir) {
      document.body.classList.toggle('ui-menu-abierto', abrir);
      boton.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      boton.setAttribute('aria-label', abrir ? (esIngles ? 'Close menu' : 'Cerrar menú') : (esIngles ? 'Open menu' : 'Abrir menú'));
    };
    boton.addEventListener('click', function () {
      abrirMenu(!document.body.classList.contains('ui-menu-abierto'));
    });
    velo.addEventListener('click', function () { abrirMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') abrirMenu(false);
    });
    // Si se agranda la ventana (p. ej. se gira la tablet), se cierra solo
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) abrirMenu(false);
    });
    window.addEventListener('pageshow', function () { abrirMenu(false); });
  }

  /* ---------------------------------------------------------------- 6 */
  // Tablas de Usuarios y Roles: en celular cada fila se ve como tarjeta;
  // cada celda recibe el título de su columna (data-label) para mostrarlo
  document.querySelectorAll('table.roles-table').forEach(function (tabla) {
    var titulos = Array.prototype.map.call(tabla.querySelectorAll('thead th'), function (th) {
      return th.textContent.trim();
    });
    tabla.querySelectorAll('tbody tr').forEach(function (tr) {
      Array.prototype.forEach.call(tr.children, function (td, i) {
        if (!td.hasAttribute('data-label')) td.setAttribute('data-label', titulos[i] || '');
      });
    });
    tabla.classList.add('ui-apilable');
  });

  /* ---------------------------------------------------------------- 7 */
  // Buscar dentro de las palabras que menos se repiten (análisis léxico)
  document.querySelectorAll('[data-filtro-palabras]').forEach(function (campo) {
    var lista = document.querySelector(campo.getAttribute('data-filtro-palabras'));
    if (!lista) return;
    var sinTildes = function (t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
    var palabras = Array.prototype.map.call(lista.querySelectorAll('li'), function (li) {
      return { li: li, texto: sinTildes(li.textContent) };
    });
    var grupos = lista.querySelectorAll('[data-grupo]');

    // Índice A-Z: salta a la letra DENTRO de la lista (sin mover toda la página)
    var barra = campo.closest('.lex-alfa-barra');
    var indice = barra && barra.querySelector('.lex-indice');
    if (indice) {
      indice.addEventListener('click', function (e) {
        var enlace = e.target.closest('a[href^="#"]');
        if (!enlace) return;
        var destino = document.getElementById(decodeURIComponent(enlace.getAttribute('href').slice(1)));
        if (!destino || !lista.contains(destino)) return;
        e.preventDefault();
        var grupo = destino.closest('[data-grupo]') || destino;
        var arriba = lista.scrollTop + grupo.getBoundingClientRect().top - lista.getBoundingClientRect().top;
        lista.scrollTo({ top: arriba, behavior: reducir ? 'auto' : 'smooth' });
      });
    }
    var vacio = lista.querySelector('.lex-sin-resultados');
    var espera = null;
    campo.addEventListener('input', function () {
      clearTimeout(espera);
      espera = setTimeout(function () {
        var buscado = sinTildes(campo.value.trim());
        palabras.forEach(function (p) { p.li.hidden = buscado !== '' && p.texto.indexOf(buscado) === -1; });
        var alguno = false;
        grupos.forEach(function (g) {
          var visible = !!g.querySelector('li:not([hidden])');
          g.hidden = !visible;
          if (visible) alguno = true;
        });
        if (vacio) vacio.hidden = alguno;
      }, 120);
    });
  });

  /* ---------------------------------------------------------------- 8 */
  // Botón flotante "Volver arriba": aparece al bajar, el anillo muestra cuánto
  // se ha leído de la página y al hacer clic sube suavemente al principio
  (function () {
    var esIngles = (document.documentElement.lang || '').indexOf('en') === 0;
    var texto = esIngles ? 'Back to top' : 'Volver arriba';
    var RADIO = 21;
    var PERIMETRO = 2 * Math.PI * RADIO;

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ui-arriba';
    boton.setAttribute('aria-label', texto);
    boton.title = texto;
    boton.tabIndex = -1; // oculto: no recibe el foco hasta que aparece
    boton.innerHTML =
      '<svg class="ui-arriba-anillo" viewBox="0 0 48 48" aria-hidden="true">' +
        '<circle class="ui-arriba-pista" cx="24" cy="24" r="' + RADIO + '"></circle>' +
        '<circle class="ui-arriba-avance" cx="24" cy="24" r="' + RADIO + '"></circle>' +
      '</svg>' +
      '<svg class="ui-arriba-flecha" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"></path>' +
      '</svg>';
    document.body.appendChild(boton);

    var avance = boton.querySelector('.ui-arriba-avance');
    avance.style.strokeDasharray = PERIMETRO.toFixed(2);
    avance.style.strokeDashoffset = PERIMETRO.toFixed(2);

    var visible = false;
    var pendiente = false;

    // Aparece al bajar media pantalla (o la mitad de lo que se puede bajar en páginas cortas)
    function alturaMinima(total) {
      return Math.min(320, window.innerHeight * 0.5, total * 0.5);
    }

    function actualizar() {
      pendiente = false;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var total = document.documentElement.scrollHeight - window.innerHeight;
      var mostrar = total > 120 && y > alturaMinima(total);
      if (mostrar !== visible) {
        visible = mostrar;
        boton.classList.toggle('visible', mostrar);
        boton.tabIndex = mostrar ? 0 : -1;
        if (!mostrar) boton.classList.remove('subiendo');
      }
      var parte = total > 0 ? Math.min(1, y / total) : 0;
      avance.style.strokeDashoffset = (PERIMETRO * (1 - parte)).toFixed(2);
    }

    function programar() {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(actualizar);
    }

    window.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('resize', programar);
    window.addEventListener('pageshow', programar);

    // Páginas sin menú (login, registro...): el selector de tema flota en la misma
    // esquina; theme.js se carga después, por eso se revisa al terminar de cargar
    function revisarEsquina() {
      boton.classList.toggle('ui-arriba--sobre-tema', !!document.querySelector('.theme-switch-floating'));
      actualizar();
    }
    var revisarLuego = function () { setTimeout(revisarEsquina, 0); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revisarLuego);
    else revisarLuego();
    window.addEventListener('load', revisarEsquina);

    // Subida suave con aceleración natural; se detiene si el usuario vuelve a desplazarse
    var animando = 0;
    function cancelar() {
      if (animando) { window.cancelAnimationFrame(animando); animando = 0; }
    }
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, cancelar, { passive: true });
    });

    function irA(y) {
      try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); }
      catch (e) { window.scrollTo(0, y); }
    }

    function subir() {
      cancelar();
      var inicio = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (reducir || inicio <= 0) { irA(0); return; }
      var duracion = Math.min(900, Math.max(380, inicio / 4));
      var t0 = null;
      var curva = function (t) { return 1 - Math.pow(1 - t, 4); }; // easeOutQuart
      function paso(ahora) {
        if (t0 === null) t0 = ahora;
        var t = Math.min(1, (ahora - t0) / duracion);
        irA(Math.round(inicio * (1 - curva(t))));
        if (t < 1) animando = window.requestAnimationFrame(paso);
        else animando = 0;
      }
      animando = window.requestAnimationFrame(paso);
    }

    boton.addEventListener('click', function () {
      boton.classList.remove('subiendo');
      void boton.offsetWidth; // reinicia la animación de la flecha
      boton.classList.add('subiendo');
      subir();
      // Accesibilidad: el teclado continúa desde el inicio de la página
      var destino = document.querySelector('main, .main-content, h1');
      if (destino) {
        if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
        try { destino.focus({ preventScroll: true }); } catch (e) { /* navegadores antiguos */ }
      }
    });
    boton.addEventListener('animationend', function () { boton.classList.remove('subiendo'); });

    actualizar();
  })();

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
