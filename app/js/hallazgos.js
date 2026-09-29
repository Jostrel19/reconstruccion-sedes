/* app/js/hallazgos.js — Hallazgos (Administrador y Verificador).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  // Antes las 19 filas venían escritas a mano en el HTML (8 de ejemplo, sin
  // backend detrás) y "Marcar resuelto" no llamaba a nada. Ahora se lee la
  // pestaña Hallazgos real (sembrada una vez con sembrarHallazgosIniciales,
  // backend/Hallazgos.gs) y el botón sí resuelve, con el mismo patrón de
  // "cola de trabajo que se refresca" que ya usa Verificación.
  /* H1-10 (hito 1, opción a): cada radicado genera sus propios hallazgos
     (`<dane>-v<n>-AIU`…), así que una sede corregida tres veces acumulaba tres
     del mismo tipo. Los de una versión ya reemplazada se muestran atenuados y
     al final, y no cuentan como abiertos en ningún contador. En la hoja siguen
     ABIERTOS (D-42: nada se resuelve solo); se pueden marcar resueltos a mano.
     DANEPROP no depende de la versión sino de si la sede es la correcta, y solo
     se detecta en Cargas: nunca se da por reemplazado. */
  function versionQueReemplaza(h){
    const m = /^(\d{12})-v(\d+)-(.+)$/.exec(String(h.id_hallazgo || ''));
    if (!m || m[3] === 'DANEPROP' || !SEDES) return null;
    const s = SEDES.find(x => String(x.dane_sede) === m[1]);
    const p = s && s.presupuesto;
    return p && Number(p.version) > Number(m[2]) ? p.version : null;
  }
  // Abiertos que sí piden atención: los de la versión vigente (Inicio, riel y franja).
  function hallazgosPendientes(hallazgos){
    return (hallazgos || []).filter(h => h.estado === 'ABIERTO' && !versionQueReemplaza(h));
  }

  async function cargarHallazgos(){
    const cont = document.getElementById('hallazgos-lista');
    // Sin SEDES no se sabe qué versión es la vigente; se esperan (ya vienen en camino desde el ingreso).
    if (!SEDES) { try { await cargarSedes(); } catch (err) {} }
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
    const pendientes = hallazgosPendientes(hallazgos).filter(h => h.severidad === 'ERROR').length;
    el.textContent = String(pendientes);
    el.classList.toggle('oculto', pendientes === 0);
  }

  /* H1-11 (hito 1): al marcar uno resuelto, la lista se volvía a ordenar y el
     hallazgo saltaba al final: parecía que no había pasado nada. Ahora el orden
     se fija al cargar y, al resolver, la fila cambia en su sitio. */
  let ordenHallazgos = [];

  function pintarHallazgosReal(hallazgos, mantenerOrden){
    const abiertos = hallazgosPendientes(hallazgos);
    const error = abiertos.filter(h => h.severidad === 'ERROR').length;
    const advertencia = abiertos.filter(h => h.severidad === 'ADVERTENCIA').length;
    const resueltos = hallazgos.filter(h => h.estado === 'RESUELTO').length;
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
    let ordenados;
    if (mantenerOrden && ordenHallazgos.length){
      const pos = id => { const i = ordenHallazgos.indexOf(id); return i === -1 ? Infinity : i; };
      ordenados = [...hallazgos].sort((a, b) => pos(a.id_hallazgo) - pos(b.id_hallazgo));
    } else {
      // Pendientes (graves antes que informativos), luego los de versiones
      // reemplazadas, y los resueltos al final.
      const grupo = h => h.estado === 'RESUELTO' ? 2 : (versionQueReemplaza(h) ? 1 : 0);
      ordenados = [...hallazgos].sort((a, b) =>
        (grupo(a) - grupo(b)) || ((orden[a.severidad] ?? 2) - (orden[b.severidad] ?? 2)));
      ordenHallazgos = ordenados.map(h => h.id_hallazgo);
    }
    cont.innerHTML = ordenados.map(h => {
      const resuelto = h.estado === 'RESUELTO';
      const vigenteV = resuelto ? null : versionQueReemplaza(h);
      const sig = resuelto || vigenteV ? 'cerr' : (h.severidad === 'ERROR' ? 'hall' : 'cerr');
      const marca = resuelto ? '✓' : (vigenteV ? '↻' : (h.severidad === 'ERROR' ? '!' : 'i'));
      const notaReemplazo = vigenteV
        ? `<small style="display:block;color:var(--tx-sec);margin-top:.2rem">Versión reemplazada: la vigente es la v${esc(vigenteV)}. No cuenta como abierto; márquelo resuelto si quiere dejar constancia.</small>`
        : '';
      const ref = [h.id_hallazgo, h.origen].filter(Boolean).join(' · ');
      const pieResuelto = resuelto
        ? `<small style="display:block;color:var(--tx-sec);margin-top:.2rem">Resuelto por ${esc(h.resuelto_por || '—')} · ${h.fecha_resolucion ? new Date(h.fecha_resolucion).toLocaleDateString('es-CO') : ''}</small>`
        : `<button class="b ${h.severidad === 'ERROR' && !vigenteV ? 'mini' : 'sec mini'}" type="button" style="margin-left:.6rem" onclick="resolverHallazgoUI('${esc(h.id_hallazgo)}', this)">Marcar resuelto</button>`;
      return `<div class="hf${resuelto || vigenteV || h.severidad !== 'ERROR' ? ' tenue' : ''}">
        <span class="sig ${sig}">${marca}</span><span class="ref">${esc(ref)}</span>
        <span>${esc(h.motivo)}${h.dane_sede ? ` <code class="dane">${esc(h.dane_sede)}</code>` : ''}${notaReemplazo}${pieResuelto}</span>
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
      avisar('Hallazgo marcado como resuelto. Queda en la lista con quién y cuándo.', 'ok');
    } catch (err) { avisar('No se pudo confirmar la respuesta del servidor. Pulse «Actualizar» y revise si quedó resuelto antes de repetirlo.', 'error'); soltar(); return; }
    // Se actualiza en memoria y se repinta sin reordenar; «Actualizar» vuelve
    // a leer la hoja y ordena de nuevo (resueltos al final).
    const h = (HALLAZGOS || []).find(x => x.id_hallazgo === idHallazgo);
    if (h){
      h.estado = 'RESUELTO'; h.resuelto_por = correoActual || ''; h.fecha_resolucion = new Date().toISOString();
      pintarHallazgosReal(HALLAZGOS, true);
      actualizarBadgeHallazgosRiel(HALLAZGOS);
    } else cargarHallazgos();
  }

