/**
 * ============================================================================
 * GUÍA DEL ROSTRO para la cámara (login con rostro, registro y Mi perfil)
 * ============================================================================
 * Se activa sola en cada <video data-face-guide>. Dibuja encima del video una
 * silueta (cabeza, hombros y la figura del rostro) que cambia de color:
 *   ROJO      no se ve el rostro, está fuera de la silueta o la luz es muy mala
 *   AMARILLO  casi: centrar, acercarse/alejarse, poca luz o contraluz
 *   VERDE     todo bien: ya se puede capturar
 * y muestra un mensaje con lo que hay que corregir.
 *
 * - La luz se mide en el navegador (brillo promedio del rostro y del fondo).
 * - La posición usa face-api.js (el mismo motor del servidor) con el modelo
 *   SSD MobileNet de assets/models. Se carga solo cuando se abre la cámara;
 *   mientras carga (o si no se puede cargar) la guía funciona solo con la luz.
 * - Nada se envía al servidor: todo se calcula en el navegador.
 * ============================================================================
 */
(function () {
  'use strict';

  var INTERVALO_MS = 320;
  var SCRIPT_FACEAPI = '/vendor/face-api/face-api.js';
  var MODELOS = '/models';

  // Silueta: centro y radios relativos al ALTO del video (sirve para 4:3 y 16:9)
  var OVALO = { cy: 0.47, ry: 0.33, rxAlto: 76 / 300 };

  var en = (document.documentElement.lang || 'es').toLowerCase().indexOf('en') === 0;
  var TXT = en ? {
    cargando: 'Preparing the face guide…',
    sinRostro: 'We can’t see your face: place it inside the outline',
    centrar: 'Center your face in the outline',
    acercar: 'Come a little closer',
    alejar: 'Move back a little',
    oscuro: 'Too dark: find more light',
    pocaLuz: 'Low light: turn toward a light source',
    brillo: 'Too much light: avoid direct light on your face',
    contraluz: 'Backlight: avoid having a window behind you',
    listo: 'Perfect! You can capture now',
    soloLuz: 'Good light. Place your face inside the outline'
  } : {
    cargando: 'Preparando la guía del rostro…',
    sinRostro: 'No vemos tu rostro: colócalo dentro de la silueta',
    centrar: 'Centra tu rostro en la silueta',
    acercar: 'Acércate un poco',
    alejar: 'Aléjate un poco',
    oscuro: 'Muy oscuro: busca más luz',
    pocaLuz: 'Poca luz: ponte frente a una fuente de luz',
    brillo: 'Demasiada luz: evita la luz directa en la cara',
    contraluz: 'Contraluz: evita tener una ventana detrás',
    listo: '¡Perfecto! Ya puedes capturar',
    soloLuz: 'Buena luz. Coloca tu rostro dentro de la silueta'
  };

  // ------------------------------------------------------------------ face-api (carga única)
  var cargaFaceApi = null;
  function cargarDetector() {
    if (cargaFaceApi) return cargaFaceApi;
    cargaFaceApi = new Promise(function (resolver, rechazar) {
      if (window.faceapi) return resolver(window.faceapi);
      var s = document.createElement('script');
      s.src = SCRIPT_FACEAPI;
      s.async = true;
      s.onload = function () { window.faceapi ? resolver(window.faceapi) : rechazar(new Error('faceapi')); };
      s.onerror = function () { rechazar(new Error('no se pudo cargar face-api')); };
      document.head.appendChild(s);
    }).then(function (api) {
      // WebGL (rápido, con la tarjeta de video); si el equipo no lo tiene, CPU
      var tf = api.tf;
      return tf.setBackend('webgl')
        .then(function (ok) { if (!ok) throw new Error('sin webgl'); })
        .catch(function () { return tf.setBackend('cpu'); })
        .then(function () { return tf.ready(); })
        .then(function () { return api.nets.ssdMobilenetv1.loadFromUri(MODELOS); })
        .then(function () { return api; });
    });
    cargaFaceApi.catch(function (err) {
      console.warn('Guía del rostro sin detector (solo luz):', err.message);
    });
    return cargaFaceApi;
  }

  // ------------------------------------------------------------------ silueta (SVG)
  var contador = 0;
  function crearCapa() {
    contador += 1;
    var idMascara = 'fg-mascara-' + contador;
    var idRecorte = 'fg-recorte-' + contador;
    var idBarrido = 'fg-barrido-' + contador;
    var idPuntos = 'fg-puntos-' + contador;
    var capa = document.createElement('div');
    capa.className = 'face-guide-capa';
    capa.setAttribute('aria-hidden', 'false');
    capa.innerHTML =
      '<svg class="face-guide-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<defs><mask id="' + idMascara + '">' +
          '<rect class="fg-fondo" x="0" y="0" width="400" height="300" fill="#fff"/>' +
          '<ellipse cx="200" cy="141" rx="76" ry="99" fill="#000"/>' +
        '</mask>' +
        // Efecto de escaneo: todo lo de adentro se recorta a la forma del óvalo
        '<clipPath id="' + idRecorte + '"><ellipse cx="200" cy="141" rx="76" ry="99"/></clipPath>' +
        '<linearGradient id="' + idBarrido + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop class="fg-stop" offset="0" stop-opacity="0"/>' +
          '<stop class="fg-stop" offset="0.8" stop-opacity="0.28"/>' +
          '<stop class="fg-stop" offset="1" stop-opacity="0.6"/>' +
        '</linearGradient>' +
        '<pattern id="' + idPuntos + '" width="12" height="12" patternUnits="userSpaceOnUse">' +
          '<circle class="fg-punto-malla" cx="6" cy="6" r="0.9"/>' +
        '</pattern>' +
        '</defs>' +
        '<rect class="fg-sombra fg-fondo" x="0" y="0" width="400" height="300" mask="url(#' + idMascara + ')"/>' +
        '<path class="fg-hombros" d="M84 300 C92 252 146 236 200 236 C254 236 308 252 316 300"/>' +
        '<g class="fg-escaneo" clip-path="url(#' + idRecorte + ')">' +
          '<rect class="fg-malla" x="124" y="42" width="152" height="198" fill="url(#' + idPuntos + ')"/>' +
          '<g class="fg-barra">' +
            '<rect x="124" y="0" width="152" height="54" fill="url(#' + idBarrido + ')"/>' +
            '<rect class="fg-linea" x="124" y="52" width="152" height="2.5"/>' +
          '</g>' +
        '</g>' +
        '<ellipse class="fg-ovalo" cx="200" cy="141" rx="76" ry="99"/>' +
        '<g class="fg-rostro">' +
          '<path d="M168 124 q10 -7 20 0"/><path d="M212 124 q10 -7 20 0"/>' +
          '<path d="M200 132 v20"/>' +
          '<path d="M182 176 q18 12 36 0"/>' +
        '</g>' +
      '</svg>';
    return capa;
  }

  /** Barra de estado (punto de color + mensaje) que va DEBAJO del video, sin taparlo */
  function crearEstado() {
    var estado = document.createElement('div');
    estado.className = 'face-guide-estado';
    estado.setAttribute('role', 'status');
    estado.setAttribute('aria-live', 'polite');
    estado.innerHTML = '<span class="fg-punto"></span><span class="fg-texto"></span>';
    return estado;
  }

  // ------------------------------------------------------------------ luz
  function brillo(ctx, x, y, w, h) {
    x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    var d = ctx.getImageData(x, y, w, h).data;
    var suma = 0, n = 0;
    for (var i = 0; i < d.length; i += 16) { // 1 de cada 4 píxeles
      suma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n += 1;
    }
    return n ? suma / n : 0;
  }

  function evaluarLuz(rostro, fondo) {
    if (rostro < 55) return { nivel: 0, texto: TXT.oscuro };
    if (rostro > 225) return { nivel: 0, texto: TXT.brillo };
    if (fondo - rostro > 50 && rostro < 130) return { nivel: 1, texto: TXT.contraluz };
    if (rostro < 85) return { nivel: 1, texto: TXT.pocaLuz };
    if (rostro > 205) return { nivel: 1, texto: TXT.brillo };
    return { nivel: 2, texto: '' };
  }

  // ------------------------------------------------------------------ posición
  function evaluarPosicion(caja, W, H) {
    var rx = OVALO.rxAlto * H; // radio horizontal de la silueta en píxeles
    var cx = caja.x + caja.width / 2;
    var cy = caja.y + caja.height / 2;
    var dx = Math.abs(cx - W / 2) / rx;
    var dy = Math.abs(cy / H - (OVALO.cy + 0.02)) / OVALO.ry;
    var tam = caja.width / (rx * 2); // 1 = el rostro llena el ancho de la silueta

    if (dx > 1 || dy > 1) return { nivel: 0, texto: TXT.centrar };
    if (tam < 0.42) return { nivel: 0, texto: TXT.acercar };
    if (tam > 1.25) return { nivel: 0, texto: TXT.alejar };
    if (dx > 0.38 || dy > 0.38) return { nivel: 1, texto: TXT.centrar };
    if (tam < 0.58) return { nivel: 1, texto: TXT.acercar };
    if (tam > 1.08) return { nivel: 1, texto: TXT.alejar };
    return { nivel: 2, texto: '' };
  }

  // ------------------------------------------------------------------ guía por video
  function Guia(video) {
    this.video = video;
    this.lienzo = document.createElement('canvas');
    this.lienzo.width = 320;
    this.lienzo.height = 240;
    this.ctx = this.lienzo.getContext('2d', { willReadFrequently: true });
    this.temporizador = null;
    this.ocupado = false;
    this.detector = null;

    // El video se envuelve: la silueta va exactamente encima y el estado debajo
    var envoltura = document.createElement('div');
    envoltura.className = 'face-guide';
    var marco = document.createElement('div');
    marco.className = 'face-guide-marco';
    video.parentNode.insertBefore(envoltura, video);
    envoltura.appendChild(marco);
    marco.appendChild(video);
    this.capa = crearCapa();
    marco.appendChild(this.capa);
    this.estado = crearEstado();
    envoltura.appendChild(this.estado);
    this.envoltura = envoltura;

    var self = this;
    video.addEventListener('playing', function () { self.iniciar(); });
    ['pause', 'ended', 'emptied'].forEach(function (ev) {
      video.addEventListener(ev, function () { self.detener(); });
    });
  }

  /** Ajusta el lienzo y la silueta a la proporción real de la cámara (4:3, 16:9...) */
  Guia.prototype.ajustarProporcion = function () {
    var v = this.video;
    var aspecto = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 4 / 3;
    if (Math.abs(aspecto - (this.aspecto || 0)) < 0.01) return;
    this.aspecto = aspecto;
    this.lienzo.height = 240;
    this.lienzo.width = Math.round(240 * aspecto);
    var ancho = 300 * aspecto;
    var desplazamiento = (ancho - 400) / 2;
    var svg = this.capa.querySelector('svg');
    svg.setAttribute('viewBox', (-desplazamiento) + ' 0 ' + ancho + ' 300');
    this.capa.querySelectorAll('.fg-fondo').forEach(function (r) {
      r.setAttribute('x', String(-desplazamiento));
      r.setAttribute('width', String(ancho));
    });
  };

  Guia.prototype.mostrar = function (nivel, texto) {
    var color = ['rojo', 'amarillo', 'verde'][nivel];
    this.envoltura.setAttribute('data-estado', color);
    this.video.setAttribute('data-face-state', color);
    this.estado.querySelector('.fg-texto').textContent = texto;
  };

  Guia.prototype.iniciar = function () {
    var self = this;
    this.envoltura.classList.add('activa');
    this.mostrar(1, TXT.cargando);
    cargarDetector().then(function (api) { self.detector = api; }, function () { self.detector = false; });
    this.activa = true;
    if (!this.temporizador) this.programar(INTERVALO_MS);
  };

  /** Siguiente revisión: si el equipo es lento (sin WebGL), se espera más para no trabar la página */
  Guia.prototype.programar = function (ms) {
    var self = this;
    this.temporizador = setTimeout(function () {
      self.temporizador = null;
      if (!self.activa) return;
      var inicio = performance.now();
      self.revisar(function () {
        var duracion = performance.now() - inicio;
        if (self.activa) self.programar(Math.max(INTERVALO_MS, duracion * 2));
      });
    }, ms);
  };

  Guia.prototype.detener = function () {
    this.activa = false;
    clearTimeout(this.temporizador);
    this.temporizador = null;
    this.envoltura.classList.remove('activa');
  };

  Guia.prototype.revisar = function (alTerminar) {
    var v = this.video;
    var fin = typeof alTerminar === 'function' ? alTerminar : function () {};
    if (this.ocupado || v.readyState < 2 || !v.videoWidth || v.offsetParent === null) return fin();
    this.ocupado = true;
    var self = this;
    this.ajustarProporcion();
    var W = this.lienzo.width, H = this.lienzo.height;
    try {
      this.ctx.drawImage(v, 0, 0, W, H);
    } catch (e) {
      this.ocupado = false;
      return fin();
    }
    var fondo = brillo(this.ctx, 0, 0, W, H);
    var rxPx = OVALO.rxAlto * H;
    var zonaOvalo = brillo(this.ctx, W / 2 - rxPx * 0.7, H * (OVALO.cy - OVALO.ry * 0.7), rxPx * 1.4, H * OVALO.ry * 1.4);

    var terminar = function (posicion, luzRostro) {
      var luz = evaluarLuz(luzRostro, fondo);
      // Gana el problema más grave; si empatan, primero la posición
      var final = luz.nivel < posicion.nivel ? luz : posicion;
      self.mostrar(final.nivel, final.nivel === 2 ? TXT.listo : final.texto);
      self.ocupado = false;
      fin();
    };

    if (this.detector === null) { // todavía cargando: solo luz
      var luz = evaluarLuz(zonaOvalo, fondo);
      this.mostrar(Math.min(1, luz.nivel), luz.nivel < 2 ? luz.texto : TXT.cargando);
      this.ocupado = false;
      return fin();
    }
    if (this.detector === false) { // sin detector: solo luz
      var l = evaluarLuz(zonaOvalo, fondo);
      this.mostrar(l.nivel === 2 ? 1 : l.nivel, l.nivel === 2 ? TXT.soloLuz : l.texto);
      this.ocupado = false;
      return fin();
    }

    var api = this.detector;
    api.detectSingleFace(this.lienzo, new api.SsdMobilenetv1Options({ minConfidence: 0.4 }))
      .then(function (det) {
        if (!det) {
          self.mostrar(0, TXT.sinRostro);
          self.ocupado = false;
          return fin();
        }
        var b = det.box;
        terminar(evaluarPosicion(b, W, H), brillo(self.ctx, b.x, b.y, b.width, b.height));
      })
      .catch(function () { self.ocupado = false; fin(); });
  };

  function montar() {
    document.querySelectorAll('video[data-face-guide]').forEach(function (v) {
      if (!v.__guia) v.__guia = new Guia(v);
    });
  }

  /** Precarga el detector cuando la página ya terminó de cargar, para que la guía arranque al instante */
  function precargar() {
    if (!document.querySelector('video[data-face-guide]')) return;
    var empezar = function () { cargarDetector(); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(empezar, { timeout: 4000 });
    else setTimeout(empezar, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
  window.addEventListener('load', precargar);
})();
