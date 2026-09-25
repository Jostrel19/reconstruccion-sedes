/* app/js/cabecera.js — Encabezado de cada vista.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Encabezado de vista: título, contexto, selector de lote y acciones ─── */
  const TITULO_VISTA = { inicio: 'Inicio', tablero: 'Tablero', verif: 'Verificación técnica', cargas: 'Cargas', lotes: 'Lotes',
    hallazgos: 'Hallazgos', usuarios: 'Usuarios y roles', registrar: 'Registrar presupuesto', ficha: 'Ficha de sede' };
  const CONTEXTO_VISTA = {
    verif: 'Presupuestos radicados de todo el departamento, esperando o con concepto.',
    cargas: 'Suba el resultado del lector de Excel de una alcaldía y confirme qué se vuelca.',
    lotes: 'Grupos de sedes para organizar el seguimiento por fases.',
    hallazgos: 'Inconsistencias detectadas al radicar o cargar; se resuelven confirmando el dato real.',
    usuarios: 'Quién entra al sistema y con qué alcance.',
  };

  /* D-46: el selector dice sobre qué sedes se cuenta. Todas las del alcance,
     las que tienen daño reportado en el censo, o un lote (solo roles internos). */
  function pintarSelectorUniverso(){
    const sel = document.getElementById('cab-lote');
    const todas = SEDES ? SEDES.length : 0, dano = SEDES ? SEDES.filter(conDano).length : 0;
    let html = `<option value="todas">Todas las sedes (${todas})</option>` +
      `<option value="dano">Con daño reportado, tipos 1 a 4 (${dano})</option>`;
    if (ROLES[rol].interno && LOTES.length){
      const n = id => sedesDeLote(id).length;
      const act = LOTES.filter(l => l.activo), cer = LOTES.filter(l => !l.activo);
      if (act.length) html += `<optgroup label="Lotes activos">${act.map(l => `<option value="${esc(l.id_lote)}">${esc(l.nombre)} (${n(l.id_lote)})</option>`).join('')}</optgroup>`;
      if (cer.length) html += `<optgroup label="Lotes cerrados">${cer.map(l => `<option value="${esc(l.id_lote)}">${esc(l.nombre)} (${n(l.id_lote)})</option>`).join('')}</optgroup>`;
    }
    sel.innerHTML = html;
    if (![...sel.options].some(o => o.value === universoSel)) universoSel = 'todas';
    sel.value = universoSel;
  }

  function pintarCabecera(){
    const R = ROLES[rol];
    const conSedes = ['tablero', 'sedes', 'muni'].includes(vista);
    let titulo = TITULO_VISTA[vista] || '';
    let contexto = CONTEXTO_VISTA[vista] || '';
    if (vista === 'sedes') titulo = R.interno ? 'Sedes' : 'Mis sedes';
    if (vista === 'muni') titulo = muniActual || 'Municipio';
    if (vista === 'inicio'){
      // Los nombres de Usuarios vienen en mayúsculas: «ANA MARÍA» → «Hola, Ana».
      const nombre = (R.nom || '').trim().split(/\s+/)[0] || '';
      titulo = nombre ? `Hola, ${nombre.charAt(0)}${nombre.slice(1).toLowerCase()}` : 'Inicio';
      contexto = !SEDES ? 'Consultando el servidor…' : `${R.rot} · datos de ${hace(sedesCargadasEn ? new Date(sedesCargadasEn) : null)}`;
    }
    const s = (vista === 'ficha' || vista === 'registrar') && SEDES && SEDES.find(x => String(x.dane_sede) === String(daneActual));
    if (s) contexto = `${s.municipio} · DANE ${s.dane_sede}`;
    if (conSedes){
      contexto = !SEDES ? 'Consultando el servidor…'
        : `${universo().length} sede${universo().length === 1 ? '' : 's'} · datos de ${hace(sedesCargadasEn ? new Date(sedesCargadasEn) : null)}`;
    }
    document.getElementById('cab-titulo').textContent = titulo;
    // Título de la pestaña con la pantalla actual (CC23, WCAG 2.4.2): «Pantalla — sitio».
    document.title = (vista === 'inicio' ? 'Inicio' : titulo || '') + (titulo ? ' — ' : '') + 'Reconstrucción de sedes';
    document.getElementById('cab-contexto').textContent = contexto;
    document.getElementById('cab-lote-caja').classList.toggle('oculto', !conSedes);
    if (conSedes) pintarSelectorUniverso();
    document.getElementById('cab-exportar').classList.toggle('oculto', !((conSedes && SEDES) || (vista === 'verif' && VERIF && VERIF.length)));
    document.getElementById('cab-actualizar').classList.toggle('oculto',
      !(conSedes || ['inicio', 'verif', 'hallazgos', 'usuarios', 'lotes', 'ficha'].includes(vista)));
  }

  async function actualizarVista(){
    const soltar = ocupar(document.getElementById('cab-actualizar'), 'Actualizando…');
    try {
      if (vista === 'verif') await cargarBandejaVerificacion();
      else if (vista === 'hallazgos') await cargarHallazgos();
      else if (vista === 'usuarios') await cargarUsuarios();
      else {
        if (vista === 'inicio') hallazgosLeidosEn = 0; // Inicio también vuelve a contar hallazgos
        olvidarFicha(); // «Actualizar» en la Ficha vuelve a pedir el detalle
        sedesSucias = true; await cargarSedes(); pintar();
      }
    } finally { soltar(); }
  }

