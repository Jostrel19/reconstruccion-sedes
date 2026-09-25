/* app/js/verificacion.js — Bandeja y concepto de verificación (D-21, D-22, D-30).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Paso 4: Verificación (D-21, D-22, D-30) — el arquitecto trabaja por
     BANDEJA departamental, nunca sede por sede. Se recarga cada vez que se
     entra a la vista (a diferencia de SEDES, que se carga una sola vez al
     loguearse): esto es una cola de trabajo activa, no un catálogo fijo. ─── */
  let VERIF = null;            // null = todavía no se ha pedido al backend
  let verifSeleccion = null;   // id_presupuesto abierto en "Emitir concepto"
  let verifAutoAbrirDane = null; // viene de irVerificacionSede(), se consume una vez

  function irVerificacion(){ vista = 'verif'; pintar(); }
  function irVerificacionSede(dane){ verifAutoAbrirDane = dane; vista = 'verif'; pintar(); }

  async function cargarBandejaVerificacion(){
    try {
      const r = await backend('obtenerBandejaVerificacion', { token: sesion.token });
      VERIF = r.ok ? r.presupuestos : [];
    } catch (err) { VERIF = []; }
    if (verifAutoAbrirDane){
      const match = VERIF.find(p => String(p.dane_sede) === String(verifAutoAbrirDane));
      if (match) verifSeleccion = match.id_presupuesto;
      verifAutoAbrirDane = null;
    }
    if (vista === 'verif') { pintarVerificacionReal(); pintarCabecera(); }
    actualizarBadgeVerifRiel();
  }

  // El riel muestra cuántas hay RADICADO esperando concepto — el mismo
  // cálculo que ya hace pintarVerificacionReal() para la franja de cifras,
  // solo que aquí puede correr sin haber pintado esa pantalla (por eso lee
  // VERIF directo en vez de reusar una variable ya calculada). Antes de la
  // primera carga (VERIF === null) se oculta: mostrar un número viejo o un
  // cero falso sería peor que no mostrar nada.
  function actualizarBadgeVerifRiel(){
    const el = document.getElementById('riel-cand-verif');
    if (!el) return;
    if (VERIF === null){ el.classList.add('oculto'); return; }
    const pendientes = VERIF.filter(p => p.estado === 'RADICADO').length;
    el.textContent = String(pendientes);
    el.classList.toggle('oculto', pendientes === 0);
  }

  function pintarVerificacionReal(){
    const tbody = document.getElementById('verif-bandeja-tbody');
    if (VERIF === null){
      tbody.innerHTML = filasEsqueleto(9, 3);
      return;
    }

    const pendientes = VERIF.filter(p => p.estado === 'RADICADO');
    const aprobadas = VERIF.filter(p => p.estado === 'APROBADO');
    const devueltas = VERIF.filter(p => p.estado === 'REQUIERE_AJUSTE');
    const sinVerificar = pendientes.reduce((a, p) => a + (Number(p.total_presupuesto) || 0), 0);

    const cifras = document.querySelectorAll('#verif-franja .n');
    cifras[0].textContent = String(pendientes.length);
    cifras[1].textContent = String(VERIF.length);
    cifras[2].textContent = String(aprobadas.length);
    cifras[3].textContent = String(devueltas.length);
    cifras[4].innerHTML = sinVerificar >= 1000000
      ? `$${formatNum(sinVerificar / 1000000, 1)}<span class="u"> M</span>` : cop(sinVerificar);

    if (!VERIF.length){
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--tx-sec);padding:1rem">Sin presupuestos radicados todavía.</td></tr>';
      renderConceptoPanel(null);
      return;
    }

    // Pendientes primero, y entre ellas la que más lleva esperando.
    const orden = { RADICADO: 0, REQUIERE_AJUSTE: 1, APROBADO: 2 };
    const filas = VERIF.slice().sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) ||
      new Date(a.fecha_creacion) - new Date(b.fecha_creacion));

    tbody.innerHTML = filas.map(p => {
      const s = p.sede_info || {};
      const pri = tipoChip(s);
      const cd = capitulosDeSede(s);
      const nDanos = cd.corrupto ? '—' : cd.lista.length;
      const origen = p.origen === 'CARGA' ? ['xls', 'XLS'] : ['man', 'MAN'];
      const accion = p.estado === 'RADICADO' ? 'Verificar' : 'Abrir';
      const claseBtn = p.estado === 'RADICADO' ? 'b mini' : 'b sec mini';
      return `<tr class="click" data-id="${esc(p.id_presupuesto)}">
        <td>${esc(nombreSedeCorto(s) || p.dane_sede)}</td><td>${esc(s.municipio || '')}</td>
        <td>${pri}</td><td class="n">${nDanos}</td>
        <td class="n"><b>${cop(p.total_presupuesto)}</b></td>
        <td><span class="orig ${origen[0]}">${origen[1]}</span></td><td>v${esc(p.version)}</td>
        <td>${p.estado === 'RADICADO' ? chipEspera(p.fecha_creacion) : '<span class="hace">—</span>'}</td>
        <td><button class="${claseBtn}" type="button" data-abrir="${esc(p.id_presupuesto)}">${accion}</button></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-abrir]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); abrirConceptoVerif(b.dataset.abrir); }));
    tbody.querySelectorAll('tr[data-id]').forEach(tr =>
      tr.addEventListener('click', () => abrirConceptoVerif(tr.dataset.id)));

    // Si ya había algo abierto (o venía de irVerificacionSede) y sigue en la
    // bandeja, se refresca con el dato más nuevo en vez de perder la selección.
    const sigue = verifSeleccion && VERIF.find(p => String(p.id_presupuesto) === String(verifSeleccion));
    renderConceptoPanel(sigue || null);
  }

  function abrirConceptoVerif(idPresupuesto){
    verifSeleccion = idPresupuesto;
    renderConceptoPanel(VERIF.find(x => String(x.id_presupuesto) === String(idPresupuesto)) || null);
  }

  function renderConceptoPanel(p){
    const badge = document.getElementById('verif-c-badge');
    const eyebrow = document.getElementById('verif-c-eyebrow');
    const cuerpo = document.getElementById('verif-c-cuerpo');

    if (!p){
      badge.className = 'est e-pend'; badge.textContent = '—';
      eyebrow.textContent = 'Seleccione una fila de la bandeja';
      cuerpo.innerHTML = '<p style="color:var(--tx-sec);font-size:.85rem;margin:0">Haga clic en una fila de la bandeja (o en "Verificar"/"Abrir") para ver su detalle acá.</p>';
      return;
    }

    const s = p.sede_info || {};
    const items = p.items || [];
    const [cls, txt] = ESTADOS_PRESUPUESTO[p.estado] || ['e-pend', p.estado];
    badge.className = 'est ' + cls; badge.textContent = txt;
    eyebrow.textContent = `${nombreSedeCorto(s) || p.dane_sede} · ${s.municipio || ''}`;

    const capsConPresupuesto = new Set(items.map(it => String(it.capitulo || '')).filter(Boolean));
    const cd = capitulosDeSede(s);
    let capsHtml = '';
    if (!cd.corrupto){
      cd.lista.forEach(n => {
        const pres = capsConPresupuesto.has(String(n));
        capsHtml += `<div class="cap dano${pres ? ' pres' : ''}"><span class="cn">${esc(n)}</span>${esc(CAPITULOS[n] || '')}<span class="flex"></span>` +
          (pres ? '<span class="cok">✓ $</span>' : '<span class="cer">sin $</span>') + `</div>`;
      });
    }
    if (!capsHtml) capsHtml = '<div class="cap">Sin capítulos de daño marcados en el censo para esta sede.</div>';

    const puedeEmitir = p.estado === 'RADICADO';

    cuerpo.innerHTML = `
      <dl class="kv" style="margin-bottom:1.1rem">
        <dt>Total radicado</dt><dd class="n"><b>${cop(p.total_presupuesto)}</b></dd>
        <dt>Costo directo</dt><dd class="n">${cop(p.costo_directo)}</dd>
        <dt>A / U</dt><dd>${formatNum(p.pct_admin, 0)} % / ${formatNum(p.pct_utilidad, 0)} %</dd>
        <dt>Registrado por</dt><dd>${esc(p.creado_por || '—')} · ${p.fecha_creacion ? esc(new Date(p.fecha_creacion).toLocaleString('es-CO')) : ''}</dd>
      </dl>
      <div class="caps" style="margin-bottom:1.1rem">${capsHtml}</div>
      ${puedeEmitir ? '' : `<div class="ayuda" style="margin-bottom:1rem">Esta versión ya tiene concepto (<b>${esc(txt)}</b>). Si el municipio radica una versión nueva, vuelve a aparecer pendiente para un concepto nuevo.</div>`}
      <div class="campo-v">
        <label>Resultado de la verificación</label>
        <div class="ayuda">Lo que marque se guarda tal cual. A qué estado pasa la sede lo decide una
          regla conservadora: solo «corresponde» aprueba, mientras Planeación confirma el criterio.</div>
        <label class="op"><input type="radio" name="rv" value="CORRESPONDE" checked ${puedeEmitir ? '' : 'disabled'}>
          <span><b>Corresponde</b><small>Cantidades y valores corresponden a los daños
          registrados. → pasa a <b>APROBADO</b></small></span></label>
        <label class="op"><input type="radio" name="rv" value="CORRESPONDE_PARCIAL" ${puedeEmitir ? '' : 'disabled'}>
          <span><b>Corresponde parcialmente</b><small>Parte está sustentada, parte no.
          → pasa a <b>REQUIERE AJUSTE</b></small></span></label>
        <label class="op"><input type="radio" name="rv" value="NO_CORRESPONDE" ${puedeEmitir ? '' : 'disabled'}>
          <span><b>No corresponde</b><small>No se sustenta en los daños registrados.
          → pasa a <b>REQUIERE AJUSTE</b></small></span></label>
      </div>
      <div class="campo-v">
        <label>Observaciones técnicas</label>
        <div class="ayuda">Obligatorias (mínimo 20 caracteres) si el resultado no es «corresponde»:
          son las que le llegan al municipio para saber qué corregir.</div>
        <textarea id="verif-c-obs" ${puedeEmitir ? '' : 'disabled'}
          placeholder="Ej.: el capítulo 2 (mampostería) figura con daño en el censo y no tiene ítems presupuestados…"></textarea>
      </div>
      <div class="firma">
        <b>Firma electrónica — registro de auditoría</b>
        Queda quién verificó, con qué cuenta institucional y cuándo. No hay que subir
        imagen de firma ni digitar cédula: el ingreso con cuenta real ya identifica a la
        persona de forma verificable.
      </div>
      <div class="acciones-v">
        <span class="flex"></span>
        <span style="font-size:.79rem;color:var(--tx-sec)" id="verif-c-msg"></span>
        <button class="b sec" type="button" id="verif-btn-devolver" style="color:var(--err);border-color:var(--err)" ${puedeEmitir ? '' : 'disabled'}>Devolver al municipio</button>
        <button class="b" type="button" id="verif-btn-emitir" ${puedeEmitir ? '' : 'disabled'}>Emitir concepto</button>
      </div>`;

    if (puedeEmitir){
      document.getElementById('verif-btn-emitir').addEventListener('click', () => emitirConceptoVerificacion(p, null));
      document.getElementById('verif-btn-devolver').addEventListener('click', () => emitirConceptoVerificacion(p, 'NO_CORRESPONDE'));
    }
  }

  async function emitirConceptoVerificacion(p, resultadoForzado){
    const seleccionado = document.querySelector('input[name="rv"]:checked');
    const resultado = resultadoForzado || (seleccionado && seleccionado.value);
    if (!resultado) return;
    const observaciones = document.getElementById('verif-c-obs').value.trim();
    const msg = document.getElementById('verif-c-msg');
    msg.classList.remove('err-tx');
    if (resultado !== 'CORRESPONDE' && observaciones.length < 20){
      msg.textContent = `Las observaciones son obligatorias (mínimo 20 caracteres) cuando el resultado no es «corresponde» — llevan ${observaciones.length}.`;
      msg.classList.add('err-tx');
      document.getElementById('verif-c-obs').focus();
      return;
    }
    const destino = resultado === 'CORRESPONDE' ? 'APROBADO' : 'REQUIERE AJUSTE';
    const ok = await confirmar({
      titulo: 'Emitir concepto',
      html: `<p class="nota-dlg">Resultado: <b>${esc(RESULTADO_TXT[resultado])}</b>. La sede pasa a <b>${destino}</b>.</p>
        <p class="nota-dlg">Queda registrado con su cuenta y la fecha. Si el municipio radica una versión nueva, vuelve a la bandeja.</p>`,
      aceptar: 'Emitir concepto', peligro: resultado !== 'CORRESPONDE',
    });
    if (!ok) return;
    const btnEmitir = document.getElementById('verif-btn-emitir');
    const btnDevolver = document.getElementById('verif-btn-devolver');
    btnEmitir.disabled = true; btnDevolver.disabled = true; msg.textContent = 'Guardando…';
    try {
      const r = await backend('emitirConcepto', {
        token: sesion.token, dane_sede: p.dane_sede, id_presupuesto: p.id_presupuesto,
        resultado, observaciones
      });
      if (!r.ok){
        avisar(r.error || 'No se pudo emitir el concepto.', 'error');
        btnEmitir.disabled = false; btnDevolver.disabled = false; msg.textContent = '';
        return;
      }
      sedesSucias = true;
      olvidarFicha(p.dane_sede);
      avisar(`Concepto emitido: ${RESULTADO_TXT[resultado].toLowerCase()}. La sede quedó en ${String(r.estado || destino).replace('_', ' ').toLowerCase()}.` +
        (r.correo_aviso === true ? ' Se le avisó por correo a quien lo radicó.' : ''), 'ok');
      await cargarBandejaVerificacion();
    } catch (err) {
      avisar('No se pudo contactar el servidor. Intente de nuevo.', 'error');
      btnEmitir.disabled = false; btnDevolver.disabled = false; msg.textContent = '';
    }
  }

