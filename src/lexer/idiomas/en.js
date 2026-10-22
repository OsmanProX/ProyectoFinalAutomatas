/**
 * Reglas léxicas del INGLÉS
 */
const conjunto = (texto) => new Set(texto.trim().split(/\s+/));

const determinantes = conjunto(`
  the a an this that these those my your his its our their some any each every no another such
  much many few several both either neither whose which what`);

const preposiciones = conjunto(`
  of in on at by for with about from into onto over under between through after before without
  during against among around across behind beyond near since toward towards upon within along`);

const otrasFuncionales = conjunto(`
  to and or but nor so yet if because as while than though although unless whether
  not very also just only too there here then now when where why how who whom
  all more most less least same other own again ever never always often still already even
  can could will would shall should may might must
  do does did done doing yes oh up down out off away back`);

const pronombres = conjunto(`
  i you he she it we they me him her us them
  myself yourself himself herself itself ourselves yourselves themselves`);

const contextoVerbal = conjunto(`
  i you he she it we they to not can could will would shall should may might must do does did never`);

const auxiliares = conjunto(`am is are was were be been being has have had having`);

const verbosIrregulares = {};
const agregarVerbo = (base, formas) => {
  verbosIrregulares[base] = base;
  formas.trim().split(/\s+/).forEach((f) => { verbosIrregulares[f] = base; });
};
agregarVerbo('be', 'am is are was were been being');
agregarVerbo('have', 'has had having');
agregarVerbo('go', 'goes went gone going');
agregarVerbo('say', 'says said saying');
agregarVerbo('make', 'makes made making');
agregarVerbo('take', 'takes took taken taking');
agregarVerbo('come', 'comes came coming');
agregarVerbo('see', 'sees saw seen seeing');
agregarVerbo('know', 'knows knew known knowing');
agregarVerbo('get', 'gets got gotten getting');
agregarVerbo('give', 'gives gave given giving');
agregarVerbo('find', 'finds found finding');
agregarVerbo('think', 'thinks thought thinking');
agregarVerbo('tell', 'tells told telling');
agregarVerbo('become', 'becomes became becoming');
agregarVerbo('leave', 'leaves left leaving');
agregarVerbo('feel', 'feels felt feeling');
agregarVerbo('bring', 'brings brought bringing');
agregarVerbo('begin', 'begins began begun beginning');
agregarVerbo('keep', 'keeps kept keeping');
agregarVerbo('hold', 'holds held holding');
agregarVerbo('write', 'writes wrote written writing');
agregarVerbo('stand', 'stands stood standing');
agregarVerbo('hear', 'hears heard hearing');
agregarVerbo('mean', 'means meant meaning');
agregarVerbo('meet', 'meets met meeting');
agregarVerbo('run', 'runs ran running');
agregarVerbo('pay', 'pays paid paying');
agregarVerbo('sit', 'sits sat sitting');
agregarVerbo('speak', 'speaks spoke spoken speaking');
agregarVerbo('lead', 'leads led leading');
agregarVerbo('grow', 'grows grew grown growing');
agregarVerbo('lose', 'loses lost losing');
agregarVerbo('fall', 'falls fell fallen falling');
agregarVerbo('send', 'sends sent sending');
agregarVerbo('build', 'builds built');
agregarVerbo('understand', 'understands understood understanding');
agregarVerbo('break', 'breaks broke broken breaking');
agregarVerbo('spend', 'spends spent spending');
agregarVerbo('drive', 'drives drove driven driving');
agregarVerbo('buy', 'buys bought buying');
agregarVerbo('choose', 'chooses chose chosen choosing');
agregarVerbo('eat', 'eats ate eaten eating');
agregarVerbo('win', 'wins won winning');
agregarVerbo('teach', 'teaches taught teaching');
agregarVerbo('catch', 'catches caught catching');
agregarVerbo('sell', 'sells sold selling');
agregarVerbo('sleep', 'sleeps slept sleeping');
agregarVerbo('fly', 'flies flew flown flying');
agregarVerbo('read', 'reads reading');
agregarVerbo('put', 'puts putting');
agregarVerbo('let', 'lets letting');
agregarVerbo('set', 'sets setting');
agregarVerbo('cut', 'cuts cutting');
agregarVerbo('swim', 'swims swam swum swimming');
agregarVerbo('drink', 'drinks drank drunk drinking');
agregarVerbo('sing', 'sings sang sung singing');
agregarVerbo('forget', 'forgets forgot forgotten forgetting');
// Verbos regulares muy frecuentes (forma base y 3a persona)
'want look use work call try ask need help talk turn start show play move like live believe happen provide include continue change learn watch follow stop create allow add offer remember love consider appear wait serve die expect stay reach kill remain study open walk analyze process love hate travel return visit decide develop explain hope improve increase'
  .split(' ').forEach((v) => agregarVerbo(v, `${v}s`));

const reglasVerbo = [
  /^\p{L}{3,}ing$/u,
  /^\p{L}{2,}ed$/u,
  /^\p{L}{2,}(ize|izes|ized|izing|ise[sd]?|ify|ifies|ified)$/u
];

const reglasVerboConAuxiliar = [/^\p{L}{2,}(en|ed|ing)$/u];

const excepcionesVerbo = conjunto(`
  thing things something nothing everything anything morning mornings evening evenings king kings ring rings
  spring string strings wing wings during ceiling ceilings building buildings meeting meetings wedding
  ending beginning feeling feelings painting paintings clothing ping sing sibling siblings pudding
  bed red need seed speed hundred indeed shed sacred naked wicked bread breed feed greed creed
  united kindred rugged ragged`);

const reglasSustantivo = [
  /^\p{L}{2,}(tion|tions|sion|sions)$/u,
  /^\p{L}{2,}(ness|nesses|ment|ments|ity|ities)$/u,
  /^\p{L}{2,}(ship|ships|hood|hoods|dom|doms)$/u,
  /^\p{L}{2,}(ism|isms|ist|ists)$/u,
  /^\p{L}{2,}(ance|ances|ence|ences)$/u
];

const titulos = conjunto('mr mr. mrs mrs. ms ms. miss dr dr. prof prof. sir lady lord saint st st. king queen president');
const conectoresNombre = conjunto('van von de da');
const abreviaturas = conjunto('mr mrs ms dr prof st jr sr vs etc e.g i.e inc ltd co dept');

const nombresComunes = conjunto(`
  john james robert michael william david richard joseph thomas charles christopher daniel matthew anthony
  mark donald steven paul andrew joshua kevin brian george edward ronald timothy jason jeffrey ryan jacob
  gary nicholas eric jonathan stephen larry justin scott brandon benjamin samuel frank gregory raymond
  alexander patrick jack dennis jerry tyler aaron henry peter adam harry oliver jim tom bob bill mike
  mary patricia jennifer linda elizabeth barbara susan jessica sarah karen nancy lisa betty margaret
  sandra ashley kimberly emily donna michelle dorothy carol amanda melissa deborah stephanie rebecca
  sharon laura cynthia kathleen amy angela shirley anna emma olivia sophia isabella charlotte alice
  jane kate lucy grace rose julia diana helen`);

const prefijosLugar = conjunto(`
  university college school institute hospital bank ministry museum park street avenue city lake river
  church hotel theater theatre stadium center centre club foundation association department`);

const noPersonas = conjunto(`
  january february march april may june july august september october november december
  monday tuesday wednesday thursday friday saturday sunday god english spanish`);

const excepcionesAdverbio = conjunto(`
  family families supply reply apply rely july italy ally belly holy ugly jelly bully lily
  assembly anomaly monopoly butterfly dolly folly melancholy`);

/** Expande contracciones: don't -> do not, I'm -> I am, John's -> John */
const PRONOMBRES_IS = conjunto("he she it that there what who where here how");
function expandirContraccion(palabra) {
  const m = palabra.match(/^(.+?)(n['’]t|['’](m|re|s|ve|ll|d))$/i);
  if (!m) return [palabra];
  const base = m[1];
  const sufijo = m[2].toLowerCase().replace('’', "'");
  if (sufijo === "n't") {
    const bases = { ca: 'can', wo: 'will', sha: 'shall' };
    return [bases[base.toLowerCase()] || base, 'not'];
  }
  const mapa = { "'m": 'am', "'re": 'are', "'ve": 'have', "'ll": 'will', "'d": 'would' };
  if (mapa[sufijo]) return [base, mapa[sufijo]];
  // 's: verbo "is" tras pronombre; si no, es posesivo y se descarta
  return PRONOMBRES_IS.has(base.toLowerCase()) ? [base, 'is'] : [base];
}

module.exports = {
  codigo: 'en',
  nombre: 'Inglés',
  stemmer: 'english',
  nucleoFrase: 'ultimo',
  determinantes,
  preposiciones,
  funcionales: new Set([...determinantes, ...preposiciones, ...otrasFuncionales]),
  pronombres,
  pronombresAmbiguos: new Set(),
  contextoVerbal,
  auxiliares,
  verbosIrregulares,
  verbosAuxiliaresFrecuencia: new Set(['be', 'have']),
  reglasVerbo,
  reglasVerboConAuxiliar,
  excepcionesVerbo,
  reglasSustantivo,
  adjetivosPrenominales: new Set(),
  titulos,
  conectoresNombre,
  abreviaturas,
  nombresComunes,
  noPersonas,
  patronApellido: null,
  prefijosLugar,
  excepcionesAdverbio,
  expandirContraccion
};
