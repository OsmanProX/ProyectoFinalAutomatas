/**
 * ============================================================================
 * ESTUDIO DE FOTO (filtros, stickers y marcos)
 * ============================================================================
 * Componente reutilizable (registro y Gestión de Perfil).
 *
 *   PhotoStudio.open(fotoOriginalDataURL, {
 *     etiqueta: '@kevin',                 // texto opcional para el marco Polaroid
 *     textos: { ... },                    // traducciones (opcional)
 *     onDone: (fotoModificadaDataURL) => {},
 *     onCancel: () => {}
 *   });
 *
 * - Los filtros se aplican píxel por píxel (funciona igual en Chrome, Firefox,
 *   Edge, Android e iOS).
 * - Los stickers se agregan con un toque y se arrastran con el mouse o el dedo.
 * - La foto original nunca se modifica: se devuelve una copia nueva en JPEG.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const TAM = 400; // tamaño final de la imagen (px)

  const TEXTOS_DEFECTO = {
    titulo: '✨ Personaliza tu foto',
    subtitulo: 'Esta foto aparecerá en tu credencial y en la barra del sitio',
    filtros: 'Filtros',
    stickers: 'Stickers',
    marcos: 'Marcos',
    sorprendeme: '🎲 Sorpréndeme',
    saltar: 'Usar sin cambios',
    listo: 'Listo ✓',
    tamano: 'Tamaño',
    girar: 'Girar',
    quitar: 'Quitar sticker',
    ayudaSticker: 'Toca un sticker para agregarlo y arrástralo sobre la foto',
    limpiar: 'Quitar todos'
  };

  // ------------------------------------------------------------------ filtros
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

  /** Cada filtro recibe los píxeles RGBA y los modifica en el mismo arreglo */
  const FILTROS = [
    { id: 'original', nombre: 'Original', aplicar: null },
    {
      id: 'byn', nombre: 'B y N',
      aplicar: (d) => { for (let i = 0; i < d.length; i += 4) { const y = lum(d[i], d[i + 1], d[i + 2]); d[i] = d[i + 1] = d[i + 2] = y; } }
    },
    {
      id: 'sepia', nombre: 'Sepia',
      aplicar: (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          d[i] = 0.393 * r + 0.769 * g + 0.189 * b;
          d[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
          d[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
        }
      }
    },
    {
      id: 'vintage', nombre: 'Vintage', vineta: 0.45,
      aplicar: (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const sr = 0.393 * r + 0.769 * g + 0.189 * b;
          const sg = 0.349 * r + 0.686 * g + 0.168 * b;
          const sb = 0.272 * r + 0.534 * g + 0.131 * b;
          d[i] = ((r + sr) / 2 - 128) * 0.85 + 138;
          d[i + 1] = ((g + sg) / 2 - 128) * 0.85 + 128;
          d[i + 2] = ((b + sb) / 2 - 128) * 0.85 + 112;
        }
      }
    },
    {
      id: 'calido', nombre: 'Cálido',
      aplicar: (d) => { for (let i = 0; i < d.length; i += 4) { d[i] = d[i] * 1.12 + 12; d[i + 1] = d[i + 1] * 1.03 + 4; d[i + 2] *= 0.85; } }
    },
    {
      id: 'frio', nombre: 'Frío',
      aplicar: (d) => { for (let i = 0; i < d.length; i += 4) { d[i] *= 0.86; d[i + 1] = d[i + 1] * 1.02 + 4; d[i + 2] = d[i + 2] * 1.14 + 14; } }
    },
    {
      id: 'pop', nombre: 'Pop',
      aplicar: (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const y = lum(d[i], d[i + 1], d[i + 2]);
          for (let c = 0; c < 3; c++) d[i + c] = ((y + (d[i + c] - y) * 1.7) - 128) * 1.15 + 128;
        }
      }
    },
    {
      id: 'noir', nombre: 'Noir', vineta: 0.6,
      aplicar: (d) => { for (let i = 0; i < d.length; i += 4) { const y = (lum(d[i], d[i + 1], d[i + 2]) - 128) * 1.55 + 128; d[i] = d[i + 1] = d[i + 2] = y; } }
    },
    {
      id: 'sueno', nombre: 'Sueño',
      aplicar: (d) => {
        for (let i = 0; i < d.length; i += 4) {
          d[i] = (d[i] - 128) * 0.8 + 150;
          d[i + 1] = (d[i + 1] - 128) * 0.8 + 132;
          d[i + 2] = (d[i + 2] - 128) * 0.8 + 150;
        }
      }
    },
    {
      id: 'comic', nombre: 'Cómic',
      aplicar: (d) => {
        const niveles = 4;
        const paso = 255 / (niveles - 1);
        for (let i = 0; i < d.length; i += 4) {
          const y = lum(d[i], d[i + 1], d[i + 2]);
          for (let c = 0; c < 3; c++) {
            const saturado = y + (d[i + c] - y) * 1.5;
            d[i + c] = Math.round(saturado / paso) * paso;
          }
        }
      }
    }
  ];

  const STICKERS = ['😎', '🎓', '👑', '🌟', '🔥', '💯', '🎉', '🤖', '❤️', '🦄', '🐱', '🌈', '⚡', '🍕', '🎧', '💡', '🚀', '👍'];

  // ------------------------------------------------------------------ marcos
  /** Generador pseudoaleatorio con semilla: el confeti sale igual cada vez */
  function aleatorioConSemilla(semilla) {
    return function () {
      semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0;
      let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MARCOS = [
    { id: 'ninguno', nombre: 'Sin marco', dibujar: null },
    {
      id: 'umg', nombre: 'UMG',
      dibujar: (ctx) => {
        ctx.lineWidth = 22; ctx.strokeStyle = '#1a1a2e'; ctx.strokeRect(11, 11, TAM - 22, TAM - 22);
        ctx.lineWidth = 5; ctx.strokeStyle = '#4361ee'; ctx.strokeRect(24, 24, TAM - 48, TAM - 48);
        ctx.fillStyle = '#4361ee';
        redondeado(ctx, TAM - 118, TAM - 58, 92, 32, 16); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('UMG', TAM - 72, TAM - 41);
      }
    },
    {
      id: 'polaroid', nombre: 'Polaroid',
      dibujar: (ctx, opciones) => {
        ctx.fillStyle = '#fffdf7';
        ctx.fillRect(0, 0, TAM, 16); ctx.fillRect(0, 0, 16, TAM); ctx.fillRect(TAM - 16, 0, 16, TAM);
        ctx.fillRect(0, TAM - 70, TAM, 70);
        ctx.fillStyle = '#2d2d2d'; ctx.font = 'italic bold 26px "Comic Sans MS", "Segoe Print", cursive';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(opciones.etiqueta || '¡Hola! 👋', TAM / 2, TAM - 35, TAM - 40);
      }
    },
    {
      id: 'neon', nombre: 'Neón',
      dibujar: (ctx) => {
        const degradado = ctx.createLinearGradient(0, 0, TAM, TAM);
        degradado.addColorStop(0, '#ff3cac'); degradado.addColorStop(0.5, '#784ba0'); degradado.addColorStop(1, '#2b86c5');
        ctx.save();
        ctx.shadowColor = '#ff3cac'; ctx.shadowBlur = 18;
        ctx.lineWidth = 14; ctx.strokeStyle = degradado;
        redondeado(ctx, 12, 12, TAM - 24, TAM - 24, 28); ctx.stroke();
        ctx.restore();
      }
    },
    {
      id: 'confeti', nombre: 'Confeti',
      dibujar: (ctx) => {
        const azar = aleatorioConSemilla(7);
        const colores = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff70a6'];
        for (let n = 0; n < 90; n++) {
          const lado = n % 4;
          const t = azar() * TAM;
          const profundidad = azar() * 38;
          const x = lado === 0 ? t : lado === 1 ? TAM - profundidad : lado === 2 ? t : profundidad;
          const y = lado === 0 ? profundidad : lado === 1 ? t : lado === 2 ? TAM - profundidad : t;
          ctx.save();
          ctx.translate(x, y); ctx.rotate(azar() * Math.PI);
          ctx.fillStyle = colores[n % colores.length];
          if (n % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-6, -3, 12, 6);
          ctx.restore();
        }
      }
    }
  ];

  function redondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function aplicarFiltro(ctx, ancho, alto, filtro) {
    if (!filtro.aplicar) return;
    const datos = ctx.getImageData(0, 0, ancho, alto);
    filtro.aplicar(datos.data);
    ctx.putImageData(datos, 0, 0);
  }

  function dibujarVineta(ctx, intensidad, tam) {
    if (!intensidad) return;
    const g = ctx.createRadialGradient(tam / 2, tam / 2, tam * 0.3, tam / 2, tam / 2, tam * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${intensidad})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, tam, tam);
  }

  const FUENTE_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  // ------------------------------------------------------------------ utilidades DOM
  function el(tag, props, hijos) {
    const nodo = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'text') nodo.textContent = v;
      else if (k === 'className') nodo.className = v;
      else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
      else nodo.setAttribute(k, v);
    });
    (hijos || []).forEach((h) => nodo.appendChild(h));
    return nodo;
  }

  function cargarImagen(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ------------------------------------------------------------------ componente
  async function open(fotoOriginal, opciones = {}) {
    const textos = Object.assign({}, TEXTOS_DEFECTO, opciones.textos || {});
    const imagen = await cargarImagen(fotoOriginal);

    const estado = {
      filtro: FILTROS[0],
      marco: MARCOS[0],
      stickers: [],          // { emoji, x, y, tam, giro }
      seleccionado: null,
      arrastrando: null,
      siguientePosicion: 0
    };

    // Base con el filtro aplicado (se recalcula solo al cambiar de filtro)
    const base = document.createElement('canvas');
    base.width = base.height = TAM;
    const ctxBase = base.getContext('2d', { willReadFrequently: true });
    const prepararBase = () => {
      ctxBase.drawImage(imagen, 0, 0, TAM, TAM);
      aplicarFiltro(ctxBase, TAM, TAM, estado.filtro);
      dibujarVineta(ctxBase, estado.filtro.vineta, TAM);
    };
    prepararBase();

    // ---------- estructura del modal
    const lienzo = el('canvas', { className: 'ps-canvas', width: TAM, height: TAM, 'aria-label': textos.titulo });
    const ctx = lienzo.getContext('2d');

    const panelFiltros = el('div', { className: 'ps-strip' });
    const panelStickers = el('div', { className: 'ps-stickers' });
    const panelMarcos = el('div', { className: 'ps-strip' });
    const paneles = { filtros: panelFiltros, stickers: panelStickers, marcos: panelMarcos };

    const controlTam = el('input', { type: 'range', min: '40', max: '170', value: '90', 'aria-label': textos.tamano });
    const controlGiro = el('input', { type: 'range', min: '-45', max: '45', value: '0', 'aria-label': textos.girar });
    const btnQuitar = el('button', { type: 'button', className: 'ps-btn ps-btn-ghost', text: `🗑 ${textos.quitar}` });
    const controlesSticker = el('div', { className: 'ps-sticker-controls ps-hidden' }, [
      el('label', {}, [el('span', { text: textos.tamano }), controlTam]),
      el('label', {}, [el('span', { text: textos.girar }), controlGiro]),
      btnQuitar
    ]);
    const ayuda = el('p', { className: 'ps-help', text: textos.ayudaSticker });

    const pestanas = el('div', { className: 'ps-tabs', role: 'tablist' });
    const contenidoPestanas = el('div', { className: 'ps-tab-body' }, [panelFiltros, panelStickers, panelMarcos]);

    const btnSorpresa = el('button', { type: 'button', className: 'ps-btn ps-btn-fun', text: textos.sorprendeme });
    const btnSaltar = el('button', { type: 'button', className: 'ps-btn ps-btn-ghost', text: textos.saltar });
    const btnListo = el('button', { type: 'button', className: 'ps-btn ps-btn-primary', text: textos.listo });

    const modal = el('div', { className: 'ps-modal', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { className: 'ps-header' }, [
        el('h2', { text: textos.titulo }),
        el('p', { text: textos.subtitulo })
      ]),
      el('div', { className: 'ps-body' }, [
        el('div', { className: 'ps-preview' }, [lienzo, controlesSticker]),
        el('div', { className: 'ps-tools' }, [pestanas, contenidoPestanas, ayuda])
      ]),
      el('div', { className: 'ps-footer' }, [btnSorpresa, el('span', { className: 'ps-spacer' }), btnSaltar, btnListo])
    ]);
    const fondo = el('div', { className: 'ps-backdrop' }, [modal]);

    // ---------- pestañas
    const nombresPestanas = [['filtros', textos.filtros], ['stickers', textos.stickers], ['marcos', textos.marcos]];
    function activarPestana(id) {
      nombresPestanas.forEach(([clave]) => {
        paneles[clave].classList.toggle('ps-hidden', clave !== id);
      });
      [...pestanas.children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
      ayuda.classList.toggle('ps-hidden', id !== 'stickers');
    }
    nombresPestanas.forEach(([clave, nombre]) => {
      const b = el('button', { type: 'button', className: 'ps-tab', role: 'tab', text: nombre, onclick: () => activarPestana(clave) });
      b.dataset.tab = clave;
      pestanas.appendChild(b);
    });

    // ---------- miniaturas de filtros
    const mini = 76;
    FILTROS.forEach((filtro) => {
      const c = el('canvas', { width: mini, height: mini });
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(imagen, 0, 0, mini, mini);
      aplicarFiltro(cx, mini, mini, filtro);
      dibujarVineta(cx, filtro.vineta, mini);
      const boton = el('button', { type: 'button', className: 'ps-thumb', title: filtro.nombre }, [c, el('span', { text: filtro.nombre })]);
      boton.addEventListener('click', () => elegirFiltro(filtro));
      boton.dataset.id = filtro.id;
      panelFiltros.appendChild(boton);
    });

    // ---------- marcos
    MARCOS.forEach((marco) => {
      const c = el('canvas', { width: TAM, height: TAM });
      const cx = c.getContext('2d');
      cx.fillStyle = '#d9dcef'; cx.fillRect(0, 0, TAM, TAM);
      if (marco.dibujar) marco.dibujar(cx, { etiqueta: opciones.etiqueta });
      const boton = el('button', { type: 'button', className: 'ps-thumb', title: marco.nombre }, [c, el('span', { text: marco.nombre })]);
      boton.addEventListener('click', () => elegirMarco(marco));
      boton.dataset.id = marco.id;
      panelMarcos.appendChild(boton);
    });

    // ---------- stickers
    STICKERS.forEach((emoji) => {
      panelStickers.appendChild(el('button', {
        type: 'button', className: 'ps-sticker', text: emoji, title: emoji,
        onclick: () => agregarSticker(emoji)
      }));
    });
    panelStickers.appendChild(el('button', {
      type: 'button', className: 'ps-btn ps-btn-ghost ps-clear', text: textos.limpiar,
      onclick: () => { estado.stickers = []; seleccionar(null); dibujar(); }
    }));

    // ---------- lógica
    function marcarActivo(panel, id) {
      [...panel.querySelectorAll('.ps-thumb')].forEach((b) => b.classList.toggle('ps-active', b.dataset.id === id));
    }

    function elegirFiltro(filtro) {
      estado.filtro = filtro;
      prepararBase();
      marcarActivo(panelFiltros, filtro.id);
      dibujar();
    }

    function elegirMarco(marco) {
      estado.marco = marco;
      marcarActivo(panelMarcos, marco.id);
      dibujar();
    }

    const POSICIONES = [[85, 85], [315, 85], [200, 62], [85, 315], [315, 315]];
    function agregarSticker(emoji, x, y, tam) {
      const [px, py] = POSICIONES[estado.siguientePosicion++ % POSICIONES.length];
      const sticker = { emoji, x: x ?? px, y: y ?? py, tam: tam ?? 90, giro: 0 };
      estado.stickers.push(sticker);
      seleccionar(sticker);
      dibujar();
    }

    function seleccionar(sticker) {
      estado.seleccionado = sticker;
      controlesSticker.classList.toggle('ps-hidden', !sticker);
      if (sticker) {
        controlTam.value = sticker.tam;
        controlGiro.value = sticker.giro;
      }
    }

    function dibujar(paraExportar) {
      ctx.clearRect(0, 0, TAM, TAM);
      ctx.drawImage(base, 0, 0);
      if (estado.marco.dibujar) estado.marco.dibujar(ctx, { etiqueta: opciones.etiqueta });
      estado.stickers.forEach((s) => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate((s.giro * Math.PI) / 180);
        ctx.font = `${s.tam}px ${FUENTE_EMOJI}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.emoji, 0, 0);
        ctx.restore();
        if (!paraExportar && s === estado.seleccionado) {
          ctx.save();
          ctx.setLineDash([6, 5]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,.6)';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.tam * 0.62, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // Arrastrar stickers (mouse y táctil con Pointer Events)
    const aCoordenadas = (e) => {
      const r = lienzo.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * TAM) / r.width, y: ((e.clientY - r.top) * TAM) / r.height };
    };
    const stickerEn = (p) => [...estado.stickers].reverse()
      .find((s) => Math.hypot(s.x - p.x, s.y - p.y) <= s.tam * 0.62);

    lienzo.addEventListener('pointerdown', (e) => {
      const p = aCoordenadas(e);
      const s = stickerEn(p);
      seleccionar(s || null);
      if (s) {
        estado.arrastrando = { s, dx: p.x - s.x, dy: p.y - s.y };
        lienzo.setPointerCapture(e.pointerId);
      }
      dibujar();
    });
    lienzo.addEventListener('pointermove', (e) => {
      if (!estado.arrastrando) return;
      const p = aCoordenadas(e);
      const { s, dx, dy } = estado.arrastrando;
      s.x = Math.max(0, Math.min(TAM, p.x - dx));
      s.y = Math.max(0, Math.min(TAM, p.y - dy));
      dibujar();
    });
    const soltar = () => { estado.arrastrando = null; };
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);

    controlTam.addEventListener('input', () => { if (estado.seleccionado) { estado.seleccionado.tam = Number(controlTam.value); dibujar(); } });
    controlGiro.addEventListener('input', () => { if (estado.seleccionado) { estado.seleccionado.giro = Number(controlGiro.value); dibujar(); } });
    function quitarSeleccionado() {
      if (!estado.seleccionado) return;
      estado.stickers = estado.stickers.filter((s) => s !== estado.seleccionado);
      seleccionar(null);
      dibujar();
    }
    btnQuitar.addEventListener('click', quitarSeleccionado);

    // Combinación aleatoria: filtro + marco + 1 a 3 stickers (lejos del centro de la cara)
    btnSorpresa.addEventListener('click', () => {
      const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
      elegirFiltro(azar(FILTROS.slice(1)));
      elegirMarco(azar(MARCOS.slice(1)));
      estado.stickers = [];
      const cantidad = 1 + Math.floor(Math.random() * 3);
      const lugares = [...POSICIONES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < cantidad; i++) {
        const [x, y] = lugares[i];
        agregarSticker(azar(STICKERS), x, y, 70 + Math.floor(Math.random() * 40));
      }
      seleccionar(null);
      dibujar();
    });

    // ---------- cerrar
    return new Promise((resolve) => {
      function cerrar(resultado) {
        document.removeEventListener('keydown', teclas);
        fondo.remove();
        document.body.classList.remove('ps-open');
        resolve(resultado);
      }
      function terminar() {
        seleccionar(null);
        dibujar(true);
        const foto = lienzo.toDataURL('image/jpeg', 0.88);
        if (opciones.onDone) opciones.onDone(foto);
        cerrar(foto);
      }
      function teclas(e) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && estado.seleccionado && document.activeElement.tagName !== 'INPUT') quitarSeleccionado();
        if (e.key === 'Escape') { if (opciones.onCancel) opciones.onCancel(); cerrar(null); }
      }
      btnListo.addEventListener('click', terminar);
      btnSaltar.addEventListener('click', () => {
        elegirFiltro(FILTROS[0]); elegirMarco(MARCOS[0]); estado.stickers = [];
        terminar();
      });
      document.addEventListener('keydown', teclas);

      document.body.appendChild(fondo);
      document.body.classList.add('ps-open');
      activarPestana('filtros');
      marcarActivo(panelFiltros, 'original');
      marcarActivo(panelMarcos, 'ninguno');
      dibujar();
      btnListo.focus();
    });
  }

  global.PhotoStudio = { open, FILTROS, MARCOS, STICKERS };
})(window);
