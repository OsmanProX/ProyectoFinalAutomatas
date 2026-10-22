/**
 * Lectura segura de archivos .txt subidos por el usuario.
 * - Quita el BOM de UTF-8.
 * - Si el archivo no es UTF-8 válido (por ejemplo, guardado como "ANSI" en el
 *   Bloc de notas de Windows), se lee como Windows-1252 para no perder tildes ni ñ.
 */
const MAX_TEXT_BYTES = 5 * 1024 * 1024; // 5 MB, igual que el límite de multer

/** @param {Buffer} buffer @returns {string} */
function decodeTextFile(buffer) {
  if (!buffer || !buffer.length) return '';
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch (err) {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Nombre de archivo apto para mostrar (sin rutas ni caracteres de control) */
function safeFileName(name) {
  return String(name || 'archivo.txt')
    .split(/[\\/]/).pop()
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .slice(0, 120) || 'archivo.txt';
}

module.exports = { decodeTextFile, safeFileName, MAX_TEXT_BYTES };
