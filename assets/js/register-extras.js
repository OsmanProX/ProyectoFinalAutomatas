/**
 * ============================================================================
 * REGISTRO: teléfono con bandera del país y aviso de contraseñas que coinciden
 * ============================================================================
 *  - El usuario elige el país (bandera + código) y escribe solo su número.
 *    El valor que se envía al servidor (input oculto "phone") queda como
 *    "+502 5555 1234", así la validación del servidor no cambia.
 *  - Mientras escribe, avisa si "Contraseña" y "Confirmar contraseña" coinciden.
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ------------------------------------------------------------ teléfono con país
  const PAISES = [
    { iso: 'gt', nombre: 'Guatemala', codigo: '502', ejemplo: '5555 1234' },
    { iso: 'sv', nombre: 'El Salvador', codigo: '503', ejemplo: '7012 3456' },
    { iso: 'hn', nombre: 'Honduras', codigo: '504', ejemplo: '9123 4567' },
    { iso: 'ni', nombre: 'Nicaragua', codigo: '505', ejemplo: '8123 4567' },
    { iso: 'cr', nombre: 'Costa Rica', codigo: '506', ejemplo: '8312 3456' },
    { iso: 'pa', nombre: 'Panamá', codigo: '507', ejemplo: '6123 4567' },
    { iso: 'bz', nombre: 'Belice', codigo: '501', ejemplo: '622 1234' },
    { iso: 'mx', nombre: 'México', codigo: '52', ejemplo: '55 1234 5678' },
    { iso: 'us', nombre: 'Estados Unidos', codigo: '1', ejemplo: '201 555 0123' },
    { iso: 'co', nombre: 'Colombia', codigo: '57', ejemplo: '321 123 4567' },
    { iso: 've', nombre: 'Venezuela', codigo: '58', ejemplo: '412 123 4567' },
    { iso: 'ec', nombre: 'Ecuador', codigo: '593', ejemplo: '99 123 4567' },
    { iso: 'pe', nombre: 'Perú', codigo: '51', ejemplo: '912 345 678' },
    { iso: 'bo', nombre: 'Bolivia', codigo: '591', ejemplo: '7123 4567' },
    { iso: 'cl', nombre: 'Chile', codigo: '56', ejemplo: '9 1234 5678' },
    { iso: 'ar', nombre: 'Argentina', codigo: '54', ejemplo: '11 2345 6789' },
    { iso: 'uy', nombre: 'Uruguay', codigo: '598', ejemplo: '94 231 234' },
    { iso: 'py', nombre: 'Paraguay', codigo: '595', ejemplo: '961 456 789' },
    { iso: 'cu', nombre: 'Cuba', codigo: '53', ejemplo: '5 123 4567' },
    { iso: 'es', nombre: 'España', codigo: '34', ejemplo: '612 34 56 78' }
  ];
  const POR_DEFECTO = PAISES[0];

  const campo = document.getElementById('phoneField');
  const boton = document.getElementById('phoneCountryBtn');
  const bandera = document.getElementById('phoneFlag');
  const codigoTexto = document.getElementById('phoneDial');
  const lista = document.getElementById('phoneList');
  const local = document.getElementById('phoneLocal');
  const oculto = document.getElementById('phone');

  if (campo && boton && lista && local && oculto) {
    let actual = POR_DEFECTO;

    const urlBandera = (iso) => `https://flagcdn.com/w40/${iso}.png`;

    function pintarBandera(img, pais) {
      img.src = urlBandera(pais.iso);
      img.alt = pais.iso.toUpperCase();
    }

    function elegir(pais) {
      actual = pais;
      pintarBandera(bandera, pais);
      codigoTexto.textContent = `+${pais.codigo}`;
      boton.title = pais.nombre;
      local.placeholder = pais.ejemplo;
      actualizarOculto();
    }

    /**
     * Lo que recibe el servidor:
     *  - Guatemala: solo el número (8 dígitos), igual que los usuarios ya guardados;
     *    al enviar WhatsApp el servidor le agrega +502 (DEFAULT_COUNTRY_CODE).
     *  - Otros países: "+código número", p. ej. "+52 55 1234 5678".
     *  - Si el usuario pegó el número completo con "+", se respeta tal cual.
     */
    function actualizarOculto() {
      const texto = local.value.trim();
      if (!texto) oculto.value = '';
      else if (texto.startsWith('+')) oculto.value = texto;
      else if (actual.iso === POR_DEFECTO.iso) oculto.value = texto;
      else oculto.value = `+${actual.codigo} ${texto}`;
    }

    // Lista de países (se construye con textContent: no se inyecta HTML)
    PAISES.forEach((pais) => {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      item.tabIndex = -1;
      const img = document.createElement('img');
      img.width = 24;
      img.height = 18;
      img.loading = 'lazy';
      pintarBandera(img, pais);
      const nombre = document.createElement('span');
      nombre.className = 'phone-list-name';
      nombre.textContent = pais.nombre;
      const codigo = document.createElement('span');
      codigo.className = 'phone-list-code';
      codigo.textContent = `+${pais.codigo}`;
      item.append(img, nombre, codigo);
      item.addEventListener('click', () => { elegir(pais); cerrarLista(); local.focus(); });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
      });
      lista.appendChild(item);
    });

    function abrirLista() {
      lista.hidden = false;
      boton.setAttribute('aria-expanded', 'true');
      const elegido = lista.children[PAISES.indexOf(actual)];
      if (elegido) elegido.focus();
    }

    function cerrarLista() {
      lista.hidden = true;
      boton.setAttribute('aria-expanded', 'false');
    }

    boton.addEventListener('click', () => (lista.hidden ? abrirLista() : cerrarLista()));
    document.addEventListener('click', (e) => { if (!campo.contains(e.target)) cerrarLista(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarLista(); });

    // Solo números, espacios y guiones (y "+" al inicio si pegan el número completo)
    local.addEventListener('input', () => {
      local.value = local.value.replace(/[^\d\s+-]/g, '').replace(/(?!^)\+/g, '');
      actualizarOculto();
    });

    // Si el formulario vuelve con error, se recupera el país y el número escritos
    const previo = (oculto.value || '').trim();
    const coincidencia = previo.startsWith('+')
      ? PAISES.filter((p) => previo.replace(/\D/g, '').startsWith(p.codigo))
        .sort((a, b) => b.codigo.length - a.codigo.length)[0]
      : null;
    if (coincidencia) {
      elegir(coincidencia);
      local.value = previo.replace(/^\+\s*/, '').slice(coincidencia.codigo.length).trim();
    } else {
      elegir(POR_DEFECTO);
      if (previo) local.value = previo;
    }
    actualizarOculto();
  }

  // ------------------------------------------------------------ fecha de nacimiento
  // El calendario del navegador permite escribir años de 5 o más dígitos: se valida
  // que el año tenga 4 dígitos, que no sea antes de 1900 ni una fecha futura.
  const fecha = document.getElementById('birth_date');
  const errorFecha = document.getElementById('birthDateError');
  const formulario = document.getElementById('registerForm');

  function fechaValida() {
    if (!fecha) return true;
    if (fecha.validity && fecha.validity.badInput) return false;
    const valor = fecha.value;
    if (!valor) return true; // es opcional
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    return (!fecha.min || valor >= fecha.min) && (!fecha.max || valor <= fecha.max);
  }

  function revisarFecha() {
    const ok = fechaValida();
    if (errorFecha) errorFecha.hidden = ok;
    if (fecha) fecha.classList.toggle('input-error', !ok);
    return ok;
  }

  if (fecha) {
    fecha.addEventListener('input', revisarFecha);
    fecha.addEventListener('change', revisarFecha);
    fecha.addEventListener('blur', revisarFecha);
  }
  if (formulario) {
    formulario.addEventListener('submit', (e) => {
      if (!revisarFecha()) {
        e.preventDefault();
        fecha.focus();
      }
    });
  }

  // ------------------------------------------------------------ contraseñas que coinciden
  const clave = document.getElementById('password');
  const confirmar = document.getElementById('confirm_password');
  const aviso = document.getElementById('passwordMatch');

  if (clave && confirmar && aviso) {
    function revisarCoincidencia() {
      if (!confirmar.value) {
        aviso.textContent = aviso.dataset.hint || '';
        aviso.className = 'form-hint password-match';
        return;
      }
      const iguales = clave.value === confirmar.value;
      aviso.textContent = iguales ? aviso.dataset.ok : aviso.dataset.error;
      aviso.className = `form-hint password-match ${iguales ? 'password-match-ok' : 'password-match-error'}`;
    }
    clave.addEventListener('input', revisarCoincidencia);
    confirmar.addEventListener('input', revisarCoincidencia);
    revisarCoincidencia();
  }
});
