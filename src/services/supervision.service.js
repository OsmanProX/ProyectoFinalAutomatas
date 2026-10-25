// Los repositorios se cargan al usarse (y se pueden reemplazar en las pruebas)
const repositorios = () => ({
  whatsappLog: require('../repositories/whatsapp-log.repository'),
  loginAudit: require('../repositories/login-audit.repository')
});
const METODOS_ES = Object.freeze({
  password: 'Usuario y contraseña', rostro: 'Reconocimiento facial', qr: 'Código QR', api: 'API (JWT)'
});

/**
 * Resumen para el Inicio del SUPERVISOR ("Dashboard de entregas").
 * Solo LEE tablas que ya existen:
 *   - whatsapp_log: reportes, credenciales y códigos enviados por WhatsApp y su estado de entrega
 *   - login_audit:  accesos de los últimos 7 días (exitosos / fallidos y por método)
 * Si una consulta falla, esa parte queda vacía y el Inicio se muestra igual.
 */

const DIAS = 7;
const ESTADO_GRUPO = Object.freeze({
  entregado: 'entregados', leido: 'entregados', reproducido: 'entregados',
  aceptado: 'enCamino', enviado: 'enCamino', pendiente: 'enCamino',
  error: 'fallidos', fallido: 'fallidos'
});
const TIPO_TEXTO = Object.freeze({
  reporte: { es: 'Reporte PDF', en: 'PDF report' },
  credencial: { es: 'Credencial', en: 'ID card' },
  credencial_nueva: { es: 'Credencial nueva', en: 'New ID card' },
  codigo_recuperacion: { es: 'Código de recuperación', en: 'Recovery code' },
  aviso_recuperacion: { es: 'Aviso de contraseña', en: 'Password notice' }
});
const ESTADO_TEXTO = Object.freeze({
  entregados: { es: 'Entregado', en: 'Delivered' },
  enCamino: { es: 'En camino', en: 'On the way' },
  fallidos: { es: 'No se entregó', en: 'Not delivered' }
});

const fechaCorta = (d, lang) => d.toLocaleString(lang === 'en' ? 'en-US' : 'es-GT', {
  timeZone: 'America/Guatemala', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
});

async function resumenEntregas(lang, whatsappLogRepository) {
  const vacio = { total: 0, entregados: 0, enCamino: 0, fallidos: 0, porTipo: [], ultimos: [], pctEntregados: 0 };
  let lista;
  try {
    lista = await whatsappLogRepository.find({ limite: 200 });
  } catch (err) {
    console.warn('[Supervisión] No se pudo leer whatsapp_log:', err.message);
    return vacio;
  }
  const desde = Date.now() - DIAS * 24 * 3600 * 1000;
  const recientes = lista.filter((w) => w.createdAt && w.createdAt.getTime() >= desde);
  const r = { ...vacio, total: recientes.length };
  const tipos = {};
  recientes.forEach((w) => {
    const grupo = ESTADO_GRUPO[w.estado] || 'enCamino';
    r[grupo] += 1;
    tipos[w.tipo] = (tipos[w.tipo] || 0) + 1;
  });
  r.pctEntregados = r.total ? Math.round((r.entregados * 100) / r.total) : 0;
  r.porTipo = Object.entries(tipos)
    .map(([tipo, cantidad]) => ({ tipo, texto: (TIPO_TEXTO[tipo] || {})[lang] || tipo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
  r.ultimos = lista.slice(0, 6).map((w) => {
    const grupo = ESTADO_GRUPO[w.estado] || 'enCamino';
    return {
      tipo: (TIPO_TEXTO[w.tipo] || {})[lang] || w.tipo,
      destino: w.destino || '—', // el teléfono ya se guarda enmascarado
      grupo,
      estado: ESTADO_TEXTO[grupo][lang],
      fecha: fechaCorta(w.createdAt, lang)
    };
  });
  return r;
}

async function resumenAccesos(lang, loginAuditRepository) {
  const vacio = { total: 0, exitosos: 0, fallidos: 0, porMetodo: [], pctExitosos: 0 };
  let lista;
  try {
    lista = await loginAuditRepository.find({ desde: new Date(Date.now() - DIAS * 24 * 3600 * 1000), limite: 1000 });
  } catch (err) {
    console.warn('[Supervisión] No se pudo leer login_audit:', err.message);
    return vacio;
  }
  const accesos = lista.filter((a) => a.method !== 'logout');
  const r = { ...vacio, total: accesos.length };
  const metodos = {};
  accesos.forEach((a) => {
    if (a.success) r.exitosos += 1; else r.fallidos += 1;
    metodos[a.method] = (metodos[a.method] || 0) + 1;
  });
  r.pctExitosos = r.total ? Math.round((r.exitosos * 100) / r.total) : 0;
  const textoEn = { password: 'Password', rostro: 'Face', qr: 'QR code', api: 'API (JWT)' };
  r.porMetodo = Object.entries(metodos)
    .map(([metodo, cantidad]) => ({
      metodo,
      texto: lang === 'en' ? (textoEn[metodo] || metodo) : (METODOS_ES[metodo] || metodo),
      cantidad,
      pct: Math.round((cantidad * 100) / (r.total || 1))
    }))
    .sort((a, b) => b.cantidad - a.cantidad);
  return r;
}

/**
 * @param {string} lang 'es' | 'en'
 * @param {{whatsappLog?: object, loginAudit?: object}} [repos] para las pruebas
 * @returns {Promise<{dias:number, entregas:object, accesos:object}>}
 */
async function resumen(lang = 'es', repos) {
  const r = repos || repositorios();
  const [entregas, accesos] = await Promise.all([
    resumenEntregas(lang, r.whatsappLog),
    resumenAccesos(lang, r.loginAudit)
  ]);
  return { dias: DIAS, entregas, accesos };
}

module.exports = { resumen };
