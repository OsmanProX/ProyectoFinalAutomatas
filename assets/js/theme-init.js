/**
 * Aplica el tema guardado ANTES de pintar la página, para que no haya destello
 * blanco (flash) al abrir o cambiar de página. Va en el <head> de cada vista,
 * antes de las hojas de estilo. Valores: "light" | "dark" | "system".
 *
 * Además del atributo data-theme (que usan las variables de theme.css), pinta
 * desde el primer instante el fondo y el esquema de color del navegador
 * (color-scheme), así ni el lienzo vacío ni las barras de desplazamiento ni los
 * campos nativos salen blancos en modo oscuro mientras cargan los CSS.
 */
(function () {
  var FONDO = { light: '#f3f6fb', dark: '#0b1222' };
  var raiz = document.documentElement;
  var consultaOscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function leerGuardado() {
    try {
      var guardado = window.localStorage.getItem('tema');
      if (guardado === 'light' || guardado === 'dark' || guardado === 'system') return guardado;
    } catch (e) {
      // Navegación privada o almacenamiento bloqueado: se usa el del sistema
    }
    return 'system';
  }

  function modoReal(tema) {
    if (tema === 'light' || tema === 'dark') return tema;
    return consultaOscuro && consultaOscuro.matches ? 'dark' : 'light';
  }

  /** Aplica un tema; theme.js lo usa al elegir Claro / Oscuro / Sistema */
  function aplicarTema(tema) {
    var modo = modoReal(tema);
    raiz.setAttribute('data-theme', tema);
    raiz.style.colorScheme = modo;
    raiz.style.backgroundColor = FONDO[modo];
    // Aviso para quien necesite redibujarse con el tema nuevo (p. ej. el reCAPTCHA)
    try {
      window.dispatchEvent(new CustomEvent('temacambiado', { detail: { tema: tema, modo: modo } }));
    } catch (e) { /* navegadores muy viejos */ }
  }

  window.aplicarTema = aplicarTema;

  // Letra Inter (Google Fonts) cargada sin bloquear: si no hay internet, la
  // página se muestra igual con la letra del sistema y sin esperar
  var fuente = document.createElement('link');
  fuente.rel = 'stylesheet';
  fuente.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  fuente.media = 'print';
  fuente.onload = function () { fuente.media = 'all'; };
  document.head.appendChild(fuente);
  aplicarTema(leerGuardado());

  // En "Sistema", si el usuario cambia el modo del sistema operativo, se sigue al instante
  if (consultaOscuro) {
    var alCambiar = function () {
      if (raiz.getAttribute('data-theme') === 'system') aplicarTema('system');
    };
    if (consultaOscuro.addEventListener) consultaOscuro.addEventListener('change', alCambiar);
    else if (consultaOscuro.addListener) consultaOscuro.addListener(alCambiar);
  }
})();

/**
 * Cambio de página suave (View Transitions): si el navegador cancela la animación
 * (por ejemplo al recargar, al volver atrás o si la página tarda en mostrarse),
 * la página se abre igual, sin animación. Aquí solo se "atiende" ese aviso para
 * que no aparezca en la consola como error ("Transition was aborted...").
 */
(function () {
  function atender(evento) {
    var vt = evento && evento.viewTransition;
    if (!vt) return;
    ['ready', 'finished', 'updateCallbackDone'].forEach(function (promesa) {
      if (vt[promesa] && typeof vt[promesa].catch === 'function') vt[promesa].catch(function () {});
    });
  }
  window.addEventListener('pagereveal', atender);
  window.addEventListener('pageswap', atender);
})();
