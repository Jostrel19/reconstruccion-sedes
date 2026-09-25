/* app/js/registrar.js — Registrar presupuesto y sus fotos (D-29, D-33, D-45).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Paso 3: Registrar presupuesto (D-29, D-33) — catálogos cerrados de
     capítulo y unidad, cálculo automático (nunca se digita un total), alerta
     de A/U sin bloqueo (D-5; los umbrales no tienen aval de Planeación
     todavía, Q-3) y versionado real contra el backend (D-37). ─── */

  const CAPITULOS = {
    1:'Estructural', 2:'Mampostería y muros', 3:'Cubierta', 4:'Cimentación y terreno',
    5:'Elementos no estructurales', 6:'Acabados', 7:'Instalaciones', 8:'Unidades sanitarias',
    9:'Cocina y restaurante escolar', 10:'Elementos exteriores', 11:'Deficiencia constructiva',
    12:'Preliminares y obras provisionales', 13:'Demoliciones y desmontes',
    14:'Aseo, escombros y disposición final',
  };
  const UNIDADES = ['m²','m³','ml','un','gl','kg','ton','vje','día','mes','hora'];
  const ALERTA_ADMIN_PCT = 12;
  const ALERTA_UTILIDAD_PCT = 8;

  // Formato colombiano: punto de miles, coma decimal — "1.500.000" o "1.500,5".
  function parseCOP(str){
    if (typeof str === 'number') return str;
    let s = String(str == null ? '' : str).trim().replace(/\$/g, '').replace(/\s/g, '');
    if (!s) return 0;
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function formatNum(n, decimales){
    return Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: decimales || 0, maximumFractionDigits: decimales || 0 });
  }

  let registro = { dane: null, cargado: false, items: [], pctAdmin: 10, pctUtilidad: 5,
    plazoDias: '', declaraSinAfectacion: false, descripcionAfectacion: '',
    estadoActual: null, versionActual: null, error: null };

  const ESTADOS_PRESUPUESTO = {
    BORRADOR: ['e-pend', 'En diligenciamiento (borrador)'],
    RADICADO: ['e-rad', 'Radicado'],
    EN_VERIFICACION: ['e-ver', 'En verificación'],
    REQUIERE_AJUSTE: ['e-rad', 'Requiere ajuste'],
    APROBADO: ['e-apr', 'Aprobado'],
  };

  async function cargarRegistro(dane){
    registro = { dane, cargado: false, items: [], pctAdmin: 10, pctUtilidad: 5,
      plazoDias: '', declaraSinAfectacion: false, descripcionAfectacion: '',
      estadoActual: null, versionActual: null, vigente: null, borradorEnEspera: null, error: null };
    try {
      const r = await backend('obtenerPresupuesto', { token: sesion.token, dane_sede: dane });
      if (r.ok && r.presupuesto) {
        // Si hay un borrador en espera (posterior a la versión radicada), el
        // formulario lo retoma; la radicada sigue siendo la vigente.
        const p = r.borrador || r.presupuesto;
        const itemsFuente = r.borrador ? (r.borrador_items || []) : (r.items || []);
        registro.vigente = { version: r.presupuesto.version, estado: r.presupuesto.estado };
        registro.borradorEnEspera = r.borrador ? { version: r.borrador.version, fecha: r.borrador.fecha_creacion } : null;
        registro.pctAdmin = Number(p.pct_admin) || 10;
        registro.pctUtilidad = Number(p.pct_utilidad) || 5;
        registro.plazoDias = p.plazo_dias || '';
        registro.declaraSinAfectacion = !!p.declara_sin_afectacion;
        registro.descripcionAfectacion = p.declara_sin_afectacion ? (p.justificacion_discrepancia || '') : (p.descripcion_afectacion || '');
        registro.estadoActual = r.presupuesto.estado;
        registro.versionActual = p.version;
        registro.items = itemsFuente.map(it => ({
          capitulo: String(it.capitulo), descripcion: it.descripcion, unidad: it.unidad,
          cantidad: Number(it.cantidad) || 0, valor_unitario: Number(it.valor_unitario) || 0,
        }));
      } else if (!r.ok) {
        // No se traga el error: sin esto, un token vencido o una sede fuera de
        // alcance dejaban el formulario en blanco sin explicar por qué.
        registro.error = r.error || 'No se pudo verificar si esta sede ya tiene un presupuesto.';
      }
    } catch (err) {
      registro.error = 'No se pudo contactar el servidor para revisar si ya existe un presupuesto. Puede seguir diligenciando, pero verifique su conexión antes de guardar.';
    }
    registro.cargado = true;
    if (vista === 'registrar' && String(daneActual) === String(dane)) pintarRegistrarReal();
    cargarFotosRegistro(dane);
  }

  /* ─── Fotos (D-29 sección 4, D-19): suben directo a Drive, una carpeta por
     DANE sede (backend/Fotos.gs). Nunca se guarda el contenido en el
     navegador — ni siquiera aquí: `previewDataUrl` es solo la miniatura de lo
     que ya se subió en esta misma sesión, y se pierde al recargar; lo que
     persiste de verdad es lo que devuelve `listarFotos`. ─── */
  let fotosRegistro = [];

  async function cargarFotosRegistro(dane){
    fotosRegistro = [];
    if (vista === 'registrar' && String(daneActual) === String(dane)) renderFotosRegistro();
    try {
      const r = await backend('listarFotos', { token: sesion.token, dane_sede: dane });
      if (r.ok) fotosRegistro = r.fotos.map(f => Object.assign({}, f, { estado: 'subida' }));
    } catch (err) { /* la sección queda vacía; no bloquea el resto del formulario */ }
    if (vista === 'registrar' && String(daneActual) === String(dane)) {
      renderFotosRegistro();
      sincronizarHechoRegistro();
    }
  }

  function renderFotosRegistro(){
    const cont = document.getElementById('reg-fotos-lista');
    if (!cont) return;
    const tarjetas = fotosRegistro.map(f => {
      const nombreVisible = esc(String(f.nombre || '').replace(/^\d{8}_\d{6}_/, ''));
      const miniatura = f.previewDataUrl
        ? `<div class="ph" style="background:center/cover no-repeat url('${f.previewDataUrl}')"></div>`
        : `<div class="ph">${esc((f.nombre || '').split('.').pop().slice(0, 4).toUpperCase() || 'IMG')}</div>`;
      if (f.estado === 'subiendo') return `<div class="foto">${miniatura}<b title="${nombreVisible}">${nombreVisible}</b><small>Subiendo…</small></div>`;
      if (f.estado === 'error') return `<div class="foto" style="border-color:var(--err)"><div class="ph" style="color:var(--err);background:var(--err-bg)">!</div><b title="${nombreVisible}">${nombreVisible}</b><small style="color:var(--err)">No se pudo subir</small></div>`;
      const kb = f.tamano ? `${Math.max(1, Math.round(f.tamano / 1024))} KB` : '';
      return `<div class="foto">${miniatura}<b title="${nombreVisible}">${nombreVisible}</b><small>${kb}</small></div>`;
    }).join('');
    cont.innerHTML = tarjetas + '<div class="foto add" id="reg-foto-agregar"><span class="mas">+</span><b>Agregar</b><small>jpg, png · máx 8 MB</small></div>';
    document.getElementById('reg-foto-agregar').addEventListener('click', () => document.getElementById('reg-foto-input').click());
    const nSubidas = fotosRegistro.filter(f => f.estado === 'subida').length;
    document.getElementById('reg-fotos-eyebrow').textContent = `${nSubidas} foto${nSubidas === 1 ? '' : 's'}`;
  }

  function subirFotosSeleccionadas(files){
    [...files].forEach(file => {
      if (!file.type.startsWith('image/')) { avisar(`«${file.name}» no es una imagen: no se subió.`, 'error'); return; }
      if (file.size > 8 * 1024 * 1024) { avisar(`«${file.name}» supera 8 MB: redúzcala antes de subirla.`, 'error'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.split(',')[1] || '';
        const entrada = { nombre: file.name, estado: 'subiendo', previewDataUrl: dataUrl };
        fotosRegistro.unshift(entrada);
        renderFotosRegistro();
        backend('subirFoto', {
          token: sesion.token, dane_sede: daneActual, nombre: file.name,
          tipo_mime: file.type, contenido_base64: base64
        }).then(r => {
          if (r.ok) {
            olvidarFicha(daneActual);
            entrada.estado = 'subida'; entrada.id = r.id;
            entrada.nombre = r.nombre; entrada.tamano = r.tamano;
          } else {
            entrada.estado = 'error';
            avisar(`No se pudo subir «${file.name}»: ${r.error || 'error desconocido'}`, 'error');
          }
          renderFotosRegistro();
          sincronizarHechoRegistro();
        }).catch(() => {
          entrada.estado = 'error';
          renderFotosRegistro();
          sincronizarHechoRegistro();
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // El stepper es un lector de estado real, no una decoración fija: "hecho" sale
  // de si esa sección ya tiene algo que la sustente, no de un valor hardcodeado.
  function pintarIdentificacionRegistro(sede){
    const kv = document.getElementById('reg-ident-kv');
    if (!sede){ kv.innerHTML = '<dt>DANE sede</dt><dd>—</dd>'; return; }
    kv.innerHTML =
      `<dt>DANE sede</dt><dd class="dane">${esc(sede.dane_sede)}</dd>` +
      `<dt>Institución</dt><dd>${esc(sede.institucion || '—')}</dd>` +
      `<dt>Sede</dt><dd>${esc(sede.sede)}</dd>` +
      `<dt>Municipio</dt><dd>${esc(sede.municipio)}${sede.zona ? ' · zona ' + esc(String(sede.zona).toLowerCase()) : ''}</dd>` +
      `<dt>Matrícula</dt><dd class="n">${formatNum(sede.matricula, 0)} estudiante${Number(sede.matricula) === 1 ? '' : 's'}</dd>` +
      `<dt>Afectación (censo)</dt><dd>${tipoCensoHtml(sede)}</dd>`;
  }

  let regStepperListo = false;
  function iniciarStepperRegistrar(){
    if (regStepperListo) return;
    regStepperListo = true;
    const nav = document.getElementById('reg-stepper');
    const botones = [...nav.querySelectorAll('.pf')];

    botones.forEach(btn => btn.addEventListener('click', () => {
      const destino = document.getElementById(btn.dataset.goto);
      if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    // Scroll-spy manual en vez de IntersectionObserver con banda fija: la
    // sección 4 (Fotografías) es corta y, siendo la última, muchas veces no
    // alcanza a cruzar una banda central antes de que la página toque fondo
    // — con eso, un observer de banda fija la deja marcada como "no vista"
    // aunque esté en pantalla. Se marca activa la última sección cuyo borde
    // superior ya pasó la referencia (110px), y si se llegó al fondo de la
    // página, se fuerza la última sin importar el cálculo.
    const paneles = botones.map(btn => document.getElementById(btn.dataset.goto)).filter(Boolean);
    const REFERENCIA = 110;
    const actualizarActivo = () => {
      const alFondo = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let elegido = paneles[0];
      if (alFondo) {
        elegido = paneles[paneles.length - 1];
      } else {
        for (const p of paneles) if (p.getBoundingClientRect().top <= REFERENCIA) elegido = p;
      }
      botones.forEach(b => b.classList.toggle('act', document.getElementById(b.dataset.goto) === elegido));
    };
    window.addEventListener('scroll', actualizarActivo, { passive: true });
    actualizarActivo();
  }

  function sincronizarHechoRegistro(){
    const nav = document.getElementById('reg-stepper');
    const botones = [...nav.querySelectorAll('.pf')];
    const [b1, b2, b3, b4] = botones;
    b1.classList.add('hecho'); // 1 · Identificación: siempre viene resuelta del catálogo
    b2.classList.toggle('hecho', registro.declaraSinAfectacion
      ? (registro.descripcionAfectacion || '').trim().length >= 40
      : (registro.descripcionAfectacion || '').trim().length >= 60);
    b3.classList.toggle('hecho', registro.items.length > 0);
    const hayFoto = fotosRegistro.some(f => f.estado === 'subida');
    b4.classList.toggle('hecho', hayFoto);
    b4.title = hayFoto ? '' : 'Recomendado: adjunte al menos una fotografía como evidencia';
    pintarListaRegistro();
  }

  /* Lista «Antes de radicar» (hito 0, punto 4): las mismas reglas que
     guardarRegistroPresupuesto y Presupuestos_guardar exigen, dichas antes de
     pulsar Radicar. 'falta' bloquea la radicación; 'aviso' no bloquea (el
     servidor tampoco lo exige), solo recomienda. */
  function requisitosRegistro(){
    const declara = registro.declaraSinAfectacion;
    const lleva = (registro.descripcionAfectacion || '').trim().length;
    const req = [];
    if (declara) {
      req.push({ ir: 'reg-panel-2', estado: lleva >= 40 ? 'ok' : 'falta',
        texto: lleva >= 40 ? 'Justificación de «no presenta afectación»'
          : `Justificación de «no presenta afectación»: lleva ${lleva} de 40 caracteres` });
    } else {
      req.push({ ir: 'reg-panel-2', estado: lleva >= 60 ? 'ok' : 'falta',
        texto: lleva >= 60 ? 'Descripción de los daños'
          : `Descripción de los daños: lleva ${lleva} de 60 caracteres` });
      const n = registro.items.length;
      req.push({ ir: 'reg-panel-3', estado: n ? 'ok' : 'falta',
        texto: n ? `Presupuesto con ${n} ítem${n === 1 ? '' : 's'}` : 'Al menos un ítem en el presupuesto' });
      const incompletos = registro.items.filter(it => !String(it.descripcion || '').trim()
        || !(Number(it.cantidad) > 0) || !(Number(it.valor_unitario) > 0)).length;
      if (incompletos) req.push({ ir: 'reg-panel-3', estado: 'aviso',
        texto: `${incompletos} ítem${incompletos === 1 ? '' : 's'} sin trabajo descrito, sin cantidad o sin valor unitario` });
      if (registro.pctAdmin > ALERTA_ADMIN_PCT || registro.pctUtilidad > ALERTA_UTILIDAD_PCT)
        req.push({ ir: 'reg-alerta-au', estado: 'aviso',
          texto: `Administración ${formatNum(registro.pctAdmin, 0)} % y utilidad ${formatNum(registro.pctUtilidad, 0)} %: el sistema avisa sobre A ${ALERTA_ADMIN_PCT} % o U ${ALERTA_UTILIDAD_PCT} %. Se puede radicar, sustentándolo` });
      if (!(Number(registro.plazoDias) > 0))
        req.push({ ir: 'reg-alerta-au', estado: 'aviso', texto: 'Plazo de ejecución sin especificar' });
    }
    const nFotos = fotosRegistro.filter(f => f.estado === 'subida').length;
    req.push({ ir: 'reg-panel-4', estado: nFotos ? 'ok' : 'aviso',
      texto: nFotos ? `${nFotos} fotografía${nFotos === 1 ? '' : 's'} adjunta${nFotos === 1 ? '' : 's'}`
        : 'Sin fotografías: se recomienda al menos una como evidencia' });
    return req;
  }

  const MARCA_REQUISITO = { ok: ['✓', 'Hecho'], falta: ['!', 'Falta'], aviso: ['·', 'Recomendado'] };

  function pintarListaRegistro(){
    const ul = document.getElementById('reg-lista');
    if (!ul) return;
    const req = requisitosRegistro();
    ul.innerHTML = req.map(r => {
      const [marca, lectura] = MARCA_REQUISITO[r.estado];
      const contenido = `<span class="m" aria-hidden="true">${marca}</span><span class="sr">${lectura}: </span>${esc(r.texto)}`;
      return r.estado === 'ok' ? `<li class="r-ok">${contenido}</li>`
        : `<li class="r-${r.estado}"><button type="button" data-ir="${r.ir}">${contenido}</button></li>`;
    }).join('');
    const faltan = req.filter(r => r.estado === 'falta').length;
    const resumen = document.getElementById('reg-lista-resumen');
    resumen.className = 'est ' + (faltan ? 'e-rad' : 'e-apr');
    resumen.textContent = faltan ? `Falta${faltan === 1 ? '' : 'n'} ${faltan} para radicar` : 'Listo para radicar';
  }

  function pintarRegistrarReal(){
    const dane = daneActual;
    const sede = SEDES && SEDES.find(s => String(s.dane_sede) === String(dane));
    document.getElementById('reg-h2').textContent = sede ? `Presupuesto — ${sede.sede}` : 'Presupuesto';
    pintarIdentificacionRegistro(sede);
    iniciarStepperRegistrar();

    if (!registro.cargado){
      document.getElementById('reg-badge').textContent = 'Cargando…';
      document.getElementById('reg-lista').innerHTML = '';
      document.getElementById('reg-lista-resumen').textContent = '—';
      return;
    }

    const [cls, txt] = ESTADOS_PRESUPUESTO[registro.estadoActual] || ['e-pend', 'Sin diligenciar'];
    const badge = document.getElementById('reg-badge');
    badge.className = 'est ' + cls; badge.textContent = txt;
    document.getElementById('reg-eyebrow-estado').textContent = registro.borradorEnEspera
      ? `Vigente: v${registro.vigente.version} · borrador en espera: v${registro.borradorEnEspera.version}`
      : registro.versionActual ? `Última versión: v${registro.versionActual}` : 'Todavía sin guardar';

    const errBox = document.getElementById('reg-error');
    errBox.classList.toggle('oculto', !registro.error);
    if (registro.error) errBox.innerHTML = `<b>No se pudo confirmar si ya existe un presupuesto</b>${esc(registro.error)}`;

    if (sede){
      document.getElementById('reg-ayuda-tipo').innerHTML =
        `El censo la clasificó como <b>${esc(sede.tipo_censo || 'sin clasificar')}</b>. ` +
        'Si usted declara algo distinto, el sistema le pedirá justificarlo y lo marcará como discrepancia para que un arquitecto lo revise.';
    }

    document.getElementById('reg-af-si').checked = !registro.declaraSinAfectacion;
    document.getElementById('reg-af-no').checked = registro.declaraSinAfectacion;
    document.getElementById('reg-label-desc').textContent = registro.declaraSinAfectacion
      ? 'Justificación (mínimo 40 caracteres)' : 'Descripción de los daños';
    document.getElementById('reg-descripcion').value = registro.descripcionAfectacion;

    document.getElementById('reg-admin').value = formatNum(registro.pctAdmin, 0);
    document.getElementById('reg-utilidad').value = formatNum(registro.pctUtilidad, 0);
    document.getElementById('reg-plazo').value = registro.plazoDias ? formatNum(registro.plazoDias, 0) : '';

    renderItemsTabla();
    actualizarTotales();
    sincronizarHechoRegistro();

    const yaRadicado = ['RADICADO', 'EN_VERIFICACION', 'REQUIERE_AJUSTE', 'APROBADO'].indexOf(registro.estadoActual) !== -1;
    const siguiente = (Number(registro.versionActual) || 0) + 1;
    const esperaFecha = registro.borradorEnEspera && registro.borradorEnEspera.fecha
      ? ' del ' + new Date(registro.borradorEnEspera.fecha).toLocaleDateString('es-CO') : '';
    document.getElementById('reg-msg').innerHTML = registro.borradorEnEspera
      ? `Está retomando el <b>borrador v${registro.borradorEnEspera.version}</b>${esc(esperaFecha)}. La <b>v${registro.vigente.version} (${txt.toLowerCase()})</b> sigue vigente —y en la bandeja del arquitecto— hasta que radique. Guardar o radicar crea una <b>v${siguiente}</b>; nada se borra.`
      : yaRadicado
      ? `Esta sede ya tiene un presupuesto <b>${txt.toLowerCase()}</b> (v${registro.versionActual}). Un borrador queda <b>en espera</b> sin reemplazarlo; solo al radicar la <b>v${siguiente}</b> pasa a ser la vigente. La anterior no se borra.`
      : 'Al radicar ya no podrá editarlo con esta misma versión; si necesita corregir, se genera una <b>versión nueva</b> y la anterior queda como evidencia.';
  }

  function renderItemsTabla(){
    const tbody = document.querySelector('#s-registrar table.edit tbody');
    tbody.innerHTML = registro.items.map((it, i) => {
      const opcionesCap = Object.keys(CAPITULOS).map(n =>
        `<option value="${n}" ${String(it.capitulo) === n ? 'selected' : ''}>${n}. ${esc(CAPITULOS[n])}</option>`).join('');
      const opcionesUnidad = UNIDADES.map(u =>
        `<option ${it.unidad === u ? 'selected' : ''}>${esc(u)}</option>`).join('');
      return `<tr data-i="${i}">
        <td class="n">${i + 1}</td>
        <td><select data-f="capitulo" aria-label="Capítulo del ítem ${i + 1}">${opcionesCap}</select></td>
        <td><input data-f="descripcion" aria-label="Trabajo a ejecutar del ítem ${i + 1}" value="${esc(it.descripcion || '')}"></td>
        <td><select data-f="unidad" aria-label="Unidad del ítem ${i + 1}">${opcionesUnidad}</select></td>
        <td><input class="n" data-f="cantidad" aria-label="Cantidad del ítem ${i + 1}" inputmode="decimal" value="${formatNum(it.cantidad, 2)}"></td>
        <td><input class="n" data-f="valor_unitario" aria-label="Valor unitario del ítem ${i + 1}" inputmode="decimal" value="${formatNum(it.valor_unitario, 0)}"></td>
        <td class="n calc">${cop((Number(it.cantidad) || 0) * (Number(it.valor_unitario) || 0))}</td>
        <td><button class="quitar" type="button" data-quitar title="Quitar" aria-label="Quitar el ítem ${i + 1}">×</button></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      tr.querySelector('[data-f="capitulo"]').addEventListener('change', e => { registro.items[i].capitulo = e.target.value; });
      tr.querySelector('[data-f="descripcion"]').addEventListener('input', e => { registro.items[i].descripcion = e.target.value; pintarListaRegistro(); });
      tr.querySelector('[data-f="unidad"]').addEventListener('change', e => { registro.items[i].unidad = e.target.value; });
      const inCant = tr.querySelector('[data-f="cantidad"]');
      inCant.addEventListener('input', e => { registro.items[i].cantidad = parseCOP(e.target.value); actualizarFilaCalc(tr, i); });
      inCant.addEventListener('blur', e => { e.target.value = formatNum(registro.items[i].cantidad, 2); });
      const inVU = tr.querySelector('[data-f="valor_unitario"]');
      inVU.addEventListener('input', e => { registro.items[i].valor_unitario = parseCOP(e.target.value); actualizarFilaCalc(tr, i); });
      inVU.addEventListener('blur', e => { e.target.value = formatNum(registro.items[i].valor_unitario, 0); });
      tr.querySelector('[data-quitar]').addEventListener('click', () => {
        registro.items.splice(i, 1);
        renderItemsTabla();
        actualizarTotales();
        sincronizarHechoRegistro();
      });
    });
    document.getElementById('reg-eyebrow-items').textContent = `${registro.items.length} ítem${registro.items.length === 1 ? '' : 's'}`;
  }

  function actualizarFilaCalc(tr, i){
    const it = registro.items[i];
    tr.querySelector('.calc').textContent = cop((Number(it.cantidad) || 0) * (Number(it.valor_unitario) || 0));
    actualizarTotales();
  }

  // Mismo cálculo que Presupuestos_guardar (el servidor recalcula; esto es
  // lo que se muestra mientras se diligencia y en la revisión previa).
  function calcularTotales(){
    const costoDirecto = registro.items.reduce((a, it) => a + (Number(it.cantidad) || 0) * (Number(it.valor_unitario) || 0), 0);
    const valorAdmin = Math.round(costoDirecto * registro.pctAdmin / 100);
    const valorUtilidad = Math.round(costoDirecto * registro.pctUtilidad / 100);
    const valorIva = Math.round(valorUtilidad * 0.19); // Decreto 1372/1992 art. 3 — IVA sobre la utilidad (D-5)
    return { costoDirecto, valorAdmin, valorUtilidad, valorIva, total: costoDirecto + valorAdmin + valorUtilidad + valorIva };
  }

  function actualizarTotales(){
    registro.pctAdmin = parseCOP(document.getElementById('reg-admin').value);
    registro.pctUtilidad = parseCOP(document.getElementById('reg-utilidad').value);
    registro.plazoDias = parseCOP(document.getElementById('reg-plazo').value);

    const { costoDirecto, valorAdmin, valorUtilidad, valorIva, total } = calcularTotales();

    document.getElementById('reg-tot').innerHTML =
      `<dt>Costo directo</dt><dd class="n">${cop(costoDirecto)}</dd>` +
      `<dt>Administración <span class="pct">${formatNum(registro.pctAdmin, 0)} %</span></dt><dd class="n">${cop(valorAdmin)}</dd>` +
      `<dt>Utilidad <span class="pct">${formatNum(registro.pctUtilidad, 0)} %</span></dt><dd class="n">${cop(valorUtilidad)}</dd>` +
      `<dt>IVA 19 % sobre la utilidad</dt><dd class="n">${cop(valorIva)}</dd>` +
      `<dt class="gt">Total del presupuesto</dt><dd class="n gt">${cop(total)}</dd>`;

    const supera = registro.pctAdmin > ALERTA_ADMIN_PCT || registro.pctUtilidad > ALERTA_UTILIDAD_PCT;
    document.getElementById('reg-alerta-au').style.borderLeftColor = supera ? 'var(--err)' : '';
    pintarListaRegistro();
  }

  // Errores de validación junto al campo que hay que corregir, no en una
  // ventana: se ve qué falta sin perder de vista el formulario.
  function limpiarErroresRegistro(){
    document.querySelectorAll('#s-registrar .err-campo').forEach(e => { e.textContent = ''; e.classList.add('oculto'); });
  }
  function errorRegistro(id, texto){
    const el = document.getElementById(id);
    el.textContent = texto;
    el.classList.remove('oculto');
    el.closest('.p').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Revisión antes de radicar (patrón de "revise sus respuestas" de los
  // trámites de gobierno): lo que se va a enviar, en una sola vista.
  function revisarAntesDeRadicar(dane, declara){
    const sede = SEDES && SEDES.find(x => String(x.dane_sede) === String(dane));
    const t = calcularTotales();
    const nFotos = fotosRegistro.filter(f => f.estado === 'subida').length;
    const nueva = (Number(registro.versionActual) || 0) + 1;
    const html = `
      <dl class="kv">
        <dt>Sede</dt><dd>${esc(sede ? nombreSedeCorto(sede) : dane)}</dd>
        <dt>DANE</dt><dd class="dane">${esc(dane)}</dd>
        <dt>Declaración</dt><dd>${declara ? 'La sede <b>no</b> presenta afectación' : 'La sede presenta afectación'}</dd>
        ${declara ? '' : `
        <dt>Ítems</dt><dd>${registro.items.length}</dd>
        <dt>Costo directo</dt><dd class="n">${cop(t.costoDirecto)}</dd>
        <dt>Administración ${formatNum(registro.pctAdmin, 0)} %</dt><dd class="n">${cop(t.valorAdmin)}</dd>
        <dt>Utilidad ${formatNum(registro.pctUtilidad, 0)} %</dt><dd class="n">${cop(t.valorUtilidad)}</dd>
        <dt>IVA sobre la utilidad</dt><dd class="n">${cop(t.valorIva)}</dd>
        <dt><b>Total</b></dt><dd class="n"><b>${cop(t.total)}</b></dd>
        <dt>Plazo</dt><dd>${registro.plazoDias ? formatNum(registro.plazoDias, 0) + ' días' : 'sin especificar'}</dd>`}
        <dt>Fotografías</dt><dd>${nFotos}</dd>
      </dl>
      ${nFotos ? '' : '<p class="nota-dlg">No hay fotografías adjuntas. Se puede radicar, pero se recomienda al menos una como evidencia.</p>'}
      <p class="nota-dlg">Se radica como <b>v${nueva}</b>. Si después hay que corregir, se radica una versión nueva; esta no se borra.</p>`;
    return confirmar({ titulo: 'Revise antes de radicar', html, aceptar: 'Confirmar radicación' });
  }

  // Confirmación con número de radicado (patrón de página de confirmación).
  async function mostrarConfirmacionRadicado(dane, r){
    const fecha = r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleString('es-CO') : new Date().toLocaleString('es-CO');
    const correo = r.correo_confirmacion === true
      ? '<p class="nota-dlg">Le enviamos esta confirmación a su correo.</p>' : '';
    const v = await mostrarDialogo({
      titulo: 'Presupuesto radicado',
      html: `<div class="radicado-num">${esc(r.id_presupuesto || '')}</div>
        <dl class="kv">
          <dt>Fecha</dt><dd>${esc(fecha)}</dd>
          <dt>Total</dt><dd class="n"><b>${cop(r.total_presupuesto)}</b></dd>
        </dl>
        <p class="nota-dlg"><b>Qué sigue:</b> queda en la bandeja de verificación de la Secretaría.
          Cuando el arquitecto emita su concepto, lo verá en la ficha de la sede.</p>${correo}`,
      botones: [{ texto: 'Seguir aquí', valor: 'aqui', clase: 'sec' }, { texto: 'Ver ficha de la sede', valor: 'ficha' }],
    });
    if (v === 'ficha') irFicha(dane);
  }

  async function guardarRegistroPresupuesto(estadoDestino){
    const dane = daneActual;
    if (!dane) return;
    const declara = document.getElementById('reg-af-no').checked;
    const descripcion = document.getElementById('reg-descripcion').value.trim();
    limpiarErroresRegistro();

    if (estadoDestino === 'RADICADO'){
      if (!declara && registro.items.length === 0){
        errorRegistro('reg-err-items', 'Agregue al menos un ítem antes de radicar, o declare en la sección 2 que la sede no presenta afectación.');
        return;
      }
      if (declara && descripcion.length < 40){
        errorRegistro('reg-err-desc', `La justificación de «no presenta afectación» necesita mínimo 40 caracteres (lleva ${descripcion.length}).`);
        return;
      }
      if (!declara && descripcion.length < 60){
        errorRegistro('reg-err-desc', `La descripción de los daños necesita mínimo 60 caracteres (lleva ${descripcion.length}).`);
        return;
      }
      if (!(await revisarAntesDeRadicar(dane, declara))) return;
    }

    const btn = document.getElementById(estadoDestino === 'RADICADO' ? 'btn-radicar' : 'btn-guardar-borrador');
    const soltar = ocupar(btn, estadoDestino === 'RADICADO' ? 'Radicando…' : 'Guardando…');
    try {
      const r = await backend('guardarPresupuesto', {
        token: sesion.token, dane_sede: dane, estado: estadoDestino,
        declara_sin_afectacion: declara,
        descripcion_afectacion: declara ? '' : descripcion,
        justificacion_discrepancia: declara ? descripcion : '',
        items: registro.items,
        pct_admin: registro.pctAdmin, pct_utilidad: registro.pctUtilidad,
        plazo_dias: registro.plazoDias,
      });
      if (!r.ok){ avisar(r.error || 'No se pudo guardar.', 'error'); return; }
      sedesSucias = true;
      olvidarFicha(dane);
      await cargarRegistro(dane);
      pintarRegistrarReal();
      if (estadoDestino === 'RADICADO') mostrarConfirmacionRadicado(dane, r);
      else if (r.en_espera) avisar(`Borrador guardado como v${r.version}. La v${r.version_vigente} radicada sigue vigente hasta que radique este borrador.`, 'ok');
      else avisar(`Borrador guardado como v${r.version}. Todavía no está radicado.`, 'ok');
    } catch (err) {
      avisar('No se pudo contactar el servidor. Revise la ficha de la sede antes de volver a intentarlo.', 'error');
    } finally {
      soltar();
    }
  }

