/* app/js/lotes.js — Lotes (D-44, solo Administrador).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Lotes (D-44): solo Administrador. Crear, agregar sedes (con filtros
     sobre el catálogo que ya está en memoria), quitar y cerrar. Todo pasa
     por backend/Lotes.gs, que vuelve a validar cada DANE. ─── */
  let loteSel = null;      // id del lote abierto en el detalle
  let loteEd = null;       // null | { modo: 'crear' | 'agregar', id_lote, sel: Set<dane> }
  const LOTE_FILAS_MAX = 300;

  function irLotes(){ vista = 'lotes'; pintar(); }
  const sedesDeLote = id => (SEDES || []).filter(s => s.lote && s.lote.id_lote === id);

  /* Después de crear, agregar, quitar o cerrar, el cambio se aplica en la
     memoria del navegador en vez de volver a pedir las 975 sedes (hito 0,
     punto 6): cada operación tardaba lo que tarda listarSedes. Es exacto porque
     backend/Lotes.gs es todo o nada — si un DANE es inválido rechaza la
     operación completa — y devuelve el id del lote: toda sede enviada queda en
     ese lote (las que estaban en otro se mueven, D-44). Lo que cambie otra
     persona llega con el refresco normal de sedes. */
  function ponerSedesEnLote(danes, lote){
    const ids = new Set(danes.map(String));
    (SEDES || []).forEach(s => {
      if (ids.has(String(s.dane_sede))) s.lote = { id_lote: lote.id_lote, nombre: lote.nombre, activo: true };
    });
  }

  function pintarLotesReal(){
    const tbody = document.getElementById('lotes-tbody');
    if (!SEDES){ tbody.innerHTML = filasEsqueleto(7, 3); return; }
    if (!LOTES.length){
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--tx-sec);padding:1.2rem">Todavía no hay lotes. Cree el primero con «+ Crear lote».</td></tr>';
    } else {
      tbody.innerHTML = LOTES.slice().sort((a, b) => (b.activo - a.activo) || String(a.id_lote).localeCompare(String(b.id_lote), 'es', { numeric: true })).map(l => {
        const sedes = sedesDeLote(l.id_lote);
        const valor = sedes.reduce((a, s) => a + valorRadicado(s), 0);
        return `<tr class="click${loteSel === l.id_lote ? ' sel' : ''}" data-lote="${esc(l.id_lote)}" tabindex="0">
          <td><strong>${esc(l.nombre)}</strong>${l.descripcion ? `<br><span class="hace">${esc(l.descripcion)}</span>` : ''}</td>
          <td class="n">${sedes.length}</td><td class="n">${sedes.filter(radicada).length}</td>
          <td class="n">${sedes.filter(s => estadoDe(s) === 'APROBADO').length}</td><td class="n">${esc(cop(valor))}</td>
          <td class="hace">${esc(l.creado_por || '')}<br>${l.fecha_creacion ? esc(new Date(l.fecha_creacion).toLocaleDateString('es-CO')) : ''}</td>
          <td><span class="est ${l.activo ? 'e-apr' : 'e-pend'}">${l.activo ? 'Activo' : 'Cerrado'}</span></td></tr>`;
      }).join('');
      tbody.querySelectorAll('tr[data-lote]').forEach(tr => {
        const abrir = () => { loteSel = tr.dataset.lote; loteEd = null; pintarLotesReal(); document.getElementById('lote-detalle').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        tr.addEventListener('click', abrir);
        tr.addEventListener('keydown', e => { if (e.key === 'Enter') abrir(); });
      });
    }
    pintarDetalleLote();
    pintarEditorLote();
  }

  function pintarDetalleLote(){
    const panel = document.getElementById('lote-detalle');
    const l = LOTES.find(x => x.id_lote === loteSel);
    panel.classList.toggle('oculto', !l || !!loteEd);
    if (!l || loteEd) return;
    const sedes = sedesDeLote(l.id_lote);
    document.getElementById('lote-det-nombre').textContent = l.nombre;
    const est = document.getElementById('lote-det-estado');
    est.className = 'est ' + (l.activo ? 'e-apr' : 'e-pend'); est.textContent = l.activo ? 'Activo' : 'Cerrado';
    document.getElementById('lote-det-desc').textContent = l.descripcion || '';
    document.getElementById('lote-btn-agregar').classList.toggle('oculto', !l.activo);
    document.getElementById('lote-btn-cerrar').classList.toggle('oculto', !l.activo);
    const c = conteoGrupos(sedes);
    document.getElementById('lote-det-cifras').innerHTML =
      `<div class="cifra"><b class="n">${sedes.length}</b><span>Sedes</span></div>` +
      `<div class="cifra"><b class="n">${sedes.filter(radicada).length}</b><span>Radicadas</span></div>` +
      `<div class="cifra al"><b class="n">${sedes.filter(s => estadoDe(s) === 'RADICADO').length}</b><span>Esperando verificación</span></div>` +
      `<div class="cifra ok"><b class="n">${c.apr}</b><span>Aprobadas</span></div>` +
      `<div class="cifra"><b class="n">${esc(cop(sedes.reduce((a, s) => a + valorRadicado(s), 0)))}</b><span>Valor radicado</span></div>`;
    const orden = { curso: 0, pend: 1, apr: 2 };
    document.getElementById('lote-det-tbody').innerHTML = sedes.length
      ? sedes.slice().sort((a, b) => String(a.municipio).localeCompare(String(b.municipio)) || orden[grupoDe(a)] - orden[grupoDe(b)]).map(s => `
        <tr class="click" data-ficha="${esc(s.dane_sede)}"><td>${esc(nombreSedeCorto(s))}<br><span class="dane">${esc(s.dane_sede)}</span></td>
          <td>${esc(s.municipio)}</td><td>${tipoChip(s)}</td>
          <td class="n">${s.presupuesto ? esc(cop(s.presupuesto.total_presupuesto)) : '—'}</td><td>${estadoBadge(s)}</td>
          <td>${l.activo ? `<button class="quitar" type="button" data-quitar="${esc(s.dane_sede)}" title="Quitar del lote" aria-label="Quitar ${esc(nombreSedeCorto(s))} del lote">×</button>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--tx-sec);padding:1rem">Este lote no tiene sedes. Agréguelas con «+ Agregar sedes».</td></tr>';
    document.getElementById('lote-det-pie').textContent = l.activo
      ? 'Quitar una sede del lote no borra nada: queda el registro de que estuvo en él.'
      : 'Lote cerrado: sus sedes se conservan como registro de esta fase. Se puede seguir consultando en el selector «Contar sobre», en Lotes cerrados.';
  }

  function nuevoEditorLote(modo){
    loteEd = { modo, id_lote: modo === 'agregar' ? loteSel : null, sel: new Set(),
      f: { muni: '', tipo: '', pres: '', lote: '', texto: '' } };
    document.getElementById('lote-ed-nombre').value = '';
    document.getElementById('lote-ed-desc').value = '';
    ['lote-f-muni', 'lote-f-tipo', 'lote-f-pres', 'lote-f-lote', 'lote-f-texto'].forEach(id => { document.getElementById(id).value = ''; });
    pintarLotesReal();
    document.getElementById('lote-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (modo === 'crear') document.getElementById('lote-ed-nombre').focus();
  }

  function sedesFiltradasLote(){
    const f = loteEd.f;
    const palabras = normalizar(f.texto).split(/\s+/).filter(Boolean);
    return (SEDES || []).filter(s => {
      if (loteEd.modo === 'agregar' && s.lote && s.lote.id_lote === loteEd.id_lote) return false;
      if (f.muni && s.municipio !== f.muni) return false;
      const t = tipoNum(s);
      if (f.tipo === '12' && t !== 1 && t !== 2) return false;
      if (f.tipo && f.tipo !== '12' && String(t) !== f.tipo) return false;
      if (f.pres === 'con' && !s.presupuesto) return false;
      if (f.pres === 'sin' && s.presupuesto) return false;
      if (f.lote === 'sin' && enLoteActivo(s)) return false;
      if (f.lote === 'con' && !enLoteActivo(s)) return false;
      if (palabras.length){
        const texto = normalizar(`${s.dane_sede} ${s.institucion} ${s.sede} ${s.municipio}`);
        if (!palabras.every(w => texto.includes(w))) return false;
      }
      return true;
    }).sort((a, b) => String(a.municipio).localeCompare(String(b.municipio)) || tipoNum(a) - tipoNum(b));
  }

  function pintarEditorLote(){
    const panel = document.getElementById('lote-editor');
    panel.classList.toggle('oculto', !loteEd);
    if (!loteEd) return;
    const crear = loteEd.modo === 'crear';
    const l = LOTES.find(x => x.id_lote === loteEd.id_lote);
    document.getElementById('lote-ed-titulo').textContent = crear ? 'Crear lote' : `Agregar sedes a «${l ? l.nombre : ''}»`;
    document.getElementById('lote-ed-datos').classList.toggle('oculto', !crear);
    const selMuni = document.getElementById('lote-f-muni');
    if (!selMuni.options.length){
      selMuni.innerHTML = '<option value="">Todos</option>' +
        [...new Set((SEDES || []).map(s => s.municipio))].sort((a, b) => String(a).localeCompare(String(b))).map(m => `<option>${esc(m)}</option>`).join('');
    }
    const filtradas = sedesFiltradasLote();
    const visibles = filtradas.slice(0, LOTE_FILAS_MAX);
    document.getElementById('lote-ed-conteo').textContent =
      `${filtradas.length} sede${filtradas.length === 1 ? '' : 's'} con estos filtros` +
      (filtradas.length > LOTE_FILAS_MAX ? ` · se muestran ${LOTE_FILAS_MAX}` : '');
    document.getElementById('lote-f-todas').textContent = `Seleccionar las ${filtradas.length} filtradas`;
    document.getElementById('lote-ed-tbody').innerHTML = visibles.length ? visibles.map(s => {
      const d = String(s.dane_sede);
      const otro = s.lote && s.lote.activo ? `<span class="ctr" title="Si la agrega, se mueve a este lote">en «${esc(s.lote.nombre)}»</span>` : '<span class="ctr">sin lote</span>';
      return `<tr><td><input type="checkbox" data-sel="${esc(d)}" ${loteEd.sel.has(d) ? 'checked' : ''} aria-label="Seleccionar ${esc(nombreSedeCorto(s))}"></td>
        <td>${esc(nombreSedeCorto(s))}</td><td class="dane">${esc(d)}</td><td>${esc(s.municipio)}</td>
        <td>${tipoChip(s)}</td><td>${otro}</td><td>${estadoBadge(s)}</td></tr>`;
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--tx-sec);padding:1rem">Ninguna sede cumple estos filtros.</td></tr>';
    const n = loteEd.sel.size;
    const mueve = [...loteEd.sel].filter(d => { const s = SEDES.find(x => String(x.dane_sede) === d); return s && enLoteActivo(s); }).length;
    document.getElementById('lote-ed-resumen').innerHTML = `<b>${n}</b> sede${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}` +
      (mueve ? ` · ${mueve} ya está${mueve === 1 ? '' : 'n'} en otro lote y se moverá${mueve === 1 ? '' : 'n'}` : '');
    const guardar = document.getElementById('lote-ed-guardar');
    guardar.textContent = crear ? (n ? `Crear lote con ${n} sede${n === 1 ? '' : 's'}` : 'Crear lote vacío') : `Agregar ${n} sede${n === 1 ? '' : 's'}`;
    guardar.disabled = !crear && !n;
  }

  async function guardarEditorLote(){
    const crear = loteEd.modo === 'crear';
    const danes = [...loteEd.sel];
    let cuerpo, accion;
    if (crear){
      const nombre = document.getElementById('lote-ed-nombre').value.trim();
      if (!nombre){ avisar('Póngale un nombre al lote.', 'error'); document.getElementById('lote-ed-nombre').focus(); return; }
      accion = 'crearLote';
      cuerpo = { token: sesion.token, nombre, descripcion: document.getElementById('lote-ed-desc').value.trim(), danes };
    } else {
      accion = 'agregarSedesLote';
      cuerpo = { token: sesion.token, id_lote: loteEd.id_lote, danes };
    }
    const soltar = ocupar(document.getElementById('lote-ed-guardar'), crear ? 'Creando…' : 'Agregando…');
    try {
      const r = await backend(accion, cuerpo);
      if (!r.ok){ avisar(r.error || 'No se pudo guardar el lote.', 'error'); soltar(); return; }
      const movidas = (r.movidas || []).length;
      avisar((crear ? `Lote creado con ${r.agregadas} sede${r.agregadas === 1 ? '' : 's'}` : `${r.agregadas} sede${r.agregadas === 1 ? '' : 's'} agregada${r.agregadas === 1 ? '' : 's'}`) +
        (movidas ? `; ${movidas} se movieron desde otro lote.` : '.'), 'ok');
      if (crear){
        LOTES.push({ id_lote: r.id_lote, nombre: cuerpo.nombre, descripcion: cuerpo.descripcion,
          creado_por: sesion.correo, fecha_creacion: new Date().toISOString(), activo: true });
      }
      const lote = LOTES.find(x => x.id_lote === r.id_lote);
      if (lote) ponerSedesEnLote(danes, lote);
      else sedesSucias = true; // no debería pasar; si pasa, se recarga todo en la próxima pintada
      loteSel = r.id_lote; loteEd = null;
      soltar();
      pintar();
    } catch (err) { avisar('No se pudo contactar el servidor. Revise la lista de lotes antes de reintentar.', 'error'); soltar(); }
  }

  async function quitarSedeDeLote(dane, btn){
    const l = LOTES.find(x => x.id_lote === loteSel);
    const s = SEDES.find(x => String(x.dane_sede) === String(dane));
    const ok = await confirmar({ titulo: 'Quitar sede del lote',
      html: `<p class="nota-dlg">¿Quitar <b>${esc(s ? nombreSedeCorto(s) : dane)}</b> de «${esc(l ? l.nombre : '')}»? Queda el registro de que estuvo en el lote. Su presupuesto no cambia.</p>`,
      aceptar: 'Quitar del lote' });
    if (!ok) return;
    const soltar = ocupar(btn, '…');
    try {
      const r = await backend('quitarSedeLote', { token: sesion.token, id_lote: loteSel, dane_sede: String(dane) });
      if (!r.ok){ avisar(r.error || 'No se pudo quitar.', 'error'); soltar(); return; }
      avisar('Sede quitada del lote.', 'ok');
      if (s) s.lote = null;
      pintar();
    } catch (err) { avisar('No se pudo contactar el servidor.', 'error'); soltar(); }
  }

  async function cerrarLoteUI(){
    const l = LOTES.find(x => x.id_lote === loteSel);
    if (!l) return;
    const ok = await confirmar({ titulo: 'Cerrar lote',
      html: `<p class="nota-dlg">¿Cerrar «<b>${esc(l.nombre)}</b>»? Sus ${sedesDeLote(l.id_lote).length} sedes se conservan como registro de esta fase y el lote sigue consultable como «cerrado». No cambia ningún presupuesto. No se puede reabrir.</p>`,
      aceptar: 'Cerrar lote', peligro: true });
    if (!ok) return;
    const soltar = ocupar(document.getElementById('lote-btn-cerrar'), 'Cerrando…');
    try {
      const r = await backend('cerrarLote', { token: sesion.token, id_lote: l.id_lote });
      if (!r.ok){ avisar(r.error || 'No se pudo cerrar.', 'error'); soltar(); return; }
      avisar(`Lote «${l.nombre}» cerrado.`, 'ok');
      if (universoSel === l.id_lote) universoSel = 'todas';
      // Cerrado, el lote conserva sus sedes como registro de la fase (Lotes.gs::_loteDeCadaSede).
      l.activo = false;
      sedesDeLote(l.id_lote).forEach(x => { x.lote = { id_lote: l.id_lote, nombre: l.nombre, activo: false }; });
      soltar();
      pintar();
    } catch (err) { avisar('No se pudo contactar el servidor.', 'error'); soltar(); }
  }

