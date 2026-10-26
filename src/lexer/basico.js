/**
 * ============================================================================
 * ANALIZADOR LÉXICO BÁSICO: CHINO (zh) Y ÁRABE (ar)
 * ============================================================================
 * Estos idiomas no tienen mayúsculas (no sirve detectar nombres por la letra
 * inicial) y el chino no separa las palabras con espacios. Por eso usan un
 * análisis más sencillo que el de español, inglés y ruso (analizador.js):
 *
 *   1. Escaneo:      el mismo AFD (automata.js) divide el texto en lexemas y
 *                    detecta el fin de cada oración (。！？ ؟ incluidos).
 *   2. Patrones:     correos, URL, fechas, números... (patrones.js).
 *   3. Palabras:     chino -> Intl.Segmenter (diccionario ICU del motor JS).
 *                    árabe -> se quitan diacríticos (tashkeel) y el tatweel.
 *   4. Categorías:   pronombres, verbos, sustantivos y nombres por listas
 *                    cerradas y por el contexto (palabra anterior/siguiente).
 *   5. Raíz:         chino sin flexión (la misma palabra, sin el plural 们);
 *                    árabe con el algoritmo Snowball "arabic".
 *
 * Es un análisis basado en reglas: rápido y explicable, pero aproximado.
 * ============================================================================
 */
const snowball = require('./vendor/snowball-stemmers');
const { escanear, ESTADOS, TIPOS_TOKEN } = require('./automata');
const { CATEGORIAS, clasificarLexema } = require('./patrones');

const LIMITE_LISTAS = 50;
const TOP_FRECUENCIAS = 10;
const conjunto = (texto) => new Set(texto.trim().split(/\s+/));

const CAT = Object.freeze({
  PERSONA: 'PERSONA',
  PROPIO: 'PROPIO',
  PRONOMBRE: 'PRONOMBRE',
  FUNCIONAL: 'FUNCIONAL',
  ADVERBIO: 'ADVERBIO',
  VERBO: 'VERBO',
  SUSTANTIVO: 'SUSTANTIVO'
});

const PATRONES_REPORTADOS = [
  CATEGORIAS.CORREO, CATEGORIAS.URL, CATEGORIAS.FECHA, CATEGORIAS.HORA, CATEGORIAS.TELEFONO,
  CATEGORIAS.MONEDA, CATEGORIAS.PORCENTAJE, CATEGORIAS.NUMERO, CATEGORIAS.HASHTAG,
  CATEGORIAS.MENCION, CATEGORIAS.ROMANO, CATEGORIAS.SIGLA, CATEGORIAS.DOMINIO, CATEGORIAS.PALABRA_SIGNOS, CATEGORIAS.CODIGO
];

// ============================================================================
// Reglas del CHINO
// ============================================================================
const ZH = {
  codigo: 'zh',
  nombre: 'Chino',
  pronombres: conjunto('我 你 您 他 她 它 我们 你们 他们 她们 它们 咱们 自己 大家'),
  funcionales: conjunto(`
    的 了 着 过 地 得 和 与 及 或 或者 但 但是 而 而且 也 都 就 还 又 才 很 太 最 更 不 没 没有
    吗 呢 吧 啊 呀 把 被 对 从 向 往 给 在 于 以 为 因为 所以 如果 虽然 这 那 这个 那个 这些 那些
    一 个 些 每 各 之 其 并 等 已 将 会 能 要 可以 应该 是 一个 一些 一种 一位 一本`),
  /** Después de estas palabras suele venir un verbo */
  contextoVerbal: conjunto('会 能 要 想 可以 应该 不 没 没有 正在 已经 将 刚 就 也 还 又 才 喜欢 开始 继续 打算 准备 希望 一起 常常 经常 都'),
  /** Marcas de aspecto: la palabra ANTERIOR es un verbo (吃了, 看着, 去过) */
  aspecto: conjunto('了 着 过'),
  verbos: conjunto(`
    是 有 去 来 说 做 看 听 吃 喝 写 读 学 学习 工作 喜欢 爱 想 知道 认为 觉得 开始 结束 帮助
    使用 研究 分析 发现 介绍 参加 讨论 解释 回答 问 买 卖 走 跑 坐 住 到 回 用 叫 让 教 打 玩
    睡 开 关 找 等 带 送 穿 得到 成为 发展 提高 完成 准备 希望 需要 告诉 认识 理解 记得 忘记
    出生 毕业 访问 旅行 讲 唱 跳 识别 处理 计算 设计 学会 来到 回家 上课 下课 发生 改变 建立
    认真 努力 读书 写作 生活 合作 参观 欢迎 感谢 相信 选择 决定 支持 表示 进行 提供 包括`),
  /** Después de estas palabras (determinantes y clasificadores) viene un sustantivo */
  antesDeSustantivo: conjunto('一个 一些 一种 一位 一本 的 这 那 这个 那个 这些 那些 每 一些 各 些 个 位 本 只 条 张 件 家 所 种 台 辆 杯 名 部 篇 首 门 座 块 双'),
  /** Terminaciones típicas de sustantivos (学生, 国家, 机器, 理论...) */
  sufijosSustantivo: new Set([...'人者家员师生学国市省县机器法论性化业界品物们馆院校室厅场站店车书课题文语']),
  titulos: conjunto('先生 女士 小姐 老师 教授 博士 同学 医生 经理 主任 校长 总统 夫人'),
  /** Apellidos frecuentes que casi nunca son palabras sueltas */
  apellidos: new Set([...'王李张刘陈杨赵吴周徐孙朱胡郭何罗郑梁谢宋唐许韩冯邓曹彭曾肖董袁潘蒋蔡杜魏吕丁沈姚卢姜崔钟谭陆汪廖贾韦邹孟熊秦邱尹薛闫段侯陶黎贺顾郝龚邵钱严覃戴孔汤']),
  lugares: conjunto(`
    中国 美国 英国 法国 德国 日本 韩国 俄罗斯 西班牙 墨西哥 危地马拉 加拿大 巴西 意大利 印度
    北京 上海 广州 深圳 香港 澳门 台湾 南京 西安 成都 武汉 天津 杭州 重庆 欧洲 亚洲 非洲 美洲
    长城 故宫 联合国 长江 黄河`),
  instituciones: conjunto('大学 公司 银行 医院 学院 中学 小学 政府 博物馆 图书馆 研究所'),
  adverbios: conjunto(`
    非常 已经 常常 经常 一起 马上 立刻 突然 终于 刚才 正在 一直 总是 也许 可能 特别 十分 相当
    比较 完全 互相 今天 明天 昨天 现在 以后 以前 然后`)
};

// ============================================================================
// Reglas del ÁRABE (formas normalizadas: sin diacríticos y con ا en lugar de أ إ آ)
// ============================================================================
const AR = {
  codigo: 'ar',
  nombre: 'Árabe',
  pronombres: conjunto('انا انت انتم انتما انتن هو هي هما هم هن نحن'),
  funcionales: conjunto(`
    في من الى على عن مع هذا هذه ذلك تلك هؤلاء التي الذي الذين ان او ثم قد لقد كل بعض عند حتى
    بين بعد قبل لكن لا لم لن ما ماذا متى اين كيف لماذا هل نعم بل اذا لو سوف كما مثل غير دون
    حول خلال ضد عبر منذ يا و ف ب ل ك`),
  /** Después de estas palabras suele venir un verbo (قد كتب، لم يذهب، سوف ندرس، هو يدرس) */
  contextoVerbal: conjunto('قد لقد لم لن سوف ان لا كان كانت هو هي نحن انا هم انت'),
  verbos: conjunto(`
    كان كانت كانوا يكون تكون قال قالت قالوا يقول ذهب ذهبت ذهبوا جاء جاءت كتب كتبت قرا قرات درس
    درست عمل عملت راى رات اكل شرب اصبح صار ليس ليست وصل وصلت شرح شرحت تعلم تعلمت فهم فهمت`),
  preposiciones: conjunto('في من الى على عن مع عند بين بعد قبل حول خلال منذ'),
  determinantes: conjunto('هذا هذه ذلك تلك هؤلاء كل بعض'),
  titulos: conjunto('السيد السيدة الدكتور الدكتورة الاستاذ الاستاذة الشيخ المهندس المهندسة الرئيس الملك الامير'),
  nombresComunes: conjunto(`
    محمد احمد علي حسن حسين عمر خالد يوسف ابراهيم مصطفى محمود عبدالله سعيد سارة فاطمة عائشة مريم
    زينب ليلى نور هدى خديجة امينة سلمى ياسمين رنا كريم طارق سامي ماجد وليد فيصل سلمان ناصر عادل
    جمال كمال رشيد بشير منى هند`),
  conectoresNombre: conjunto('بن ابن بنت ابو ام عبد'),
  lugares: conjunto(`
    مصر السعودية الاردن المغرب لبنان سوريا العراق فلسطين القاهرة دبي الرياض عمان بيروت دمشق بغداد
    الجزائر تونس قطر الكويت الامارات اليمن ليبيا السودان مكة جدة الاسكندرية امريكا اوروبا اسبانيا
    فرنسا المانيا الصين روسيا غواتيمالا المكسيك`),
  instituciones: conjunto('جامعة شركة بنك مستشفى وزارة مدرسة كلية'),
  adverbios: conjunto('جدا ايضا دائما احيانا غدا امس الان هنا هناك سريعا ببطء كثيرا قليلا معا فقط ابدا تقريبا حقا فعلا'),
  /** Masdar tipo تفعيل (تعليم، تطوير): empieza con ت pero es sustantivo */
  patronMasdar: /^ت\p{L}{2}ي\p{L}$/u,
  /** Verbo en presente: prefijo ي/ت/ن + 3 o 4 letras (+ ون/ين/ان/وا) */
  patronPresente: /^[يتن]\p{L}{3,4}(ون|ين|ان|وا)?$/u
};

const IDIOMAS_BASICOS = Object.freeze({ zh: ZH, ar: AR });

// ============================================================================
// Normalización y segmentación
// ============================================================================
const RE_DIACRITICOS_AR = /[ً-ٰٟـ]/g;

/** Quita tashkeel y tatweel (lo que se muestra al usuario) */
const limpiarArabe = (texto) => texto.replace(RE_DIACRITICOS_AR, '');
/** Clave de comparación: además unifica las formas de alef (أ إ آ -> ا) */
const claveArabe = (texto) => limpiarArabe(texto).replace(/[أإآ]/g, 'ا');

/** Quita una conjunción pegada (و / ف) para consultar las listas: وهو -> هو */
function sinConjuncion(clave, listas) {
  if (clave.length > 2 && /^[وف]/.test(clave) && listas.some((l) => l.has(clave.slice(1)))) return clave.slice(1);
  return clave;
}

const segmentadores = {};
function segmentarPalabras(texto, codigo) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return [texto];
  if (!segmentadores[codigo]) segmentadores[codigo] = new Intl.Segmenter(codigo, { granularity: 'word' });
  return [...segmentadores[codigo].segment(texto)]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);
}

/** "会议在2026-03-15的08:30开始" -> 会议 | 在 | 2026-03-15 | 的 | 08:30 | 开始 */
function dividirChino(texto, codigo) {
  return texto.split(/(\p{Script=Han}+)/u)
    .filter(Boolean)
    .flatMap((tramo) => (/\p{Script=Han}/u.test(tramo) ? segmentarPalabras(tramo, codigo) : [tramo]));
}

const cacheStemmers = {};
function stem(nombre, palabra) {
  if (!cacheStemmers[nombre]) cacheStemmers[nombre] = snowball.newStemmer(nombre);
  return cacheStemmers[nombre].stem(palabra);
}

// ============================================================================
// Análisis
// ============================================================================
/**
 * @param {string} texto
 * @param {'zh'|'ar'} codigoIdioma
 */
function analizarTextoBasico(texto, codigoIdioma) {
  const idioma = IDIOMAS_BASICOS[codigoIdioma];
  if (!idioma) throw new Error('IDIOMA_NO_SOPORTADO');
  if (typeof texto !== 'string') throw new Error('TEXTO_INVALIDO');

  const inicio = Date.now();
  const esArabe = idioma.codigo === 'ar';
  const { tokens, transiciones } = escanear(texto);

  const conteoCategorias = {};
  const patrones = {};
  PATRONES_REPORTADOS.forEach((c) => { patrones[c] = new Map(); });

  // ---------------------------------------------------------------- Fases 1 a 3
  const flujo = []; // palabras en orden; null = corte de contexto
  let totalLexemas = 0;
  let totalOraciones = 0;
  let sumaLongitudes = 0;

  const cortar = () => { if (flujo[flujo.length - 1] !== null) flujo.push(null); };
  const agregarPalabra = (textoPalabra, inicioOracion) => {
    const visible = esArabe ? limpiarArabe(textoPalabra) : textoPalabra;
    if (!visible) return;
    flujo.push({ texto: visible, clave: esArabe ? claveArabe(visible) : visible, inicioOracion, cat: null, raiz: null });
    sumaLongitudes += [...visible].length;
  };

  for (const token of tokens) {
    if (token.tipo !== TIPOS_TOKEN.LEXEMA) { cortar(); continue; }
    totalLexemas++;
    if (token.inicioOracion) totalOraciones++;

    const valor = esArabe ? limpiarArabe(token.valor) : token.valor;
    const categoria = clasificarLexema(valor);

    // Patrones claros (correo, URL, fecha, número...): no se segmentan
    if (categoria !== CATEGORIAS.PALABRA && categoria !== CATEGORIAS.CODIGO && categoria !== CATEGORIAS.OTRO) {
      conteoCategorias[categoria] = (conteoCategorias[categoria] || 0) + 1;
      if (patrones[categoria]) incrementar(patrones[categoria], valor);
      cortar();
      continue;
    }

    // Chino: una "oración" sin espacios se separa en tramos de caracteres chinos y
    // tramos latinos/números (2026-03-15, 08:30, 95%); los chinos se dividen en
    // palabras con el diccionario ICU
    const partes = esArabe ? [valor] : dividirChino(valor, idioma.codigo);
    partes.forEach((parte, idx) => {
      const cat = clasificarLexema(parte);
      conteoCategorias[cat] = (conteoCategorias[cat] || 0) + 1;
      if (cat === CATEGORIAS.PALABRA) {
        agregarPalabra(parte, idx === 0 && token.inicioOracion);
      } else {
        if (patrones[cat]) incrementar(patrones[cat], parte);
        cortar();
      }
    });
  }

  // ---------------------------------------------------------------- Fase 4
  if (esArabe) clasificarArabe(flujo, idioma);
  else clasificarChino(flujo, idioma);

  // ---------------------------------------------------------------- Fase 5 y estadísticas
  const frecuencias = new Map();
  const frecuenciasContenido = new Map();
  const pronombres = new Map();
  const personas = new Map();
  const propios = new Map();
  const adverbios = new Map();
  const sustantivos = new Map();
  const verbos = new Map();
  const visibles = new Map(); // clave normalizada -> forma que se muestra (أحمد y no احمد)
  let totalPalabras = 0;

  for (const w of flujo) {
    if (!w) continue;
    totalPalabras++;
    incrementar(frecuencias, w.clave);
    if (!visibles.has(w.clave)) visibles.set(w.clave, w.texto);
    const base = w.base || w.clave; // sin conjunción pegada: ونحن -> نحن
    if (!visibles.has(base)) visibles.set(base, w.base && w.base !== w.clave ? w.texto.slice(1) : w.texto);

    switch (w.cat) {
      case CAT.PERSONA: if (w.nombreCompleto) incrementar(personas, w.nombreCompleto); break;
      case CAT.PROPIO: if (w.nombreCompleto) incrementar(propios, w.nombreCompleto); break;
      case CAT.PRONOMBRE: incrementar(pronombres, base); break;
      case CAT.ADVERBIO: incrementar(adverbios, base); break;
      case CAT.VERBO: agruparPorRaiz(verbos, raiz(w, idioma, true), w.texto); break;
      case CAT.SUSTANTIVO: agruparPorRaiz(sustantivos, raiz(w, idioma, false), w.texto); break;
      default: break;
    }
    if (w.cat !== CAT.FUNCIONAL && w.cat !== CAT.PRONOMBRE) incrementar(frecuenciasContenido, w.clave);
  }

  const ordenar = (mapa) => [...mapa.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], idioma.codigo));
  const mostrar = (valor) => visibles.get(valor) || valor;
  const aLista = (mapa, clave = 'palabra', limite = LIMITE_LISTAS) => ordenar(mapa)
    .slice(0, limite)
    .map(([valor, frecuencia]) => ({ [clave]: mostrar(valor), frecuencia }));
  const listaRaices = (mapa) => [...mapa.values()]
    .sort((a, b) => b.frecuencia - a.frecuencia || a.raiz.localeCompare(b.raiz, idioma.codigo))
    .slice(0, LIMITE_LISTAS)
    .map((g) => ({ raiz: g.raiz, formas: [...g.formas].slice(0, 8), frecuencia: g.frecuencia }));

  const ordenContenido = ordenar(frecuenciasContenido);
  const frecuenciaMinima = ordenContenido.length ? ordenContenido[ordenContenido.length - 1][1] : 0;
  const menos = ordenContenido.filter(([, f]) => f === frecuenciaMinima).map(([p]) => mostrar(p))
    .sort((a, b) => a.localeCompare(b, idioma.codigo));

  const otrosPatrones = {};
  PATRONES_REPORTADOS.forEach((c) => { otrosPatrones[c] = aLista(patrones[c], 'valor'); });

  return {
    idioma: { codigo: idioma.codigo, nombre: idioma.nombre },
    modo: 'basico',
    resumen: {
      totalPalabras,
      palabrasUnicas: frecuencias.size,
      totalOraciones,
      totalLexemas,
      totalCaracteres: texto.length,
      promedioLetrasPorPalabra: totalPalabras ? Number((sumaLongitudes / totalPalabras).toFixed(2)) : 0,
      tiempoMs: Date.now() - inicio
    },
    masRepetidas: aLista(frecuenciasContenido, 'palabra', TOP_FRECUENCIAS),
    masRepetidasIncluyendoFuncionales: aLista(frecuencias, 'palabra', TOP_FRECUENCIAS),
    // Todas, en orden alfabético (antes solo las primeras 40)
    menosRepetidas: { frecuencia: frecuenciaMinima, total: menos.length, palabras: menos.slice(0, 100000) },
    pronombresPersonales: aLista(pronombres),
    nombresPersonas: aLista(personas, 'nombre'),
    otrosNombresPropios: aLista(propios, 'nombre'),
    sustantivos: listaRaices(sustantivos),
    verbos: listaRaices(verbos),
    adverbios: aLista(adverbios),
    otrosPatrones,
    automata: { estados: Object.values(ESTADOS), transiciones, tokensPorCategoria: conteoCategorias }
  };
}

/** Raíz: chino sin flexión (solo quita el plural 们); árabe con Snowball */
function raiz(w, idioma, esVerbo) {
  if (idioma.codigo === 'zh') return w.clave.length > 2 && w.clave.endsWith('们') ? w.clave.slice(0, -1) : w.clave;
  // و / ف pegadas a un sustantivo con artículo: والتكلفة -> التكلفة
  let r = stem('arabic', w.clave.replace(/^[وف](?=(ال|بال|كال|لل))/, ''));
  // Presente يكتب / تكتب / نكتب -> raíz de 3 letras كتب
  if (esVerbo && /^[يتن]\p{L}{3}$/u.test(r)) r = r.slice(1);
  return r;
}

// ============================================================================
// Fase 4: CHINO
// ============================================================================
function clasificarChino(flujo, idioma) {
  const libre = (w) => w && !w.cat;
  const marcarNombre = (desde, hasta, cat) => {
    const partes = flujo.slice(desde, hasta + 1);
    partes.forEach((p) => { p.cat = cat; });
    partes[0].nombreCompleto = partes.map((p) => p.texto).join('');
  };

  // a) Personas: nombre antes de un título (王小明先生) o apellido + nombre de pila (李华说)
  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!w) continue;
    if (idioma.titulos.has(w.clave)) {
      w.cat = CAT.FUNCIONAL;
      const prev = flujo[i - 1];
      const prev2 = flujo[i - 2];
      if (libre(prev) && !idioma.pronombres.has(prev.clave) && !idioma.funcionales.has(prev.clave)) {
        if (prev2 && libre(prev2) && prev2.clave.length === 1 && idioma.apellidos.has(prev2.clave) && prev.clave.length <= 2) {
          marcarNombre(i - 2, i - 1, CAT.PERSONA);
        } else if ([...prev.clave].length <= 3) {
          marcarNombre(i - 1, i - 1, CAT.PERSONA);
        }
      }
      continue;
    }
    const sig = flujo[i + 1];
    const prev = flujo[i - 1];
    const antesEsCantidad = prev && (prev.clave === '一' || idioma.antesDeSustantivo.has(prev.clave));
    if (libre(w) && w.clave.length === 1 && idioma.apellidos.has(w.clave) && !antesEsCantidad
      && libre(sig) && sig.clave.length <= 2 && !idioma.funcionales.has(sig.clave)
      && !idioma.pronombres.has(sig.clave) && !idioma.verbos.has(sig.clave) && !idioma.titulos.has(sig.clave)) {
      marcarNombre(i, i + 1, CAT.PERSONA);
      i++;
    }
  }

  // b) Otros nombres propios: lugares e instituciones (北京 + 大学 -> 北京大学)
  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!libre(w)) continue;
    const terminaEnInstitucion = [...idioma.instituciones].some((s) => w.clave.length > s.length && w.clave.endsWith(s));
    if (idioma.lugares.has(w.clave) || terminaEnInstitucion) {
      const sig = flujo[i + 1];
      if (libre(sig) && idioma.instituciones.has(sig.clave)) { marcarNombre(i, i + 1, CAT.PROPIO); i++; } else marcarNombre(i, i, CAT.PROPIO);
    }
  }

  // c) Pronombres, adverbios y palabras funcionales
  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!libre(w)) continue;
    const sig = flujo[i + 1];
    if (idioma.pronombres.has(w.clave)) w.cat = CAT.PRONOMBRE;
    else if (idioma.adverbios.has(w.clave) || (sig && sig.clave === '地' && w.clave.length >= 2)) w.cat = CAT.ADVERBIO;
    else if (idioma.funcionales.has(w.clave)) w.cat = CAT.FUNCIONAL;
  }

  // d) Verbos y sustantivos por lista, contexto y terminación
  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!libre(w)) continue;
    const prev = flujo[i - 1];
    const sig = flujo[i + 1];

    if (idioma.verbos.has(w.clave)) w.cat = CAT.VERBO;
    else if (sig && idioma.aspecto.has(sig.clave)) w.cat = CAT.VERBO;
    else if (prev && idioma.contextoVerbal.has(prev.clave) && w.clave.length <= 2) w.cat = CAT.VERBO;
    else if (prev && idioma.antesDeSustantivo.has(prev.clave)) w.cat = CAT.SUSTANTIVO;
    else if (w.clave.length >= 2 && idioma.sufijosSustantivo.has(w.clave[w.clave.length - 1])) w.cat = CAT.SUSTANTIVO;
    else if (prev && prev.cat === CAT.VERBO && w.clave.length >= 2) w.cat = CAT.SUSTANTIVO; // objeto: 学习计算机
  }
}

// ============================================================================
// Fase 4: ÁRABE
// ============================================================================
function clasificarArabe(flujo, idioma) {
  const libre = (w) => w && !w.cat;
  const listasCerradas = [idioma.pronombres, idioma.funcionales, idioma.titulos, idioma.nombresComunes, idioma.verbos, idioma.lugares];
  flujo.forEach((w) => { if (w) w.base = sinConjuncion(w.clave, listasCerradas); });

  const puedeSerNombre = (w) => w && libre(w) && !idioma.funcionales.has(w.base) && !idioma.pronombres.has(w.base)
    && !idioma.titulos.has(w.base) && !w.base.startsWith('ال');

  const marcarNombre = (indices, cat) => {
    const partes = indices.map((k) => flujo[k]);
    partes.forEach((p) => { p.cat = cat; });
    partes[0].nombreCompleto = partes.map((p) => p.texto).join(' ');
  };

  /** Extiende un nombre: محمد بن علي / عبد الله / احمد حسن */
  const extenderNombre = (desde) => {
    const indices = [desde];
    let j = desde + 1;
    while (j < flujo.length && indices.length < 4) {
      const w = flujo[j];
      if (!w) break;
      if (idioma.conectoresNombre.has(w.base) && flujo[j + 1] && libre(flujo[j + 1])) { indices.push(j, j + 1); j += 2; continue; }
      if (idioma.nombresComunes.has(w.base) && libre(w)) { indices.push(j); j++; continue; }
      break;
    }
    return indices;
  };

  // a) Personas: título + nombre (الدكتور احمد) o nombre común (محمد علي)
  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!w || !libre(w)) continue;
    if (idioma.titulos.has(w.base)) {
      w.cat = CAT.FUNCIONAL;
      if (puedeSerNombre(flujo[i + 1])) {
        const indices = extenderNombre(i + 1);
        marcarNombre(indices, CAT.PERSONA);
        i = indices[indices.length - 1];
      }
      continue;
    }
    if (idioma.nombresComunes.has(w.base)) {
      const indices = extenderNombre(i);
      marcarNombre(indices, CAT.PERSONA);
      i = indices[indices.length - 1];
    }
  }

  // b) Otros nombres propios: países/ciudades e instituciones (جامعة القاهرة)
  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!libre(w)) continue;
    const sinPrep = w.base.replace(/^[بلك](?=ال)/, '');
    if (idioma.instituciones.has(w.base) && libre(flujo[i + 1])) { marcarNombre([i, i + 1], CAT.PROPIO); i++; continue; }
    if (idioma.lugares.has(w.base) || idioma.lugares.has(sinPrep)) marcarNombre([i], CAT.PROPIO);
  }

  // c) Pronombres, adverbios, funcionales, verbos y sustantivos
  for (let i = 0; i < flujo.length; i++) {
    const w = flujo[i];
    if (!libre(w)) continue;
    const prev = flujo[i - 1];
    const b = w.base;
    const sinFuturo = b.length > 4 && b.startsWith('س') ? b.slice(1) : b; // سيذهب -> يذهب
    const conArticulo = /^[وف]?(ال|بال|كال|لل)/.test(b);

    if (idioma.pronombres.has(b)) w.cat = CAT.PRONOMBRE;
    else if (idioma.adverbios.has(b)) w.cat = CAT.ADVERBIO;
    else if (idioma.funcionales.has(b)) w.cat = CAT.FUNCIONAL;
    else if (idioma.verbos.has(b)) w.cat = CAT.VERBO;
    else if (conArticulo) w.cat = CAT.SUSTANTIVO;
    else if (prev && (idioma.preposiciones.has(prev.base) || idioma.determinantes.has(prev.base))) w.cat = CAT.SUSTANTIVO;
    else if (idioma.patronMasdar.test(b) || /(ة|ات)$/.test(b)) w.cat = CAT.SUSTANTIVO;
    else if (idioma.patronPresente.test(sinFuturo)) w.cat = CAT.VERBO;
    else if (prev && idioma.contextoVerbal.has(prev.base)) w.cat = CAT.VERBO;
  }
}

// ============================================================================
// Utilidades
// ============================================================================
function incrementar(mapa, clave) {
  mapa.set(clave, (mapa.get(clave) || 0) + 1);
}

function agruparPorRaiz(mapa, clave, forma) {
  if (!mapa.has(clave)) mapa.set(clave, { raiz: clave, formas: new Set(), frecuencia: 0 });
  const grupo = mapa.get(clave);
  grupo.formas.add(forma);
  grupo.frecuencia++;
}

module.exports = { analizarTextoBasico, IDIOMAS_BASICOS };
