/**
 * Vista previa del archivo .txt antes de procesarlo (Análisis léxico).
 * - Muestra nombre, tamaño, codificación, líneas, palabras y caracteres.
 * - Muestra las primeras líneas del texto (funciona con árabe, ruso y chino).
 * - Avisa si el archivo no es .txt o pasa de 5 MB (el servidor valida igual).
 * No envía nada: todo se lee en el navegador.
 */
(function () {
  'use strict';

  var MAX_BYTES = 5 * 1024 * 1024;
  var MAX_LINEAS = 40;
  var MAX_CARACTERES = 4000;

  var input = document.getElementById('file');
  var caja = document.getElementById('filePreview');
  if (!input || !caja || !window.FileReader || !window.TextDecoder) return;

  var nombre = document.getElementById('fpName');
  var info = document.getElementById('fpInfo');
  var texto = document.getElementById('fpText');
  var nota = document.getElementById('fpNote');
  var quitar = document.getElementById('fpClear');
  var d = caja.dataset;

  function kb(bytes) {
    return bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB';
  }

  function ocultar() {
    caja.hidden = true;
    caja.classList.remove('file-preview-error');
    texto.textContent = '';
    nota.textContent = '';
  }

  function error(mensaje) {
    caja.hidden = false;
    caja.classList.add('file-preview-error');
    info.textContent = '';
    texto.hidden = true;
    nota.textContent = mensaje;
  }

  /** UTF-8 (con o sin BOM) y, si no es válido, ANSI de Windows (igual que el servidor) */
  function decodificar(buffer) {
    var bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) bytes = bytes.subarray(3);
    try {
      return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), codificacion: 'UTF-8' };
    } catch (e) {
      return { texto: new TextDecoder('windows-1252').decode(bytes), codificacion: 'ANSI (Windows-1252)' };
    }
  }

  input.addEventListener('change', function () {
    var archivo = input.files && input.files[0];
    if (!archivo) return ocultar();

    nombre.textContent = archivo.name;
    if (!/\.txt$/i.test(archivo.name)) return error(d.notTxt);
    if (archivo.size > MAX_BYTES) return error(d.tooBig + ' (' + kb(archivo.size) + ')');
    if (archivo.size === 0) return error(d.empty);

    var lector = new FileReader();
    lector.onerror = function () { error(d.readError); };
    lector.onload = function () {
      var r = decodificar(lector.result);
      var contenido = r.texto.replace(/\r\n?/g, '\n');
      if (!contenido.trim()) return error(d.empty);

      var lineas = contenido.replace(/\n+$/, '').split('\n');
      var palabras = (contenido.match(/\S+/g) || []).length;
      var vista = lineas.slice(0, MAX_LINEAS).join('\n');
      var cortado = lineas.length > MAX_LINEAS || vista.length > MAX_CARACTERES;
      if (vista.length > MAX_CARACTERES) vista = vista.slice(0, MAX_CARACTERES);

      caja.hidden = false;
      caja.classList.remove('file-preview-error');
      info.textContent = kb(archivo.size) + ' · ' + r.codificacion + ' · '
        + lineas.length + ' ' + d.lines + ' · ' + palabras + ' ' + d.words + ' · '
        + contenido.length + ' ' + d.chars;
      texto.hidden = false;
      texto.textContent = vista + (cortado ? '\n…' : '');
      nota.textContent = cortado ? d.partial : '';
    };
    lector.readAsArrayBuffer(archivo);
  });

  if (quitar) {
    quitar.addEventListener('click', function () {
      input.value = '';
      ocultar();
      input.focus();
    });
  }
})();
