/* app/js/arranque.js — Enrutador pintar(), eventos de la página y arranque. Siempre va de último.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  function pintar(){
    // Sin sesión no hay nada más que la pantalla de ingreso: todas las demás
    // dependen de datos que el backend solo entrega con un token válido.
    if (!sesion) vista = 'login';
    const R = ROLES[rol];
    if (vista !== 'login' && !R.ve.includes(vista)) vista = R.ve[0];
    const [mod, inner, migas] = RUTA[vista];

    const esLogin = vista === 'login';
    document.getElementById('v-login').classList.toggle('on', esLogin);
    document.getElementById('v-shell').classList.toggle('on', !esLogin);
    if (esLogin) { document.title = 'Ingresar — Reconstrucción de sedes'; return; }

    guardarLocal(CLAVE_VISTA, { vista, muniActual, daneActual, universoSel });
    aplicarVisibilidadRol(R);
    pintarRiel(R, mod);
    document.querySelectorAll('.lienzo > .view').forEach(s => s.classList.toggle('on', s.id === inner));

    document.getElementById('nomTx').textContent = R.nom || '';
    document.getElementById('av').textContent = R.ini || '';
    document.getElementById('av').classList.toggle('ext', R.ext);
    document.getElementById('rolTx').textContent = R.rot;
    document.getElementById('tituloSedes').textContent = R.interno ? 'Municipios' : 'Municipios de su alcance';
    const base = document.getElementById('riel-base');
    const conP = SEDES ? SEDES.filter(s => !!s.presupuesto).length : 0;
    base.textContent = !SEDES ? '' : (R.interno
      ? `${SEDES.length} sedes · ${conP} con presupuesto · ${lotesActivos().length} lote${lotesActivos().length === 1 ? '' : 's'} activo${lotesActivos().length === 1 ? '' : 's'}`
      : `${SEDES.length} sedes en su alcance · ${conP} con presupuesto`);

    let migasHtml = migas;
    if (vista === 'muni' && muniActual)
      migasHtml = `<a href="#" data-nav="sedes">Caldas</a><span class="sep">›</span><span class="hoy">${esc(muniActual)}</span>`;
    if (vista === 'ficha' && daneActual) migasHtml = migasSede(daneActual);
    if (vista === 'registrar' && daneActual) migasHtml = migasSede(daneActual, 'Presupuesto');
    document.getElementById('migas').innerHTML = migasHtml;

    pintarCabecera();
    actualizarBadgeVerifRiel();
    if (vista === 'tablero') { pintarTableroReal(); refrescarSedesSiHaceFalta(); }
    if (vista === 'lotes') { pintarLotesReal(); refrescarSedesSiHaceFalta(); }
    if (vista === 'inicio') { pintarInicioReal(); refrescarSedesSiHaceFalta(); }
    if (vista === 'sedes') { pintarSedesReal(); refrescarSedesSiHaceFalta(); }
    if (vista === 'muni') { pintarMuniReal(); refrescarSedesSiHaceFalta(); }
    if (vista === 'ficha') pintarFichaReal();
    if (vista === 'registrar') pintarRegistrarReal();
    // Colas de trabajo activas: se refrescan cada vez que se entra.
    if (vista === 'verif') { pintarVerificacionReal(); cargarBandejaVerificacion(); }
    if (vista === 'hallazgos') cargarHallazgos();
    if (vista === 'usuarios') cargarUsuarios();

    // Las tablas que se acaban de pintar crearon elementos [data-sed]/[data-edita]
    // nuevos que la pasada de arriba no vio — se reaplica el filtro de rol.
    aplicarVisibilidadRol(R);
  }

  /* Riel: solo las entradas que alcanza el rol (ROLES[rol].ve), y el rótulo
     de cada grupo solo si le queda alguna entrada visible. */
  function pintarRiel(R, mod){
    document.querySelectorAll('.riel a[data-mod]').forEach(a => {
      a.classList.toggle('oculto', !R.ve.includes(a.dataset.mod));
      a.classList.toggle('sel', a.dataset.mod === mod);
      if (a.dataset.mod === mod) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.riel .grupo').forEach(g => {
      let hay = false;
      for (let el = g.nextElementSibling; el && !el.classList.contains('grupo'); el = el.nextElementSibling)
        if (el.matches('a[data-mod]') && !el.classList.contains('oculto')) { hay = true; break; }
      g.classList.toggle('oculto', !hay);
    });
  }

  // Cierra la sesión en este navegador. El token sigue siendo válido hasta
  // que vence (12 h), pero deja de existir aquí: nadie más en este equipo
  // puede seguir usándolo desde la pantalla.
  function cerrarSesion(){
    borrarLocal();
    sesion = null; SEDES = null; ACTIVIDAD = []; VERIF = null;
    sedesCargadasEn = 0; sedesSucias = false; olvidarFicha();
    muniActual = null; daneActual = null;
    CARGA = null; cargaFilas = [];
    LOTES = []; universoSel = 'todas'; HALLAZGOS = null; hallazgosLeidosEn = 0; muniFiltro = 'todas'; loteSel = null; loteEd = null; cifrasAnimadas = false;
    document.getElementById('cod').value = '';
    loginVolver();
    vista = 'login';
    pintar();
  }

  // Riel de navegación: "Sedes" siempre vuelve al listado (sedes/muni/ficha/
  // registrar comparten el módulo 'sedes'), el resto entra directo.
  document.querySelectorAll('.riel a[data-mod]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (a.classList.contains('oculto')) return;
    vista = a.dataset.mod;
    if (vista === 'sedes' || vista === 'inicio') { muniActual = null; daneActual = null; }
    window.scrollTo(0, 0);
    pintar();
  }));
  // Migas dinámicas (Caldas › Municipio › Sede › Presupuesto), generadas en pintar().
  document.getElementById('migas').addEventListener('click', e => {
    const a = e.target.closest('a[data-nav]');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.nav === 'sedes') irSedes();
    else if (a.dataset.nav === 'muni') irMuni(a.dataset.muni);
    else if (a.dataset.nav === 'ficha') irFicha(a.dataset.dane);
  });

  // Registrar presupuesto (Paso 3): estos elementos son estáticos (no se
  // regeneran en cada pintada, a diferencia de las filas de ítems), así que
  // sus listeners se enganchan una sola vez acá.
  document.getElementById('btn-agregar-item').addEventListener('click', () => {
    registro.items.push({ capitulo: '1', descripcion: '', unidad: 'm²', cantidad: 0, valor_unitario: 0 });
    renderItemsTabla();
    actualizarTotales();
    sincronizarHechoRegistro();
  });
  document.getElementById('btn-guardar-borrador').addEventListener('click', () => guardarRegistroPresupuesto('BORRADOR'));
  document.getElementById('btn-radicar').addEventListener('click', () => guardarRegistroPresupuesto('RADICADO'));
  document.getElementById('reg-admin').addEventListener('input', actualizarTotales);
  document.getElementById('reg-utilidad').addEventListener('input', actualizarTotales);
  document.getElementById('reg-plazo').addEventListener('input', e => { registro.plazoDias = parseCOP(e.target.value); pintarListaRegistro(); });
  // Lista «Antes de radicar»: cada pendiente lleva a la sección donde se resuelve.
  document.getElementById('reg-lista').addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    const destino = b && document.getElementById(b.dataset.ir);
    if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('reg-descripcion').addEventListener('input', e => {
    registro.descripcionAfectacion = e.target.value;
    sincronizarHechoRegistro();
  });
  document.getElementById('reg-af-si').addEventListener('change', () => {
    registro.declaraSinAfectacion = false;
    document.getElementById('reg-label-desc').textContent = 'Descripción de los daños';
    sincronizarHechoRegistro();
  });
  document.getElementById('reg-af-no').addEventListener('change', () => {
    registro.declaraSinAfectacion = true;
    document.getElementById('reg-label-desc').textContent = 'Justificación (mínimo 40 caracteres)';
    sincronizarHechoRegistro();
  });
  // Fotos (D-29 sección 4): elegir por clic (el botón "Agregar" se reengancha
  // en cada renderFotosRegistro) o soltarlas sobre la cuadrícula.
  document.getElementById('reg-foto-input').addEventListener('change', e => {
    if (e.target.files.length) subirFotosSeleccionadas(e.target.files);
    e.target.value = '';
  });
  const regFotosLista = document.getElementById('reg-fotos-lista');
  regFotosLista.addEventListener('dragover', e => e.preventDefault());
  regFotosLista.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files.length) subirFotosSeleccionadas(e.dataTransfer.files);
  });

  // Cargas (Paso 5): elegir archivo por clic o soltarlo sobre la zona.
  document.getElementById('cargas-elegir').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('cargas-input').click();
  });
  document.getElementById('cargas-input').addEventListener('change', e => {
    if (e.target.files[0]) cargasLeerArchivo(e.target.files[0]);
  });
  const cargasDropzone = document.getElementById('cargas-dropzone');
  cargasDropzone.addEventListener('dragover', e => e.preventDefault());
  cargasDropzone.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) cargasLeerArchivo(e.dataTransfer.files[0]);
  });

  // Encabezado de vista
  document.getElementById('cab-lote').addEventListener('change', e => { universoSel = e.target.value; pintar(); });
  document.getElementById('ini-tablero').addEventListener('click', () => { vista = 'tablero'; window.scrollTo(0, 0); pintar(); });
  // Filtros de la tabla de un municipio (D-46).
  document.getElementById('muni-filtros').addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    muniFiltro = b.dataset.filtro;
    pintarMuniReal();
    aplicarVisibilidadRol(ROLES[rol]);
  });
  document.getElementById('cab-exportar').addEventListener('click', exportarVista);
  document.getElementById('cab-actualizar').addEventListener('click', actualizarVista);

  // Saltar al contenido (CC10): lleva el foco al área principal sin cambiar la URL.
  document.querySelector('.saltar').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('contenido').focus();
  });

  // Precarga de la Ficha: cualquier elemento que lleve a una sede declara su
  // DANE en data-dane (o data-ficha). Se pide cuando el cursor se queda
  // PRECARGA_ESPERA_MS sobre él, o de una vez cuando le llega el foco con teclado.
  let precargaDane = null, precargaReloj = null;
  document.addEventListener('pointerover', e => {
    const el = e.target.closest('[data-dane],[data-ficha]');
    const dane = el ? (el.dataset.dane || el.dataset.ficha) : null;
    if (dane === precargaDane) return;
    precargaDane = dane;
    clearTimeout(precargaReloj);
    if (dane) precargaReloj = setTimeout(() => precargarFicha(dane), PRECARGA_ESPERA_MS);
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest('[data-dane],[data-ficha]');
    if (el) precargarFicha(el.dataset.dane || el.dataset.ficha);
  });

  // Lotes
  document.getElementById('lotes-btn-crear').addEventListener('click', () => nuevoEditorLote('crear'));
  document.getElementById('lote-btn-agregar').addEventListener('click', () => nuevoEditorLote('agregar'));
  document.getElementById('lote-btn-cerrar').addEventListener('click', cerrarLoteUI);
  document.getElementById('lote-btn-exportar').addEventListener('click', () => {
    const l = LOTES.find(x => x.id_lote === loteSel);
    if (l) descargarCSV(`lote_${slug(l.nombre)}_${hoyArchivo()}.csv`, ENC_SEDES_CSV, filasSedesCSV(sedesDeLote(l.id_lote)));
  });
  document.getElementById('lote-det-tbody').addEventListener('click', e => {
    const q = e.target.closest('[data-quitar]');
    if (q){ e.stopPropagation(); quitarSedeDeLote(q.dataset.quitar, q); return; }
    const tr = e.target.closest('[data-ficha]');
    if (tr) irFicha(tr.dataset.ficha);
  });
  const filtrosLote = { 'lote-f-muni': 'muni', 'lote-f-tipo': 'tipo', 'lote-f-pres': 'pres', 'lote-f-lote': 'lote' };
  Object.keys(filtrosLote).forEach(id => document.getElementById(id).addEventListener('change', e => {
    if (loteEd){ loteEd.f[filtrosLote[id]] = e.target.value; pintarEditorLote(); }
  }));
  let relojFiltroLote = null;
  document.getElementById('lote-f-texto').addEventListener('input', e => {
    clearTimeout(relojFiltroLote);
    relojFiltroLote = setTimeout(() => { if (loteEd){ loteEd.f.texto = e.target.value; pintarEditorLote(); } }, 150);
  });
  document.getElementById('lote-f-atajo').addEventListener('click', () => {
    if (!loteEd) return;
    loteEd.f.tipo = '12'; document.getElementById('lote-f-tipo').value = '12';
    sedesFiltradasLote().forEach(s => loteEd.sel.add(String(s.dane_sede)));
    pintarEditorLote();
  });
  document.getElementById('lote-f-todas').addEventListener('click', () => {
    if (!loteEd) return;
    sedesFiltradasLote().forEach(s => loteEd.sel.add(String(s.dane_sede)));
    pintarEditorLote();
  });
  document.getElementById('lote-f-limpiar').addEventListener('click', () => { if (loteEd){ loteEd.sel.clear(); pintarEditorLote(); } });
  document.getElementById('lote-ed-tbody').addEventListener('change', e => {
    const c = e.target.closest('[data-sel]');
    if (!c || !loteEd) return;
    if (c.checked) loteEd.sel.add(c.dataset.sel); else loteEd.sel.delete(c.dataset.sel);
    pintarEditorLote();
  });
  document.getElementById('lote-ed-cancelar').addEventListener('click', () => { loteEd = null; pintarLotesReal(); });
  document.getElementById('lote-ed-guardar').addEventListener('click', guardarEditorLote);

  // Buscador
  const busca = document.getElementById('busca');
  busca.addEventListener('input', () => { buscaActivo = -1; pintarBusqueda(); });
  busca.addEventListener('keydown', e => {
    const items = [...document.querySelectorAll('#busca-res .busca-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      if (!items.length) return;
      buscaActivo = (buscaActivo + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      pintarBusqueda();
    } else if (e.key === 'Enter'){
      const it = items[Math.max(0, buscaActivo)];
      if (it) elegirBusqueda(it.dataset.dane);
    } else if (e.key === 'Escape'){
      busca.value = ''; pintarBusqueda();
    }
  });
  document.getElementById('busca-res').addEventListener('mousedown', e => {
    const it = e.target.closest('.busca-item');
    if (it){ e.preventDefault(); elegirBusqueda(it.dataset.dane); }
  });
  busca.addEventListener('blur', () => setTimeout(() => {
    document.getElementById('busca-res').classList.add('oculto');
    busca.setAttribute('aria-expanded', 'false');
  }, 120));

  // Menú en celular: el riel se abre como panel lateral.
  const btnMenu = document.getElementById('btn-menu');
  const cerrarMenu = () => { document.querySelector('.shell').classList.remove('menu-abierto'); btnMenu.setAttribute('aria-expanded', 'false'); };
  btnMenu.addEventListener('click', () => {
    const abierto = document.querySelector('.shell').classList.toggle('menu-abierto');
    btnMenu.setAttribute('aria-expanded', String(abierto));
  });
  document.querySelectorAll('.riel a[data-mod]').forEach(a => a.addEventListener('click', cerrarMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
  document.addEventListener('click', e => {
    if (document.querySelector('.shell').classList.contains('menu-abierto') &&
        !e.target.closest('#riel') && !e.target.closest('#btn-menu')) cerrarMenu();
  });

  // Enter en los campos de ingreso = el botón de cada paso.
  document.getElementById('u').addEventListener('keydown', e => { if (e.key === 'Enter') loginEnviarCodigo(); });
  document.getElementById('cod').addEventListener('keydown', e => { if (e.key === 'Enter') loginEntrar(); });

  // Arranque: si hay una sesión guardada en esta pestaña y no ha vencido, se
  // retoma donde estaba; si no, pantalla de ingreso.
  if (restaurarSesion()){
    pintar();
    if (vista === 'registrar' && daneActual) cargarRegistro(daneActual);
    cargarSedes().then(() => pintar());
  } else {
    pintar();
  }
