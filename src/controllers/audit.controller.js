const loginAuditRepository = require('../repositories/login-audit.repository');
const { METODOS, DETALLES, describeAgent } = require('../services/login-audit.service');
const { getTranslation } = require('../utils/i18n');

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Inicio del día en Guatemala (UTC-6, sin horario de verano) */
const inicioDiaGt = (texto) => new Date(`${texto}T00:00:00-06:00`);

/** Lee y valida los filtros del formulario (GET) */
function leerFiltros(query) {
  const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const filtros = {
    nickname: texto(query.usuario, 100),
    method: Object.prototype.hasOwnProperty.call(METODOS, query.metodo) ? query.metodo : '',
    resultado: ['ok', 'fallido'].includes(query.resultado) ? query.resultado : '',
    desde: RE_FECHA.test(query.desde || '') ? query.desde : '',
    hasta: RE_FECHA.test(query.hasta || '') ? query.hasta : ''
  };
  const consulta = {
    nickname: filtros.nickname || undefined,
    method: filtros.method || undefined,
    success: filtros.resultado ? filtros.resultado === 'ok' : undefined,
    desde: filtros.desde ? inicioDiaGt(filtros.desde) : undefined,
    // "hasta" incluye todo ese día
    hasta: filtros.hasta ? new Date(inicioDiaGt(filtros.hasta).getTime() + 24 * 3600 * 1000) : undefined,
    limite: 200
  };
  return { filtros, consulta };
}

class AuditController {
  /** GET /users/bitacora (solo ADMIN) */
  async getPage(req, res) {
    const lang = req.session.lang || 'es';
    const t = getTranslation(lang);
    const { filtros, consulta } = leerFiltros(req.query || {});
    try {
      const registros = (await loginAuditRepository.find(consulta)).map((r) => ({
        ...r,
        fecha: r.createdAt.toLocaleString('es-GT', { timeZone: 'America/Guatemala', hour12: false }),
        metodoTexto: METODOS[r.method] || r.method,
        detalleTexto: DETALLES[r.detail] || r.detail || '',
        navegador: describeAgent(r.userAgent)
      }));
      res.render('bitacora', { t, lang, registros, filtros, metodos: METODOS, error: null });
    } catch (err) {
      console.error('Error al leer la bitácora:', err.message);
      res.render('bitacora', { t, lang, registros: [], filtros, metodos: METODOS, error: 'No se pudo cargar la bitácora. Intenta de nuevo.' });
    }
  }
}

module.exports = new AuditController();
module.exports.leerFiltros = leerFiltros;
