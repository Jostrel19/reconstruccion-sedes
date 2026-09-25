/* app/js/cargas.js — Cargas del JSON de ingesta (D-23, D-40, D-41).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Paso 5: Cargas (D-23, D-33, D-36) — el arquitecto sube el JSON que ya
     produjo "python tools/ingesta.py <MUNICIPIO> --json" en su computador;
     esta pantalla nunca lee el Excel original. Ningún capítulo se infiere de
     texto libre (D-36): un registro sin desglose estructurado se vuelca como
     un único ítem "sin desglose" — nunca repartido a ciegas entre capítulos.
     Desde D-44 no hay lote predefinido: se premarcan todas las filas cuyo
     DANE venía en el archivo y existe en el catálogo; las de DANE propuesto
     por nombre nunca se premarcan (marcarlas es la confirmación humana). ─── */
  let CARGA = null;      // el JSON subido, tal cual (esquema 1)
  let cargaFilas = [];   // un estado de confirmación/inclusión por registro (f.i = posición en el JSON)
  const CARGA_TANDA = 10; // filas por pedido a volcarCarga (el backend acepta hasta 15)

  // El lector escribe el municipio sin tildes (SAMANA) y el catálogo con
  // tildes (SAMANÁ, D-11): se compara normalizado, nunca literal.
  const mismoMunicipio = (a, b) => normalizar(a).toUpperCase() === normalizar(b).toUpperCase();
  // El lector guarda la ruta completa del Excel en su computador: al sistema
  // solo pasa el nombre del archivo.
  const nombreArchivo = ruta => String(ruta || '').split(/[\\/]/).pop();
  const filaCarga = i => cargaFilas.find(f => f.i === Number(i));

  function resolverSedesCarga(){
    CARGA._sedesMuni = (SEDES || []).filter(s => mismoMunicipio(s.municipio, CARGA.municipio));
    cargaFilas.forEach(f => {
      f.sedeInfo = f.daneElegido ? (CARGA._sedesMuni.find(s => String(s.dane_sede) === f.daneElegido) || null) : null;
    });
  }

  function cargasLeerArchivo(file){
    const reader = new FileReader();
    reader.onload = async () => {
      let json;
      try { json = JSON.parse(reader.result); }
      catch (err) { avisar('El archivo no es JSON válido.', 'error'); return; }
      if (json.esquema !== 1){
        avisar('Este archivo no tiene "esquema": 1. Debe ser la salida de «python tools/ingesta.py <MUNICIPIO> --json».', 'error');
        return;
      }
      // Sin el catálogo cargado no hay contra qué cruzar: antes todas las
      // casillas quedaban bloqueadas sin explicación. Se espera a que llegue.
      if (!SEDES || !SEDES.length){
        document.getElementById('cargas-contenido').innerHTML =
          '<div class="p"><div class="cuerpo"><p style="margin:0">Cargando el catálogo de sedes para cruzar el archivo…</p></div></div>';
        sedesSucias = true;
        await cargarSedes();
        if (!SEDES || !SEDES.length){
          CARGA = null; cargaFilas = []; pintarCargasReal();
          avisar('No se pudo cargar el catálogo de sedes, así que no hay contra qué cruzar el archivo. Espere unos segundos y vuelva a subirlo.', 'error');
          return;
        }
      }
      CARGA = json;
      CARGA._archivoNombre = file.name;
      const vistos = new Set();
      cargaFilas = (json.registros || []).map((r, i) => {
        // esDeArchivo=true: el DANE venía en el Excel. esDeArchivo=false: lo
        // propuso el lector por nombre (o no propuso nada) — el <select> lo
        // preselecciona como ayuda, pero SOLO marcar la casilla cuenta como
        // confirmación humana.
        const esDeArchivo = r.dane_sede != null;
        const dane = esDeArchivo ? String(r.dane_sede) : (r.dane_propuesto != null ? String(r.dane_propuesto) : '');
        const repetida = esDeArchivo && vistos.has(dane);
        if (esDeArchivo) vistos.add(dane);
        return { i, r, esDeArchivo, daneElegido: dane, sedeInfo: null, repetida, incluir: false, resultado: null };
      });
      resolverSedesCarga();
      // Premarcadas: DANE del archivo, en el catálogo, con valor y no repetido.
      // Un $0 es «probablemente sin afectación, confirmar» según el lector:
      // no se vuelca como presupuesto.
      cargaFilas.forEach(f => { f.incluir = f.esDeArchivo && !bloqueoFilaCarga(f); });
      if (!CARGA._sedesMuni.length) avisar(`El municipio «${json.municipio}» del archivo no coincide con ningún municipio del catálogo.`, 'error');
      pintarCargasReal();
    };
    reader.onerror = () => avisar('No se pudo leer el archivo.', 'error');
    reader.readAsText(file);
  }

  // Por qué una fila no se puede volcar, o '' si se puede.
  function bloqueoFilaCarga(f){
    if (f.resultado && f.resultado.ok) return f.resultado.ya_estaba ? 'Ya estaba volcada' : 'Volcada';
    if (f.repetida) return 'DANE repetido en el archivo';
    if (!f.daneElegido) return f.esDeArchivo ? 'Sin DANE' : 'Elija la sede';
    if (!f.sedeInfo) return 'No está en el catálogo de este municipio';
    if (!(Number(f.r.costo_directo) > 0)) return 'Sin valor: confirmar a mano en Registrar';
    // La versión vigente ya es esta misma fila (mismo archivo y costo): el
    // backend no la duplicaría; tampoco se ofrece para volcar.
    const p = f.sedeInfo.presupuesto;
    if (p && p.origen === 'CARGA' && p.archivo_origen && p.archivo_origen === (nombreArchivo(f.r.archivo_origen) || CARGA._archivoNombre) &&
        Number(p.costo_directo) === Number(f.r.costo_directo)) return `Ya volcada desde este archivo (v${p.version})`;
    return '';
  }

  function filaCargaHtml(f){
    const r = f.r;
    let colDane;
    if (f.esDeArchivo || (f.resultado && f.resultado.ok)){
      colDane = `<span class="dane">${esc(f.daneElegido || r.dane_sede)}</span>`;
    } else {
      const opciones = ['<option value="">— sin confirmar —</option>'].concat(
        CARGA._sedesMuni.map(s => `<option value="${esc(s.dane_sede)}" ${String(s.dane_sede) === f.daneElegido ? 'selected' : ''}>${esc(s.dane_sede)} · ${esc(s.sede)}</option>`)
      );
      colDane = `<select data-elegir-dane="${f.i}" style="max-width:230px" aria-label="Sede del catálogo para ${esc(r.sede || '')}">${opciones.join('')}</select>` +
        (r.dane_propuesto != null ? `<div class="ayuda" style="margin:.2rem 0 0">Propuesto por coincidencia de nombre: revise que sea la sede correcta antes de marcarla.</div>` : '');
    }
    const bloqueo = bloqueoFilaCarga(f);
    let estado;
    if (f.resultado && f.resultado.ok){
      estado = `<span class="est e-apr">${f.resultado.ya_estaba ? 'Ya estaba' : 'Volcada'} v${esc(f.resultado.version)}</span>`;
    } else if (f.resultado){
      estado = `<span class="cer">${esc(f.resultado.error || 'Error')}</span>`;
    } else if (bloqueo){
      estado = `<span class="ctr">${esc(bloqueo)}</span>`;
    } else {
      estado = `${tipoChip(f.sedeInfo)}` + (f.sedeInfo.presupuesto ? ` <span class="ctr">ya tiene v${esc(f.sedeInfo.presupuesto.version)}: se crea una nueva</span>` : '');
    }
    const puedeIncluir = !bloqueo;
    return `<tr>
      <td><input type="checkbox" data-incluir="${f.i}" ${f.incluir && puedeIncluir ? 'checked' : ''} ${puedeIncluir ? '' : 'disabled'} aria-label="Volcar ${esc(r.sede || '')}"></td>
      <td>${esc(r.sede || '')}</td>
      <td>${colDane}</td>
      <td>${estado}</td>
      <td class="n">${cop(r.costo_directo)}</td>
    </tr>`;
  }

  function pintarCargasReal(){
    const cont = document.getElementById('cargas-contenido');
    if (!CARGA){
      cont.innerHTML = '<div class="p"><div class="cuerpo"><p style="color:var(--tx-sec);font-size:.85rem;margin:0">Todavía no se ha subido ningún archivo.</p></div></div>';
      return;
    }
    const errores = (CARGA.hallazgos || []).filter(h => h.severidad === 'error');
    const advertencias = (CARGA.hallazgos || []).filter(h => h.severidad === 'advertencia');
    const total = cargaFilas.length;
    const deArchivo = cargaFilas.filter(f => f.esDeArchivo).length;
    const enCero = cargaFilas.filter(f => !(Number(f.r.costo_directo) > 0)).length;
    const fueraCatalogo = cargaFilas.filter(f => f.daneElegido && !f.sedeInfo).length;
    const volcadas = cargaFilas.filter(f => f.resultado && f.resultado.ok).length;

    let html = `<div class="p">
      <header><h2>Informe de validación</h2><span class="flex"></span><span class="eyebrow">Nada se vuelca sin pasar por aquí</span></header>
      <div class="archivo">
        <div class="ico">JSON</div>
        <div class="meta"><b>${esc(CARGA._archivoNombre)}</b>
          <span>${esc(CARGA.municipio)} · generado ${esc(new Date(CARGA.generado_en).toLocaleString('es-CO'))}</span></div>
        <span class="flex"></span><span class="orig xls">XLS → JSON</span>
      </div>
      <div class="cuerpo">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;font-size:.79rem;color:var(--tx-sec)">
          <span>${total} registro(s) leídos · ${deArchivo} con DANE del archivo · ${total - deArchivo} con DANE propuesto por nombre` +
          `${fueraCatalogo ? ` · ${fueraCatalogo} fuera del catálogo` : ''}${enCero ? ` · ${enCero} sin valor` : ''}${volcadas ? ` · <b>${volcadas} ya volcadas</b>` : ''}</span>
          <span class="n">${errores.length} fila(s) del Excel con error no generaron registro</span>
        </div>
      </div>
    </div>`;

    if (errores.length){
      html += `<div class="p"><div class="gh" style="--g:var(--err);--gbg:var(--err-bg);--gtx:var(--err)">
        <div class="cab"><span class="sig hall">!</span>Error · no generaron registro<span class="cnt">${errores.length}</span></div>
        ${errores.map(h => `<div class="hf"><span class="sig hall">!</span><span class="ref">${esc(h.referencia)}</span><span>${esc(h.motivo)}</span></div>`).join('')}
      </div></div>`;
    }
    if (advertencias.length){
      html += `<div class="p"><div class="gh" style="--g:var(--alerta);--gbg:var(--alerta-bg);--gtx:var(--alerta)">
        <div class="cab"><span>▲</span>Advertencia · revisar antes de confirmar<span class="cnt">${advertencias.length}</span></div>
        ${advertencias.map(h => `<div class="hf"><span>▲</span><span class="ref">${esc(h.referencia)}</span><span>${esc(h.motivo)}</span></div>`).join('')}
      </div></div>`;
    }

    html += `<div class="p">
      <header><h2>Registros a volcar</h2><span class="flex"></span><span class="eyebrow">${total} sede(s) leídas</span></header>
      <div class="cuerpo ras"><div class="scroll"><table>
        <thead><tr><th></th><th>Sede (archivo)</th><th>DANE</th><th>Estado</th><th class="n">Costo directo</th></tr></thead>
        <tbody>${cargaFilas.map(f => filaCargaHtml(f)).join('')}</tbody>
      </table></div></div>
      <div class="pie" style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">
        <span id="cargas-resumen" aria-live="polite"></span>
        <span class="flex"></span>
        <button class="b sec mini" type="button" id="cargas-descartar">Descartar archivo</button>
        <button class="b mini" type="button" id="cargas-volcar">Volcar marcadas</button>
      </div>
    </div>`;

    cont.innerHTML = html;
    actualizarResumenCargas();

    cont.querySelectorAll('[data-incluir]').forEach(chk => chk.addEventListener('change', e => {
      filaCarga(e.target.dataset.incluir).incluir = e.target.checked;
      actualizarResumenCargas();
    }));
    cont.querySelectorAll('[data-elegir-dane]').forEach(sel => sel.addEventListener('change', e => {
      const f = filaCarga(e.target.dataset.elegirDane);
      f.daneElegido = e.target.value;
      f.sedeInfo = f.daneElegido ? (CARGA._sedesMuni.find(s => String(s.dane_sede) === f.daneElegido) || null) : null;
      // Elegir una sede del desplegable es la confirmación humana explícita
      // que pide el lector para un DANE propuesto.
      f.incluir = !bloqueoFilaCarga(f);
      pintarCargasReal();
    }));
    document.getElementById('cargas-descartar').addEventListener('click', () => { CARGA = null; cargaFilas = []; pintarCargasReal(); });
    document.getElementById('cargas-volcar').addEventListener('click', volcarCargas);
  }

  function actualizarResumenCargas(){
    const el = document.getElementById('cargas-resumen');
    if (!el) return;
    const marcadas = cargaFilas.filter(f => f.incluir && !bloqueoFilaCarga(f));
    const valor = marcadas.reduce((a, f) => a + (Number(f.r.costo_directo) || 0), 0);
    const propuestas = cargaFilas.filter(f => !f.esDeArchivo && !f.incluir && !(f.resultado && f.resultado.ok)).length;
    el.textContent = `${marcadas.length} marcadas para volcar · ${cop(valor)} de costo directo` +
      (propuestas ? ` · ${propuestas} con DANE propuesto sin confirmar` : '');
  }

  async function volcarCargas(){
    const filas = cargaFilas.filter(f => f.incluir && !bloqueoFilaCarga(f));
    if (!filas.length){ avisar('No hay ninguna fila marcada que se pueda volcar.', 'info'); return; }
    const conPrevio = filas.filter(f => f.sedeInfo.presupuesto).length;
    const propuestas = filas.filter(f => !f.esDeArchivo).length;
    const ok = await confirmar({
      titulo: 'Volcar presupuestos',
      html: `<p class="nota-dlg">Se radican <b>${filas.length}</b> presupuesto(s) de ${esc(CARGA.municipio)} con origen «carga de Excel», por <b>${cop(filas.reduce((a, f) => a + Number(f.r.costo_directo), 0))}</b> de costo directo. Quedan en la bandeja de verificación.</p>` +
        (conPrevio ? `<p class="nota-dlg">${conPrevio} sede(s) ya tenían presupuesto: se crea una versión nueva y la anterior no se borra.</p>` : '') +
        (propuestas ? `<p class="nota-dlg">${propuestas} con DANE confirmado a mano: cada una deja un hallazgo de advertencia como rastro.</p>` : ''),
      aceptar: `Volcar ${filas.length}`,
    });
    if (!ok) return;

    const btn = document.getElementById('cargas-volcar');
    const soltar = ocupar(btn, `Volcando 0 de ${filas.length}…`);
    const inicio = Date.now();
    let hechas = 0;
    try {
      for (let k = 0; k < filas.length; k += CARGA_TANDA){
        const tanda = filas.slice(k, k + CARGA_TANDA);
        let r;
        try {
          r = await backend('volcarCarga', {
            token: sesion.token, archivo_origen: CARGA._archivoNombre,
            filas: tanda.map(f => ({
              dane_sede: f.daneElegido, costo_directo: Number(f.r.costo_directo),
              origen_dane: f.esDeArchivo ? 'archivo' : 'propuesto',
              archivo_origen: nombreArchivo(f.r.archivo_origen) || CARGA._archivoNombre,
            })),
          });
        } catch (err) {
          r = { ok: false, error: 'No se pudo contactar el servidor' };
        }
        if (!r.ok || !Array.isArray(r.resultados)){
          // La tanda entera no se confirmó. volcarCarga es idempotente: volver
          // a intentarlo no duplica lo que sí alcanzó a guardarse.
          const motivo = r.error || 'El servidor no confirmó la tanda';
          tanda.forEach(f => { f.resultado = { ok: false, error: motivo + ' — puede reintentar sin riesgo de duplicar' }; });
          break;
        }
        tanda.forEach((f, j) => {
          const x = r.resultados.find(y => String(y.dane_sede) === String(f.daneElegido)) || r.resultados[j];
          f.resultado = x || { ok: false, error: 'Sin respuesta para esta fila' };
          if (f.resultado.ok) f.incluir = false;
        });
        hechas += tanda.length;
        btn.textContent = `Volcando ${hechas} de ${filas.length}…`;
      }
    } finally {
      soltar();
    }
    const segundos = Math.round((Date.now() - inicio) / 1000);
    const res = filas.map(f => f.resultado).filter(Boolean);
    const nuevas = res.filter(x => x.ok && !x.ya_estaba).length;
    const yaEstaban = res.filter(x => x.ya_estaba).length;
    const fallidas = filas.filter(f => !f.resultado || !f.resultado.ok);
    // Una fila con error queda marcable de nuevo para reintentar.
    fallidas.forEach(f => { f.incluir = true; });
    if (nuevas){
      sedesSucias = true;
      olvidarFicha();
      await cargarSedes();
      if (CARGA) resolverSedesCarga();
    }
    pintarCargasReal();
    mostrarDialogo({
      titulo: fallidas.length ? 'Volcado con pendientes' : 'Volcado terminado',
      html: `<p class="nota-dlg"><b>${nuevas}</b> radicado(s) nuevo(s)${yaEstaban ? ` · ${yaEstaban} ya estaban volcados (no se duplicaron)` : ''} · ${segundos} s.</p>` +
        (fallidas.length ? `<p class="nota-dlg">Sin volcar (siguen marcadas para reintentar):</p><ul class="lista-dlg">${fallidas.map(f => `<li>${esc(f.r.sede)} (${esc(f.daneElegido)}): ${esc((f.resultado && f.resultado.error) || 'no se alcanzó a enviar')}</li>`).join('')}</ul>` : '') +
        (nuevas ? '<p class="nota-dlg">Quedan en la bandeja de <b>Verificación</b> y en el Tablero.</p>' : ''),
    });
  }

