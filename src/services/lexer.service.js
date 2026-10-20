// src/services/lexer.service.js

// Listas de pronombres comunes según idioma
const PRONOUNS = {
  es: ['yo', 'tú', 'tu', 'él', 'el', 'ella', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'usted', 'ustedes', 'me', 'te', 'se', 'nos', 'os', 'mi', 'mí'],
  en: ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'their']
};

/**
 * Función principal para analizar el texto cargado (.txt)
 * @param {string} text - Contenido del archivo
 * @param {string} lang - Idioma seleccionado (es, en, ru, zh, ar)
 */
function analyzeText(text, lang = 'es') {
  if (!text || text.trim().length === 0) {
    return {
      totalWords: 0,
      mostRepeated: [],
      leastRepeated: [],
      pronouns: [],
      properNouns: []
    };
  }

  // 1. Limpieza y tokenización
  const cleanText = text.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, ' ');
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);

  // a. Cantidad total de palabras
  const totalWords = words.length;

  // 2. Conteo de frecuencia
  const freqMap = {};
  words.forEach(word => {
    const wordLower = word.toLowerCase();
    freqMap[wordLower] = (freqMap[wordLower] || 0) + 1;
  });

  const sortedEntries = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);

  // b. Palabras que más se repiten
  const maxFreq = sortedEntries.length > 0 ? sortedEntries[0][1] : 0;
  const mostRepeated = sortedEntries
    .filter(([_, count]) => count === maxFreq)
    .map(([word, count]) => ({ word, count }));

  // c. Palabras que menos se repiten
  const minFreq = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1][1] : 0;
  const leastRepeated = sortedEntries
    .filter(([_, count]) => count === minFreq)
    .map(([word, count]) => ({ word, count }));

  // 3. Pronombres personales
  const langPronouns = PRONOUNS[lang] || PRONOUNS['es'];
  const pronounsFound = new Set();

  words.forEach((word) => {
    const lowerWord = word.toLowerCase();
    if (langPronouns.includes(lowerWord)) {
      pronounsFound.add(lowerWord);
    }
  });

  // 4. Nombres Propios / Personas (Omitiendo la primera palabra de cada oración)
  const properNounsFound = new Set();
  const sentences = text.split(/[.!?]+/);

  sentences.forEach(sentence => {
    // Limpiamos la oración y la dividimos en palabras manteniendo sus mayúsculas
    const sentenceWords = sentence
      .replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);

    // Evaluamos solo de la segunda palabra en adelante para ignorar el inicio de oración
    sentenceWords.slice(1).forEach(word => {
      if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(word)) {
        properNounsFound.add(word);
      }
    });
  });

  return {
    totalWords,
    mostRepeated,
    leastRepeated,
    pronouns: Array.from(pronounsFound),
    properNouns: Array.from(properNounsFound)
  };
}

module.exports = {
  analyzeText
};