/**
 * Aplica el tema guardado ANTES de pintar la página (evita el "parpadeo" blanco).
 * Va en el <head> de cada vista. Valores: "light" | "dark" | "system".
 * "system" (o nada guardado) deja que el CSS siga al sistema operativo.
 */
(function () {
  var tema = 'system';
  try {
    var guardado = window.localStorage.getItem('tema');
    if (guardado === 'light' || guardado === 'dark' || guardado === 'system') tema = guardado;
  } catch (e) {
    // Navegación privada o almacenamiento bloqueado: se usa el del sistema
  }
  document.documentElement.setAttribute('data-theme', tema);
})();
