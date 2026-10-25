/**
 * reCAPTCHA de Google en login y registro (lee la configuración del <div data-recaptcha>).
 *
 * v2 ("No soy un robot"): la casilla se dibuja con el tema del sitio (claro u
 *     oscuro) y se vuelve a dibujar si el usuario cambia el tema antes de marcarla.
 * v3 (invisible): no hay casilla. Al enviar el formulario se pide a Google un
 *     token para la acción ("login" o "registro") y se envía en el campo
 *     "g-recaptcha-response"; el servidor revisa el puntaje y la acción.
 */
(function () {
  'use strict';

  var caja = document.querySelector('[data-recaptcha]');
  if (!caja) return;

  var clave = caja.getAttribute('data-sitekey');
  var version = caja.getAttribute('data-version') === '3' ? 3 : 2;
  var accion = caja.getAttribute('data-action') || 'login';
  var idioma = caja.getAttribute('data-lang') || 'es';
  var widget = null;

  function modo() {
    return document.documentElement.style.colorScheme === 'dark' ? 'dark' : 'light';
  }

  function cargarScript(parametros) {
    var s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?' + parametros + '&hl=' + encodeURIComponent(idioma);
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- v2
  function dibujarCasilla() {
    if (!window.grecaptcha || !window.grecaptcha.render) return;
    // Si ya la marcó, no se toca (se perdería la respuesta)
    if (widget !== null && window.grecaptcha.getResponse(widget)) return;
    caja.innerHTML = '';
    var contenedor = document.createElement('div');
    caja.appendChild(contenedor);
    widget = window.grecaptcha.render(contenedor, { sitekey: clave, theme: modo() });
  }

  if (version === 2) {
    window.alCargarRecaptcha = dibujarCasilla;
    cargarScript('render=explicit&onload=alCargarRecaptcha');
    window.addEventListener('temacambiado', dibujarCasilla);
    return;
  }

  // ---------------------------------------------------------------- v3
  var formulario = caja.closest('form');
  if (!formulario) return;
  cargarScript('render=' + encodeURIComponent(clave));

  var campo = document.createElement('input');
  campo.type = 'hidden';
  campo.name = 'g-recaptcha-response';
  formulario.appendChild(campo);

  var enviando = false;
  function enviar() {
    enviando = true;
    formulario.submit(); // no vuelve a disparar "submit"
  }

  formulario.addEventListener('submit', function (e) {
    // Si otra validación de la página ya detuvo el envío, no se hace nada
    if (enviando || e.defaultPrevented) return;
    e.preventDefault();
    if (!window.grecaptcha || !window.grecaptcha.ready) return enviar(); // el servidor responderá con el aviso
    window.grecaptcha.ready(function () {
      window.grecaptcha.execute(clave, { action: accion })
        .then(function (token) { campo.value = token; enviar(); })
        .catch(function () { enviar(); });
    });
  });
})();
