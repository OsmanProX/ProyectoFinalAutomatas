/**
 * Reglas léxicas del ESPAÑOL
 * Cada lista/regex es un patrón que el clasificador usa para reconocer
 * pronombres, verbos, sustantivos y nombres de personas.
 */
const conjunto = (texto) => new Set(texto.trim().split(/\s+/));

const determinantes = conjunto(`
  el la los las un una unos unas este esta estos estas ese esa esos esas aquel aquella aquellos aquellas
  mi mis tu tus su sus nuestro nuestra nuestros nuestras vuestro vuestra vuestros vuestras del al cada
  otro otra otros otras algún alguna algunos algunas ningún ninguna varios varias muchos muchas pocos pocas
  mucho mucha poco poca tanto tanta tantos tantas cuyo cuya cuyos cuyas dicho dicha dichos dichas`);

const preposiciones = conjunto(`
  a ante bajo con contra de desde durante en entre hacia hasta mediante para por según sin sobre tras`);

const otrasFuncionales = conjunto(`
  y e o u ni pero sino que porque como cuando donde si aunque mientras pues luego entonces
  no sí muy más menos ya también tampoco solo sólo aquí allí allá ahí acá así bien hoy ayer siempre nunca jamás
  ahora después antes todavía aún casi tan qué quién quiénes cuál cuáles cómo dónde cuándo cuánto cuánta
  todo toda todos todas nada algo alguien nadie mismo misma mismos mismas lo cual cuales quien quienes
  mío mía míos mías tuyo tuya suyo suya suyos suyas etc`);

/** Pronombres personales (tónicos y átonos) */
const pronombres = conjunto(`
  yo tú vos él ella ello usted nosotros nosotras vosotros vosotras ustedes ellos ellas
  me te se nos os le les mí ti sí conmigo contigo consigo`);

/** Pronombres que también son artículos: solo cuentan si van antes de un verbo ("la vi") */
const pronombresAmbiguos = conjunto('lo la los las');

/** Palabras tras las que casi siempre viene un verbo */
const contextoVerbal = conjunto(`
  yo tú él ella usted nosotros nosotras vosotros ellos ellas ustedes me te se nos os le les no nunca jamás ya`);

/** Auxiliares que anteceden a participios y gerundios */
const auxiliares = conjunto(`
  he has ha hemos habéis han había habías habíamos habían hubo habrá habría haya hayan haber
  estoy estás está estamos están estaba estaban estuvo estuvieron`);

/** Formas irregulares frecuentes -> infinitivo (forma raíz del verbo) */
const verbosIrregulares = {};
const agregarVerbo = (infinitivo, formas) => {
  verbosIrregulares[infinitivo] = infinitivo;
  formas.trim().split(/\s+/).forEach((f) => { verbosIrregulares[f] = infinitivo; });
};
agregarVerbo('ser', 'soy eres es somos sois son era eras éramos erais eran fui fuiste fue fuimos fueron sea seas seamos sean sido siendo será serán sería serían');
agregarVerbo('estar', 'estoy estás está estamos están estaba estabas estábamos estaban estuve estuvo estuvimos estuvieron esté estén estando estará estarían');
agregarVerbo('ir', 'voy vas va vamos van iba ibas íbamos iban ido yendo irá irán iría vaya vayan');
agregarVerbo('haber', 'he has ha hemos habéis han había habías habíamos habían hubo habrá habrán habría haya hayan habiendo hay');
agregarVerbo('tener', 'tengo tienes tiene tenemos tienen tenía tenías teníamos tenían tuve tuvo tuvimos tuvieron tendrá tendrán tendría tenga tengan tenido teniendo');
agregarVerbo('hacer', 'hago haces hace hacemos hacen hacía hacían hice hizo hicimos hicieron hará harán haría haga hagan haciendo');
agregarVerbo('poder', 'puedo puedes puede podemos pueden podía podían pude pudo pudimos pudieron podrá podrán podría podrían pueda puedan pudiendo');
agregarVerbo('decir', 'digo dices dice decimos dicen decía decían dije dijo dijimos dijeron dirá dirán diría diga digan diciendo');
agregarVerbo('ver', 'veo ves ve vemos ven veía veían vi vio vimos vieron visto verá verán vea vean viendo');
agregarVerbo('dar', 'doy das da damos dan daba daban di dio dimos dieron dado dará darán dé den dando');
agregarVerbo('saber', 'sé sabes sabe sabemos saben sabía sabían supe supo supieron sabrá sabría sepa sepan sabido');
agregarVerbo('querer', 'quiero quieres quiere queremos quieren quería querían quise quiso quisieron querrá querría quiera quieran');
agregarVerbo('venir', 'vengo vienes viene venimos vienen venía venían vine vino vinieron vendrá vendría venga vengan viniendo');
agregarVerbo('poner', 'pongo pones pone ponemos ponen ponía puse puso pusieron pondrá pondría ponga puesto poniendo');
agregarVerbo('salir', 'salgo sales sale salimos salen salía salió salieron saldrá saldría salga');
agregarVerbo('conocer', 'conozco conoces conoce conocemos conocen conocía conoció conocieron conozca');
agregarVerbo('pensar', 'pienso piensas piensa pensamos piensan pensaba pensó piense');
agregarVerbo('sentir', 'siento sientes siente sentimos sienten sentía sintió sintieron sienta');
agregarVerbo('volver', 'vuelvo vuelves vuelve volvemos vuelven volvía volvió volvieron vuelto vuelva');
agregarVerbo('seguir', 'sigo sigues sigue seguimos siguen seguía siguió siguieron siga siguiendo');
agregarVerbo('empezar', 'empiezo empiezas empieza empezamos empiezan empezó empiece');
agregarVerbo('encontrar', 'encuentras encuentra encontramos encuentran encontró encontraron');
agregarVerbo('pedir', 'pido pides pide pedimos piden pidió pidieron pida pidiendo');
agregarVerbo('dormir', 'duermo duermes duerme dormimos duermen durmió durmieron');
agregarVerbo('morir', 'muero mueres muere morimos mueren murió murieron muerto muriendo');
agregarVerbo('jugar', 'juegas juega jugamos juegan jugó');
agregarVerbo('traer', 'traigo traes trae traemos traen traía trajo trajeron traiga trayendo');
agregarVerbo('oír', 'oigo oyes oye oímos oyen oía oyó oyeron oiga oyendo');
agregarVerbo('caber', 'quepo cabe caben cupo');
agregarVerbo('leer', 'leo lees lee leemos leen leía leyó leyeron leyendo');

/** Terminaciones que identifican un verbo con alta certeza */
const reglasVerbo = [
  /\p{L}{2,}(ar|er|ir)(me|te|se|lo|la|le|los|las|les|nos)$/u,   // hacerlo, decirle, irse
  /\p{L}{2,}(ar|er|ir)$/u,                                      // infinitivos
  /\p{L}{2,}(ando|iendo|yendo)(me|te|se|lo|la|le|los|las|les|nos)?$/u, // gerundios
  /\p{L}{2,}(aron|ieron)$/u,                                    // pretérito 3a plural
  /\p{L}{2,}(aban|ábamos|abais|íamos|íais|aba|abas)$/u,         // copretérito
  /\p{L}{2,}(aremos|eremos|iremos|arán|erán|irán|aré|eré|iré|ará|erá|irá|arás|erás|irás)$/u, // futuro
  /\p{L}{2,}(aría|iría|arían|erían|irían|aríamos|eríamos|iríamos)$/u, // condicional
  /\p{L}{2,}(ó|ió)$/u,                                          // pretérito 3a singular
  /\p{L}{2,}(aste|iste|asteis|isteis)$/u                        // pretérito 2a persona
];

/** Terminaciones de participio/gerundio: solo valen después de un auxiliar */
const reglasVerboConAuxiliar = [/\p{L}{2,}(ado|ido|ada|ida|ados|idos|adas|idas|to|cho|ando|iendo)$/u];

/** Palabras que terminan como verbo pero NO lo son */
const excepcionesVerbo = conjunto(`
  lugar mujer hogar par mar bar azúcar placer taller cáncer carácter líder súper mártir elixir alfiler
  popular similar particular regular militar familiar nuclear lunar solar celular muscular escolar singular
  circular molecular titular vulgar peculiar polar estelar ejemplar secular modular tutelar collar pilar
  dólar néctar altar billar radar hangar
  comando mando bando contrabando segundo mundo fondo
  dominó rococó buró bongó landó
  contraste triste chiste`);

/** Terminaciones típicas de sustantivos */
const reglasSustantivo = [
  /\p{L}{2,}(ción|ciones|sión|siones|xión|xiones)$/u,
  /\p{L}{2,}(dad|dades|tad|tades|tud|tudes)$/u,
  /\p{L}{2,}(miento|mientos|mento|mentos)$/u,
  /\p{L}{2,}(ismo|ismos|ista|istas)$/u,
  /\p{L}{2,}(eza|ezas|ura|uras|anza|anzas)$/u,
  /\p{L}{2,}(encia|encias|ancia|ancias)$/u,
  /\p{L}{2,}(aje|ajes|ería|erías|logía|logías|grafía|grafías)$/u,
  /\p{L}{2,}(ador|adores|edor|edores|idor|idores|tor|tores)$/u
];

/** Adjetivos que suelen ir ANTES del sustantivo ("el gran día") */
const adjetivosPrenominales = conjunto(`
  gran grande grandes buen buena buenos buenas mal mala malos malas nuevo nueva nuevos nuevas viejo vieja
  primer primero primera primeros primeras segundo segunda tercer tercera último última últimos últimas
  mejor mejores peor peores pequeño pequeña pequeños pequeñas joven jóvenes alto alta bajo baja
  largo larga breve pleno plena verdadero verdadera principal principales gran`);

const titulos = conjunto(`
  sr sr. sra sra. srta srta. señor señora señorita don doña dr dr. dra dra. lic lic. licda licda. ing ing.
  prof prof. profesor profesora doctor doctora licenciado licenciada ingeniero ingeniera san santa`);

const conectoresNombre = conjunto('de del la las los');

const abreviaturas = conjunto(`
  sr sra srta dr dra lic licda ing prof etc pág núm art av ud uds ej aprox tel dto depto cía ee.uu`);

/** Nombres de pila frecuentes (ayudan a reconocer personas al inicio de oración) */
const nombresComunes = conjunto(`
  josé juan luis carlos jorge pedro miguel antonio manuel francisco javier david daniel jesús alejandro
  fernando ricardo roberto eduardo mario sergio rafael andrés diego pablo raúl óscar oscar víctor hugo
  kevin osman josué jose marco marcos julio césar cesar enrique alberto arturo rodrigo gustavo gabriel
  héctor hector rubén ruben samuel tomás emilio cristian christian walter edgar erick byron otto
  maría maria ana carmen rosa laura sofía sofia lucía lucia isabel elena marta patricia andrea
  gabriela daniela valeria fernanda paola claudia silvia mónica monica verónica sandra julia carolina
  alejandra beatriz teresa adriana natalia diana karla karen jennifer jessica mariela sara sarah
  dolores mercedes pilar gloria inés irene cristina victoria camila emma ximena`);

/** Palabras con mayúscula que no son nombres de personas */
const noPersonas = conjunto(`
  dios enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre
  lunes martes miércoles jueves viernes sábado domingo`);

/** Terminación típica de apellidos hispanos (Pérez, López, González) */
/** Primeras palabras de nombres de instituciones o lugares (no son personas) */
const prefijosLugar = conjunto(`
  universidad colegio escuela instituto facultad hospital banco ministerio empresa museo parque
  calle avenida ciudad departamento municipio república río lago volcán iglesia hotel teatro estadio
  centro club fundación asociación congreso`);

const patronApellido = /\p{L}{2,}(ez|az|oz|uz)$/u;

module.exports = {
  codigo: 'es',
  nombre: 'Español',
  stemmer: 'spanish',
  nucleoFrase: 'primero',
  determinantes,
  preposiciones,
  funcionales: new Set([...determinantes, ...preposiciones, ...otrasFuncionales]),
  pronombres,
  pronombresAmbiguos,
  contextoVerbal,
  auxiliares,
  verbosIrregulares,
  verbosAuxiliaresFrecuencia: new Set(['ser', 'estar', 'haber']),
  reglasVerbo,
  reglasVerboConAuxiliar,
  excepcionesVerbo,
  reglasSustantivo,
  adjetivosPrenominales,
  titulos,
  conectoresNombre,
  abreviaturas,
  nombresComunes,
  noPersonas,
  patronApellido,
  prefijosLugar,
  excepcionesAdverbio: new Set(),
  expandirContraccion: (palabra) => [palabra]
};
