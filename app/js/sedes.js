/* app/js/sedes.js — Sedes por municipio y vista de un municipio.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* D-46: Sedes es el directorio. Se ven todas las sedes del alcance, estén
     vacías o no: así cualquier sede se encuentra navegando y se le puede
     registrar un presupuesto. El selector del encabezado solo decide sobre
     qué conjunto se cuenta. */

  // Filtro de la tabla de un municipio. Vuelve a 'todas' al cambiar de municipio.
  let muniFiltro = 'todas';
  const FILTROS_MUNI = {
    todas: ['Todas', () => true],
    con:   ['Con presupuesto', s => !!s.presupuesto],
    sin:   ['Sin presupuesto', s => !s.presupuesto],
    falta: ['Con daño y sin presupuesto', s => conDano(s) && !s.presupuesto],
  };

  function pintarSedesReal(){
    const tbody = document.getElementById('sedes-tbody');
    const pie = document.getElementById('sedes-pie');
    const R = ROLES[rol];
    if (!SEDES){
      tbody.innerHTML = filasEsqueleto(7, 6);
      pie.textContent = '';
      return;
    }
    const sedesVista = universo();
    const porMuni = agruparPorMunicipio(sedesVista);
    if (!porMuni.size){
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--tx-sec);padding:1rem">${!SEDES.length
        ? 'No llegaron sedes del servidor. Pulse «Actualizar» en unos segundos.'
        : 'No hay sedes en esta selección.'}</td></tr>`;
      pie.textContent = descripcionUniverso(sedesVista);
      return;
    }
    tbody.innerHTML = '';
    [...porMuni.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es')).forEach(([muni, sedes]) => {
      const c = conteoGrupos(sedes);
      const dano = sedes.filter(conDano).length;
      const conP = sedes.filter(s => !!s.presupuesto).length;
      const valor = sedes.reduce((a, s) => a + valorRadicado(s), 0);
      const hayRadicado = sedes.some(radicada);
      const ultimas = sedes.map(ultimaActividadDe).filter(Boolean).map(d => d.getTime());
      const ultima = ultimas.length ? new Date(Math.max(...ultimas)) : null;
      const tr = document.createElement('tr');
      tr.className = 'click';
      tr.tabIndex = 0;
      tr.innerHTML =
        `<td><strong>${esc(muni)}</strong></td><td class="n">${sedes.length}</td><td class="n">${dano}</td><td class="n">${conP}</td>` +
        `<td>${barraGrupos(sedes)}` +
        `<div class="seg-tx">${c.pend} sin radicar · ${c.curso} en trámite · ${c.apr} aprobada${c.apr === 1 ? '' : 's'}</div></td>` +
        `<td class="n">${hayRadicado ? esc(cop(valor)) : '—'}</td>` +
        `<td class="hace">${ultima ? esc(hace(ultima)) : '—'}</td>`;
      tr.addEventListener('click', () => irMuni(muni));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') irMuni(muni); });
      tbody.appendChild(tr);
    });
    pie.textContent = `${descripcionUniverso(sedesVista)} ${porMuni.size} municipio${porMuni.size === 1 ? '' : 's'}. ` +
      '«Con daño» son los tipos 1 a 4 del censo; «Sin radicar» incluye borradores. Haga clic en un municipio para ver sus sedes.';
  }

  function pintarMuniReal(){
    const $ = id => document.getElementById(id);
    const R = ROLES[rol];
    $('muni-titulo').textContent = muniActual || '(sin municipio)';
    if (!SEDES){
      $('muni-cifras').innerHTML = esqueletoLineas(2);
      $('muni-filtros').innerHTML = '';
      $('muni-tbody').innerHTML = filasEsqueleto(8, 4);
      return;
    }
    const sedesMuni = universo().filter(s => s.municipio === muniActual);
    const c = conteoGrupos(sedesMuni);
    const radicadas = sedesMuni.filter(radicada).length;
    const esperan = sedesMuni.filter(s => estadoDe(s) === 'RADICADO' || estadoDe(s) === 'EN_VERIFICACION').length;
    const valor = sedesMuni.reduce((a, s) => a + valorRadicado(s), 0);

    $('muni-cifras').innerHTML =
      `<div class="cifra"><b class="n">${sedesMuni.length}</b><span>${esc(etiquetaUniverso())}</span></div>` +
      `<div class="cifra"><b class="n">${sedesMuni.filter(conDano).length}</b><span>Con daño reportado</span></div>` +
      `<div class="cifra"><b class="n">${radicadas}</b><span>Con presupuesto radicado</span></div>` +
      `<div class="cifra al"><b class="n">${esperan}</b><span>Esperando verificación</span></div>` +
      `<div class="cifra ok"><b class="n">${c.apr}</b><span>Aprobadas</span></div>` +
      `<div class="cifra"><b class="n">${esc(cop(valor))}</b><span>Valor radicado</span></div>`;

    if (!FILTROS_MUNI[muniFiltro]) muniFiltro = 'todas';
    $('muni-filtros').innerHTML = Object.entries(FILTROS_MUNI).map(([k, [txt, f]]) =>
      `<button type="button" class="chip" data-filtro="${k}" aria-pressed="${k === muniFiltro}">${txt} <b>${sedesMuni.filter(f).length}</b></button>`).join('');
    const sedes = sedesMuni.filter(FILTROS_MUNI[muniFiltro][1]);
    $('muni-eyebrow').textContent = `${sedes.length} de ${sedesMuni.length}`;

    const tbody = $('muni-tbody');
    tbody.innerHTML = '';
    // Primero lo que está en trámite; luego lo que falta por presupuestar,
    // del daño más grave al más leve (sin clasificar al final); al final lo aprobado.
    const orden = { curso: 0, pend: 1, apr: 2 };
    const tipoOrden = s => tipoNum(s) || 9;
    sedes.slice().sort((a, b) => orden[grupoDe(a)] - orden[grupoDe(b)] || tipoOrden(a) - tipoOrden(b)).forEach(s => {
      const p = s.presupuesto;
      const origen = !p ? '—' : (p.origen === 'CARGA' ? '<span class="orig xls">XLS</span>' : '<span class="orig man">MAN</span>');
      const tr = document.createElement('tr');
      tr.className = 'click';
      tr.tabIndex = 0;
      tr.dataset.dane = s.dane_sede;
      tr.innerHTML =
        `<td>${esc(nombreSedeCorto(s))}</td><td class="dane">${esc(s.dane_sede)}</td><td>${tipoChip(s)}</td>` +
        `<td data-sed>${s.lote ? esc(s.lote.nombre) : '<span class="ctr">sin lote</span>'}</td>` +
        `<td class="n">${p ? esc(cop(p.total_presupuesto)) : '—'}</td><td>${origen}</td>` +
        `<td>${p ? 'v' + esc(p.version) : '—'}</td><td>${estadoBadge(s)}</td>`;
      tr.addEventListener('click', () => irFicha(s.dane_sede));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') irFicha(s.dane_sede); });
      tbody.appendChild(tr);
    });
    if (!sedes.length) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--tx-sec);padding:1rem">${sedesMuni.length
      ? 'Ninguna sede de este municipio cumple el filtro.' : 'Este municipio no tiene sedes en esta selección.'}</td></tr>`;
    $('muni-pie').textContent = `${descripcionUniverso(sedesMuni)} Haga clic en una sede para ver su ficha${R.edita ? ' o registrar su presupuesto' : ''}.`;
  }
