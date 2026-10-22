/**
 * Reglas léxicas del RUSO (alfabeto cirílico)
 * El ruso no tiene artículos: el contexto de sustantivo lo dan las preposiciones
 * y los demostrativos/posesivos; los verbos se reconocen por sus terminaciones.
 */
const conjunto = (texto) => new Set(texto.trim().split(/\s+/));

const determinantes = conjunto(`
  этот эта это эти этого этой этом этих тот та то те того той том тех
  мой моя моё мое мои моего моей твой твоя твоё твои наш наша наше наши ваш ваша ваше ваши
  свой своя своё свое свои своего своей каждый каждая каждое весь вся всё все всего всей всех
  какой какая какое какие такой такая такое такие один одна одно одни`);

const preposiciones = conjunto(`
  в во на с со к ко по о об обо у от до из за для без при про через над под перед между после около вокруг из-за`);

const otrasFuncionales = conjunto(`
  и а но или да же ли бы не ни что чтобы чтоб как так когда где куда зачем почему потому если хотя
  уже ещё еще тоже также только даже вот вдруг ну там тут здесь теперь сейчас тогда потом всегда никогда
  очень вместе более менее больше меньше почти совсем опять нет кто чем чего чему ничего никто нибудь
  можно нельзя надо будто разве ведь уж ж хорошо лучше конечно впрочем сам сама само сами себя себе собой`);

const pronombres = conjunto(`
  я ты он она оно мы вы они меня тебя его её ее нас вас их мне тебе ему ей нам вам им
  мной мною тобой тобою ним ней нею нами вами ими нём нем него неё нее них нему`);

const contextoVerbal = conjunto('я ты он она оно мы вы они не никогда');

const auxiliares = conjunto('был была было были будет будут буду будем стал стала стали');

const verbosIrregulares = {};
const agregarVerbo = (infinitivo, formas) => {
  verbosIrregulares[infinitivo] = infinitivo;
  formas.trim().split(/\s+/).forEach((f) => { verbosIrregulares[f] = infinitivo; });
};
agregarVerbo('быть', 'есть был была было были будет будут буду будешь будем будете');
agregarVerbo('мочь', 'могу можешь может можем можете могут мог могла могло могли');
agregarVerbo('хотеть', 'хочу хочешь хочет хотим хотите хотят хотел хотела хотели');
agregarVerbo('знать', 'знаю знаешь знает знаем знаете знают знал знала знали');
agregarVerbo('говорить', 'говорю говоришь говорит говорим говорите говорят говорил говорила говорили');
agregarVerbo('сказать', 'скажу скажет скажут сказал сказала сказали');
agregarVerbo('идти', 'иду идёшь идет идёт идём идем идут шёл шел шла шли');
agregarVerbo('пойти', 'пойду пойдёт пойдет пошёл пошел пошла пошли');
agregarVerbo('видеть', 'вижу видишь видит видим видят видел видела видели');
agregarVerbo('делать', 'делаю делаешь делает делаем делают делал делала делали');
agregarVerbo('сделать', 'сделаю сделает сделал сделала сделали');
agregarVerbo('жить', 'живу живёшь живет живёт живём живут жил жила жили');
agregarVerbo('дать', 'дам даст дадут дал дала дали');
agregarVerbo('взять', 'возьму возьмёт взял взяла взяли');
agregarVerbo('пить', 'пью пьёт пьет пьют пил пила пили');
agregarVerbo('пройти', 'пройду пройдёт прошёл прошел прошла прошло прошли');
agregarVerbo('любить', 'люблю любишь любит любим любят любил любила');
agregarVerbo('читать', 'читаю читаешь читает читаем читают читал читала');
agregarVerbo('писать', 'пишу пишешь пишет пишем пишут писал писала');
agregarVerbo('работать', 'работаю работает работают работал работала');
agregarVerbo('думать', 'думаю думает думают думал думала');

const reglasVerbo = [
  /^\p{L}{2,}(ться|тся|чься)$/u,          // infinitivo / presente reflexivo
  /^\p{L}{2,}(ть|ти|чь)$/u,               // infinitivo
  /^\p{L}{2,}(ся|сь)$/u,                  // formas reflexivas
  /^\p{L}{2,}(ал|ял|ил|ала|яла|ила|ало|ило|али|яли|или)$/u, // pasado
  /^\p{L}{2,}(ает|яет|еет|ует|ают|яют|еют|уют|ешь|ишь|аем|яем|ёт|ют)$/u // presente
];

const reglasVerboConAuxiliar = [/^\p{L}{2,}(ть|ти|ться)$/u];

const excepcionesVerbo = conjunto(`
  часть власть мать путь сеть смерть честь треть кровать печать пасть страсть масть зять нить суть ртуть
  дочь ночь речь мощь помощь вещь
  журнал канал сигнал финал зал материал капитал вокзал идеал персонал потенциал интервал скандал сериал
  крокодил автомобили сила могила правило крыло шило мыло детали
  вся уся`);

const reglasSustantivo = [
  /^\p{L}{2,}(ость|ости|остей|остью)$/u,
  /^\p{L}{2,}(ение|ения|ений|ению|ением|ание|ания|аний|анию|анием)$/u,
  /^\p{L}{2,}(ство|ства|ству|ством|тель|теля|телю|телем|тели|телей)$/u,
  /^\p{L}{2,}(ция|ции|ций|цию|цией|сия|сии)$/u,
  /^\p{L}{2,}(изм|изма|ист|иста|исты|ник|ника|ники|щик|щика|чик|чика)$/u
];

/** Terminaciones de adjetivo (para no confundirlos con sustantivos) */
const patronAdjetivo = /^\p{L}{2,}(ый|ий|ой|ая|яя|ое|ее|ые|ие|ого|его|ому|ему|ым|им|ых|их|ую|юю)$/u;

/** Terminaciones verbales ambiguas: impiden suponer que la palabra es sustantivo */
const patronVerboDebil = /^\p{L}{2,}(ите|ете|ят|ут|ла|ли)$/u;

const prefijosLugar = conjunto('университет институт школа больница банк министерство музей парк улица город река озеро церковь театр');

const titulos = conjunto('господин госпожа г-н г-жа доктор профессор товарищ святой');
const conectoresNombre = new Set();
const abreviaturas = conjunto('г гг т.е т.д т.п см им ул д стр др проф');

const nombresComunes = conjunto(`
  иван алексей дмитрий сергей андрей михаил николай владимир александр павел пётр петр борис юрий
  виктор максим антон олег артём артем фёдор федор лев илья роман евгений константин григорий
  мария анна елена ольга татьяна наталья ирина светлана екатерина анастасия юлия дарья наташа
  софья людмила галина вера надежда любовь марина ксения полина алиса`);

const noPersonas = conjunto('бог россия москва');

/** Apellidos y patronímicos rusos: Иванов, Петрова, Толстой, Достоевский, Сергеевич */
const patronApellido = /^\p{L}{2,}(ов|ова|ев|ева|ёв|ин|ина|ын|ына|ский|ская|цкий|цкая|ович|евич|овна|евна|ич|ична|ой)$/u;

module.exports = {
  codigo: 'ru',
  nombre: 'Ruso',
  stemmer: 'russian',
  nucleoFrase: 'ultimo',
  determinantes,
  preposiciones,
  funcionales: new Set([...determinantes, ...preposiciones, ...otrasFuncionales]),
  pronombres,
  pronombresAmbiguos: new Set(),
  contextoVerbal,
  auxiliares,
  verbosIrregulares,
  verbosAuxiliaresFrecuencia: new Set(['быть']),
  reglasVerbo,
  reglasVerboConAuxiliar,
  excepcionesVerbo,
  reglasSustantivo,
  patronAdjetivo,
  patronVerboDebil,
  prefijosLugar,
  sustantivoPorDefecto: true,
  adjetivosPrenominales: new Set(),
  titulos,
  conectoresNombre,
  abreviaturas,
  nombresComunes,
  noPersonas,
  patronApellido,
  excepcionesAdverbio: new Set(),
  expandirContraccion: (palabra) => [palabra]
};
