/* app/js/hallazgos.js — Hallazgos (Administrador y Verificador).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  // Antes las 19 filas venían escritas a mano en el HTML (8 de ejemplo, sin
  // backend detrás) y "Marcar resuelto" no llamaba a nada. Ahora se lee la
  // pestaña Hallazgos real (sembrada una vez con sembrarHallazgosIniciales,
  // backend/Hallazgos.gs) y el botón sí resuelve, con el mismo patrón de
  // "cola de trabajo que se refresca" que ya usa Verificación.
  async function cargarHallazgos(){
    const cont = document.getElementById('hallazgos-lista');
    let r;
    try { r = await backend('listarHallazgos', { token: sesion.token }); }
    catch (err) { cont.innerHTML = '<p style="color:var(--err);font-size:.85rem;margin:0">No se pudo contactar el servidor.</p>'; return; }
    if (vista !== 'hallazgos') return;
    if (!r.ok){
      cont.innerHTML = `<p style="color:var(--err);font-size:.85rem;margin:0">${esc(r.error || 'No se pudo cargar Hallazgos.')}</p>`;
      return;
    }
    HALLAZGOS = r.hallazgos || []; hallazgosLeidosEn = Date.now();
    pintarHallazgosReal(HALLAZGOS);
    actualizarBadgeHallazgosRiel(HALLAZGOS);
  }

  // Antes el "19" del riel era un número fijo escrito en el HTML — mismo
  // defecto que tenía el badge de Verificación antes de actualizarBadgeVerifRiel().
  // Cuenta solo los ERROR abiertos (los que de verdad bloquean un cruce), no
  // los informativos, para que el número no espante por cosas que no urgen.
  function actualizarBadgeHallazgosRiel(hallazgos){
    const el = document.getElementById('riel-cand-hallazgos');
    if (!el) return;
    const pendientes = hallazgos.filter(h => h.estado === 'ABIERTO' && h.severidad === 'ERROR').length;
    el.textContent = String(pendientes);
    el.classList.toggle('oculto', pendientes === 0);
  }

  function pintarHallazgosReal(hallazgos){
    const abiertos = hallazgos.filter(h => h.estado === 'ABIERTO');
    const error = abiertos.filter(h => h.severidad === 'ERROR').length;
    const advertencia = abiertos.filter(h => h.severidad === 'ADVERTENCIA').length;
    const resueltos = hallazgos.length - abiertos.length;
    document.getElementById('hallazgos-n-abiertos').textContent = abiertos.length;
    document.getElementById('hallazgos-n-error').textContent = error;
    document.getElementById('hallazgos-n-advertencia').textContent = advertencia;
    document.getElementById('hallazgos-n-resueltos').textContent = resueltos;

    const cont = document.getElementById('hallazgos-lista');
    if (hallazgos.length === 0){
      cont.innerHTML = '<p style="color:var(--tx-sec);font-size:.85rem;margin:0">Sin hallazgos registrados.</p>';
      return;
    }
    // Abiertos primero (severos antes que informativos), resueltos al final.
    const orden = { ERROR: 0, ADVERTENCIA: 1 };
    const ordenados = [...hallazgos].sort((a, b) => {
      if ((a.estado === 'RESUELTO') !== (b.estado === 'RESUELTO')) return a.estado === 'RESUELTO' ? 1 : -1;
      return (orden[a.severidad] ?? 2) - (orden[b.severidad] ?? 2);
    });
    cont.innerHTML = ordenados.map(h => {
      const resuelto = h.estado === 'RESUELTO';
      const sig = resuelto ? 'cerr' : (h.severidad === 'ERROR' ? 'hall' : 'cerr');
      const marca = resuelto ? '✓' : (h.severidad === 'ERROR' ? '!' : 'i');
      const ref = [h.id_hallazgo, h.origen].filter(Boolean).join(' · ');
      const pieResuelto = resuelto
        ? `<small style="display:block;color:var(--tx-sec);margin-top:.2rem">Resuelto por ${esc(h.resuelto_por || '—')} · ${h.fecha_resolucion ? new Date(h.fecha_resolucion).toLocaleDateString('es-CO') : ''}</small>`
        : `<button class="b ${h.severidad === 'ERROR' ? 'mini' : 'sec mini'}" type="button" style="margin-left:.6rem" onclick="resolverHallazgoUI('${esc(h.id_hallazgo)}', this)">Marcar resuelto</button>`;
      return `<div class="hf${resuelto || h.severidad !== 'ERROR' ? ' tenue' : ''}">
        <span class="sig ${sig}">${marca}</span><span class="ref">${esc(ref)}</span>
        <span>${esc(h.motivo)}${h.dane_sede ? ` <code class="dane">${esc(h.dane_sede)}</code>` : ''}${pieResuelto}</span>
      </div>`;
    }).join('');
  }

  async function resolverHallazgoUI(idHallazgo, btn){
    const ok = await confirmar({
      titulo: 'Marcar hallazgo como resuelto',
      html: `<p class="nota-dlg"><b>${esc(idHallazgo)}</b></p><p class="nota-dlg">Solo si el dato ya se confirmó con la fuente real (la alcaldía, Infraestructura o el arquitecto). Queda registrado quién lo resolvió y cuándo.</p>`,
      aceptar: 'Marcar resuelto',
    });
    if (!ok) return;
    const soltar = ocupar(btn, 'Guardando…');
    try {
      const r = await backend('resolverHallazgo', { token: sesion.token, id_hallazgo: idHallazgo });
      if (!r.ok){ avisar(r.error || 'No se pudo marcar como resuelto.', 'error'); soltar(); return; }
      avisar('Hallazgo marcado como resuelto.', 'ok');
    } catch (err) { avisar('No se pudo contactar el servidor. Intente de nuevo.', 'error'); soltar(); return; }
    cargarHallazgos();
  }

