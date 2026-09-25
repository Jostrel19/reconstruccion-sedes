/* app/js/tablero.js — Tablero y ayudas de agrupación por municipio.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Tablero / Sedes / Municipio ───
     Todo sale de SEDES (con el resumen del presupuesto vigente de cada sede)
     y de ACTIVIDAD. Ninguna cifra ni estado está escrito en el HTML: si no se
     ha registrado nada, se ve en cero o vacío, no simulado (D-43). */

  function agruparPorMunicipio(sedes){
    const porMuni = new Map();
    sedes.forEach(s => { if (!porMuni.has(s.municipio)) porMuni.set(s.municipio, []); porMuni.get(s.municipio).push(s); });
    return porMuni;
  }

  function conteoGrupos(sedes){
    const c = { pend: 0, curso: 0, apr: 0 };
    sedes.forEach(s => { c[grupoDe(s)]++; });
    return c;
  }

  let cifrasAnimadas = false;
  // Conteo ascendente de las cifras enteras de la franja, solo la primera vez
  // que llegan datos en la sesión (y nunca con "reducir movimiento").
  function animarCifras(cont){
    if (cifrasAnimadas) return;
    cifrasAnimadas = true;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cont.querySelectorAll('[data-n]').forEach(el => {
      const fin = Number(el.dataset.n);
      if (!fin) return;
      const t0 = performance.now(), dur = 650;
      const paso = t => {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = String(Math.round(fin * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(paso);
      };
      el.textContent = '0';
      requestAnimationFrame(paso);
    });
  }

  function barraGrupos(sedes){
    const c = conteoGrupos(sedes), n = sedes.length || 1;
    return `<div class="seg"><i style="width:${c.pend / n * 100}%;background:var(--borde-f)"></i>` +
      `<i style="width:${c.curso / n * 100}%;background:var(--oro)"></i><i style="width:${c.apr / n * 100}%;background:var(--ok)"></i></div>`;
  }

  // Franja de cifras que comparten Tablero (sobre la selección) e Inicio (sobre todo el alcance).
  function franjaHtml(sedes, etiqueta){
    const cifra = n => `<b class="n" data-n="${n}">${n}</b>`;
    const valor = sedes.reduce((a, s) => a + valorRadicado(s), 0);
    return `<div class="c">${cifra(sedes.length)}<span>${esc(etiqueta)}</span></div>` +
      `<div class="c">${cifra(sedes.filter(conDano).length)}<span>Con daño reportado</span></div>` +
      `<div class="c">${cifra(sedes.filter(radicada).length)}<span>Con presupuesto radicado</span></div>` +
      `<div class="c al">${cifra(sedes.filter(s => estadoDe(s) === 'RADICADO' || estadoDe(s) === 'EN_VERIFICACION').length)}<span>Esperando verificación</span></div>` +
      `<div class="c ok">${cifra(sedes.filter(s => estadoDe(s) === 'APROBADO').length)}<span>Aprobadas para obra</span></div>` +
      `<div class="c"><b class="n">${copCorto(valor)}</b><span>Valor radicado</span></div>`;
  }

  /* D-46: el Tablero es el informe. Sus cifras se calculan sobre el conjunto
     que dice el selector del encabezado (todas, con daño reportado o un lote),
     y el pie dice cuál es. El detalle por sede está en Sedes; lo pendiente de
     cada rol y los últimos movimientos, en Inicio. */
  function pintarTableroReal(){
    const $ = id => document.getElementById(id);
    if (!SEDES){
      $('tab-franja').innerHTML = esqueletoFranja(6);
      ['tab-valor', 'tab-avance', 'tab-afectacion'].forEach(id => { $(id).innerHTML = esqueletoLineas(4); });
      ['tab-valor-pie', 'tab-avance-pie', 'tab-afectacion-pie'].forEach(id => { $(id).textContent = ''; });
      return;
    }
    const seg = universo();
    const dano = seg.filter(conDano);
    const conPresupuesto = seg.filter(s => !!s.presupuesto);
    const radicadas = seg.filter(radicada);
    const ajuste = seg.filter(s => estadoDe(s) === 'REQUIERE_AJUSTE');
    const aprobadas = seg.filter(s => estadoDe(s) === 'APROBADO');
    const valorTotal = seg.reduce((a, s) => a + valorRadicado(s), 0);
    $('tab-franja').innerHTML = franjaHtml(seg, etiquetaUniverso());
    animarCifras($('tab-franja'));

    // Valor radicado por municipio, apilado por estado: aprobado y en trámite.
    const porValor = [...agruparPorMunicipio(seg).entries()].map(([muni, sedes]) => {
      const apr = sedes.filter(s => estadoDe(s) === 'APROBADO').reduce((a, s) => a + valorRadicado(s), 0);
      const total = sedes.reduce((a, s) => a + valorRadicado(s), 0);
      return [muni, total, apr];
    }).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const maxValor = porValor.length ? porValor[0][1] : 0;
    $('tab-valor').innerHTML = porValor.length
      ? porValor.map(([muni, total, apr]) =>
          `<div class="rk click" data-muni="${esc(muni)}" tabindex="0" role="link"><span class="nb" title="${esc(muni)}">${esc(muni)}</span><span class="pista">` +
          `<i style="width:${(apr / maxValor * 100).toFixed(1)}%;background:var(--ok)"></i>` +
          `<i style="width:${((total - apr) / maxValor * 100).toFixed(1)}%;background:var(--oro)"></i></span>` +
          `<span class="vl">${esc(cop(total))}</span></div>`).join('')
      : '<p class="vacio-tx">Todavía no hay presupuestos radicados en esta selección.</p>';
    $('tab-valor').querySelectorAll('[data-muni]').forEach(el => {
      el.addEventListener('click', () => irMuni(el.dataset.muni));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') irMuni(el.dataset.muni); });
    });
    $('tab-valor-pie').textContent = porValor.length
      ? `Total de las versiones vigentes radicadas, con A, U e IVA: ${cop(valorTotal)}. Los borradores no suman.`
      : '';

    // Avance — cada barra a escala sobre el total de la selección.
    const pct = n => seg.length ? (n / seg.length * 100) : 0;
    const conConcepto = seg.filter(s => ['REQUIERE_AJUSTE', 'APROBADO'].indexOf(estadoDe(s)) !== -1).length;
    const fila = (txt, n, color) =>
      `<div class="fila"><span>${txt}</span><span class="pista"><i style="width:${pct(n).toFixed(1)}%;background:${color}"></i></span><span class="vl n">${n}</span></div>`;
    $('tab-avance').innerHTML =
      fila(esc(etiquetaUniverso()), seg.length, 'var(--gris)') +
      fila('Con daño reportado', dano.length, 'var(--alerta)') +
      fila('Con presupuesto', conPresupuesto.length, 'var(--oro)') +
      fila('Radicado', radicadas.length, 'var(--verde)') +
      fila('Con concepto', conConcepto, 'var(--gris-osc)') +
      fila('Devueltas para ajuste', ajuste.length, 'var(--err)') +
      fila('Aprobadas para obra', aprobadas.length, 'var(--ok)');
    $('tab-avance-pie').textContent = descripcionUniverso(seg) +
      ' «Con daño reportado» son los tipos 1 a 4 del censo: las sedes tipo 5 (sin afectación) no necesariamente requieren presupuesto.' +
      ' «Con presupuesto» incluye borradores; «Radicado» no.';

    // Tipo de afectación del censo de las sedes mostradas, del 1 al 7.
    const porTipo = new Map();
    seg.forEach(s => { const t = tipoNum(s); porTipo.set(t, (porTipo.get(t) || 0) + 1); });
    const tipos = [1, 2, 3, 4, 5, 6, 7, 0].filter(t => porTipo.get(t));
    $('tab-afectacion').innerHTML = tipos.length ? `<div class="emb">` + tipos.map(t => {
      const n = porTipo.get(t);
      const conP = seg.filter(s => tipoNum(s) === t && s.presupuesto).length;
      return `<div class="fila"><span>${t ? tipoChipNum(t) + ' ' : ''}${esc(TIPO_TXT[t])}</span>` +
        `<span class="pista"><i style="width:${(n / seg.length * 100).toFixed(1)}%;background:${TIPO_COLOR[t]}"></i></span>` +
        `<span class="vl n" title="${conP} con presupuesto">${n}</span></div>`;
    }).join('') + `</div>` : '<p class="vacio-tx">Sin sedes en esta selección.</p>';
    $('tab-afectacion-pie').textContent = seg.length
      ? `Clasificación del censo de daños de las ${seg.length} sede${seg.length === 1 ? '' : 's'} de la selección.` : '';
  }
