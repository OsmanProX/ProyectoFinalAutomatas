/**
 * Selector de tema: Claro / Oscuro / Sistema.
 * - En inicio de sesión, registro y recuperar contraseña va junto al botón de idioma.
 * - En las páginas con menú va en la parte de abajo de la barra lateral.
 * - Si la página no tiene ninguno de los dos, flota abajo a la derecha.
 * La elección se guarda en el navegador (localStorage "tema").
 */
(function () {
  'use strict';

  var en = (document.documentElement.lang || 'es').toLowerCase().indexOf('en') === 0;
  var TEXTOS = en
    ? { grupo: 'Theme', light: 'Light', dark: 'Dark', system: 'System' }
    : { grupo: 'Tema', light: 'Claro', dark: 'Oscuro', system: 'Sistema' };

  var ICONOS = {
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>'
  };
  var OPCIONES = ['light', 'dark', 'system'];

  function temaActual() {
    var t = document.documentElement.getAttribute('data-theme');
    return OPCIONES.indexOf(t) >= 0 ? t : 'system';
  }

  function aplicar(tema, grupo) {
    if (typeof window.aplicarTema === 'function') window.aplicarTema(tema); // theme-init.js
    else document.documentElement.setAttribute('data-theme', tema);
    try { window.localStorage.setItem('tema', tema); } catch (e) { /* sin almacenamiento */ }
    grupo.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-tema') === tema));
    });
  }

  function crearSelector(conTexto) {
    var grupo = document.createElement('div');
    grupo.className = 'theme-switch';
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', TEXTOS.grupo);
    OPCIONES.forEach(function (tema) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-tema', tema);
      b.setAttribute('title', TEXTOS[tema]);
      b.setAttribute('aria-label', TEXTOS[tema]);
      b.setAttribute('aria-pressed', String(temaActual() === tema));
      b.innerHTML = ICONOS[tema] + (conTexto ? '<span class="theme-label">' + TEXTOS[tema] + '</span>' : '');
      b.addEventListener('click', function () { aplicar(tema, grupo); });
      grupo.appendChild(b);
    });
    return grupo;
  }

  function montar() {
    if (document.querySelector('.theme-switch')) return;
    var idioma = document.querySelector('.lang-switcher');
    var pieMenu = document.querySelector('.sidebar-footer');
    if (idioma) {
      idioma.insertBefore(crearSelector(false), idioma.firstChild);
    } else if (pieMenu) {
      pieMenu.insertBefore(crearSelector(true), pieMenu.firstChild);
    } else {
      var flotante = crearSelector(false);
      flotante.classList.add('theme-switch-floating');
      document.body.appendChild(flotante);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
