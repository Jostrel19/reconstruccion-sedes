/* app/js/iniciocampana.js — Inicio de la Secretaría durante la campaña de confirmación de sedes (D-54).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md.

   Lo ven Administrador, Verificador y Consulta mientras CAMPANA_CONFIRMACION esté encendida; al apagarla vuelve el
   Inicio de presupuestos (inicio.js). Muestra (bento, muestra aprobada por el usuario el 2026-10-07):
     · el mapa 3D de Caldas a todo el ancho y casi a la altura de la pantalla (mapa3d.js), con color por estado o por
       porcentaje y círculos por cantidad;
     · el anillo de 26 municipios (verde = cargada) con el desglose por etapa, que resalta esos municipios en el mapa;
     · las sedes con respuesta, su composición y el ritmo de respuestas por día.
   «Quién interviene» y «Estado de las obras» se retiraron el 2026-10-07 a pedido del usuario, para darle el espacio al mapa.
   Todo se calcula en el navegador con lo que ya trae listarConfirmaciones (CONF): no cambia el servidor.
   No repite el panel «Confirmación de alcaldes» (ni la ruta por municipio, ni «Para llamar hoy», ni la tabla). */

  let icMapa = null, icDatosMapa = null, icCargandoMapa = null, icErrorMapa = '';
  let icColor = 'estado', icCirculo = 'pend', icFoco = null, icAnimadoTok = null;
  const icNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const icPct = (a, b) => b ? Math.round(100 * a / b) : 0;
  const icHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const icMezcla = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // Color de cada etapa en el mapa: el mismo de la ruta del panel, en el tono de relleno (más fuerte que el de las etiquetas).
  const IC_ETAPA = {
    car: ['Certificación cargada', '#1E9B5B'], pdf: ['Falta firmar y cargar', '#2BBFAE'], des: ['Cargada y desactualizada', '#EA580C'],
    res: ['Respondiendo', '#F5A524'], sin: ['Sin empezar', '#EC7A93'] };
  const IC_NA = '#CBD2D9';
  // Rampas: rosa = lo que falta por responder; gris pizarra = con intervención (no es un estado de la campaña).
  const IC_RAMPA = { sinresp: ['#FCEBEF', '#9F1239'], con: ['#EEF2F6', '#334155'] };
  const icEtapa = m => typeof colorConf === 'function' ? colorConf(m.estado) : 'sin';
  const icQuieto = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Resumen por municipio a partir de CONF (lo calcula el servidor; aquí solo se agrega).
  function icResumen(){
    const porMuni = {};
    CONF.municipios.forEach(m => { porMuni[icNorm(m.municipio)] = { m, graves: 0, gravesSin: 0 }; });
    CONF.sedes.forEach(s => {
      const t = tipoNum(s), x = porMuni[icNorm(s.municipio)];
      if (!x || !(t === 1 || t === 2)) return;
      x.graves++; if (!s.respuesta) x.gravesSin++;
    });
    return porMuni;
  }

  function cargarMapaCaldas(){
    if (icDatosMapa || icCargandoMapa) return icCargandoMapa;
    icCargandoMapa = fetch('data/caldas3d.json?v=21').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => { icDatosMapa = d; icErrorMapa = ''; })
      .catch(() => { icErrorMapa = 'No se pudo cargar el mapa. Las cifras de abajo sí están al día.'; })
      .finally(() => { icCargandoMapa = null; if (vista === 'inicio') pintarInicioCampana(); });
    return icCargandoMapa;
  }

  function pintarInicioCampana(){
    const $ = id => document.getElementById(id);
    if (!CONF){
      $('ic-anillo').innerHTML = confError ? `<p class="vacio-tx">${esc(confError)}</p>` : esqueletoLineas(4);
      $('ic-resp').innerHTML = confError ? '' : esqueletoLineas(3);
      return;
    }
    const animar = !!sesion && icAnimadoTok !== sesion.token && !icQuieto();
    if (sesion) icAnimadoTok = sesion.token;
    $('ic-bento').classList.toggle('ic-anima', animar);
    const res = icResumen();
    pintarIcAnillo(animar);
    pintarIcRespuestas(animar);
    $('ic-pie').textContent = `Los ${CONF.municipios.length} municipios de la campaña; sedes oficiales, activas y con matrícula, sin Manizales. ` +
      'Mapa: límites del DANE y relieve SRTM promediado a 1 km, con la altura exagerada 4 veces. ' +
      'El ritmo de respuestas usa la fecha de la respuesta vigente de cada sede: si una sede se corrigió, cuenta el día de la corrección.';
    pintarIcMapa(res);
  }

  /* ─── Mapa ─── */
  function pintarIcMapa(res){
    const $ = id => document.getElementById(id);
    if (!icDatosMapa){
      $('ic-mapa-estado').textContent = icErrorMapa || 'Cargando el mapa…';
      $('ic-mapa-estado').classList.remove('oculto');
      if (!icErrorMapa) cargarMapaCaldas();
      return;
    }
    $('ic-mapa-estado').classList.add('oculto');
    const datoDe = m => res[icNorm(m.name)] || null;
    if (!icMapa){
      icMapa = crearMapa3D({
        datos: icDatosMapa, canvas: $('ic-cv'), lienzo: $('ic-stage'), etiquetas: $('ic-etq'), marcadores: $('ic-marc'), tooltip: $('ic-tip'),
        // Al elegir un municipio la cámara se corre a la izquierda para dejar sitio a su resumen (flota a la derecha).
        corrimiento: { tx: 0, ty: 0, txSel: 16 },
        // Lo que flota encima del mapa: el encuadre automático deja a Caldas en el espacio libre. En escritorio el título y
        // los controles ocupan una franja arriba y Caldas usa todo el ancho; se mide la franja real (cambia con el texto).
        // Los 30 px de más arriba son para los círculos, que se dibujan encima del punto del municipio.
        margenes: w => { const f = icFranjas(); icFranjaPrev = f.t + '/' + f.b; return w > 600 ? { l: 16, r: 56, t: f.t + 30, b: f.b + 12 } : { l: 12, r: 12, t: f.t + 24, b: f.b + 12 }; },
        peso: m => { const x = icMapaDato(m); return x ? x.m.n_sedes : 0; },
        color: m => icColorDe(icMapaDato(m)),
        marcador: m => icMarcadorDe(icMapaDato(m)),
        textoTooltip: m => icTooltip(m, icMapaDato(m)),
        alElegir: k => { document.getElementById('ic-muni').value = String(k); pintarIcFicha(); },
        alGirar: () => document.querySelectorAll('#ic-vistas button').forEach(b => b.setAttribute('aria-pressed', 'false')),
      });
      if (!icMapa.webgl) $('ic-mapa-estado').textContent = 'Este navegador no puede dibujar el mapa en 3D: se muestra plano.';
      if (!icMapa.webgl) $('ic-mapa-estado').classList.remove('oculto');
      icOpcionesMunicipio();
    }
    icMapaRes = res;
    icMapa.repintar();
    pintarIcLeyenda();
    pintarIcFicha();
    document.querySelectorAll('#ic-color button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === icColor));
    document.querySelectorAll('#ic-circ button').forEach(b => b.setAttribute('aria-pressed', b.dataset.c === icCirculo));
  }
  let icMapaRes = {}, icFranjaPrev = '';
  const icMapaDato = m => icMapaRes[icNorm(m.name)] || null;

  // Lo que flota arriba y abajo del mapa (título, controles, leyenda), medido en la tarjeta. La fila de controles va
  // justo debajo del título, cuyo alto cambia con el texto; en celular los controles van abajo (claro.css).
  function icFranjas(){
    const card = document.querySelector('#s-ini-campana .ic-mapa'), tit = card && card.querySelector('.ic-titulo');
    if (!tit) return { t: 0, b: 0 };
    card.style.setProperty('--ic-ctl-top', (tit.offsetTop + tit.offsetHeight + 8) + 'px');
    const h = card.clientHeight; let t = 0, b = 0;
    card.querySelectorAll('.ic-titulo, .ic-controles, .ic-leyenda').forEach(el => {
      if (!el.offsetParent) return;
      const y0 = el.offsetTop, y1 = y0 + el.offsetHeight;
      if (y0 < h / 2) t = Math.max(t, y1); else b = Math.max(b, h - y0);
    });
    return { t, b };
  }
  // Si el texto del título o la leyenda cambió de alto, el mapa se vuelve a encuadrar (solo entonces: no deshace el zoom).
  function icReencuadrarSiCambia(){
    const f = icFranjas(), k = f.t + '/' + f.b;
    if (icMapa && icFranjaPrev && k !== icFranjaPrev) icMapa.reencuadrar();
    icFranjaPrev = k;
  }

  function icColorDe(x){
    if (!x) return icHex(IC_NA);
    const m = x.m, e = icEtapa(m);
    let c;
    if (icColor === 'sinresp'){ const [a, b] = IC_RAMPA.sinresp; c = icMezcla(icHex(a), icHex(b), m.n_sedes ? (m.n_sedes - m.respondidas) / m.n_sedes : 0); }
    else if (icColor === 'con'){ const [a, b] = IC_RAMPA.con; c = m.respondidas ? icMezcla(icHex(a), icHex(b), m.con_intervencion / m.respondidas) : icHex('#E2E8F0'); }
    else c = icHex(IC_ETAPA[e][1]);
    // Foco desde la leyenda o el desglose del anillo: los de otra etapa se apagan hacia gris.
    if (icFoco && !icEnFoco(m)) c = icMezcla(c, [0.88, 0.90, 0.92], 0.78);
    return c;
  }
  const icEnFoco = m => { const e = icEtapa(m); return icFoco === 'pdf' ? (e === 'pdf' || e === 'des') : e === icFoco; };
  function icMarcadorDe(x){
    if (!x || icCirculo === 'no') return null;
    const m = x.m, v = icCirculo === 'pend' ? m.n_sedes - m.respondidas : m.respondidas;
    return { v, cls: icCirculo === 'pend' ? 'c-pend' : 'c-resp', apagado: !!icFoco && !icEnFoco(m) };
  }
  function icTooltip(mu, x){
    if (!x) return `<div class="r1"><b>${esc(mu.name)}</b><span class="est e-na">No participa</span></div><em>Secretaría de educación certificada aparte</em>`;
    const m = x.m;
    return `<div class="r1"><b>${esc(mu.name)}</b>${estadoConfBadge(m)}</div>
      <table><tr><th>Sedes respondidas</th><td>${m.respondidas} de ${m.n_sedes}</td></tr>
      <tr><th>Con intervención</th><td>${m.con_intervencion}</td></tr>
      <tr><th>Nivel 1 y 2 sin responder</th><td>${x.graves ? `${x.gravesSin} de ${x.graves}` : 'no tiene'}</td></tr></table>
      <em>Clic para ver su resumen</em>`;
  }

  function pintarIcLeyenda(){
    const el = document.getElementById('ic-leyenda'), sub = document.getElementById('ic-mapa-sub');
    const ms = CONF.municipios, cuenta = p => ms.filter(m => p === 'pdf' ? ['pdf', 'des'].includes(icEtapa(m)) : icEtapa(m) === p).length;
    let html;
    if (icColor === 'estado'){
      html = ['car', 'pdf', 'res', 'sin'].map(p => `<button type="button" data-foco="${p}" aria-pressed="${icFoco === p}"><i style="background:${IC_ETAPA[p][1]}"></i>${IC_ETAPA[p][0]} · ${cuenta(p)}</button>`).join('');
      sub.textContent = icFoco ? `Resaltados: «${IC_ETAPA[icFoco][0]}». Clic otra vez para ver todos.` : 'El color es la etapa de la certificación. Clic en una etapa para resaltarla.';
    } else {
      const [a, b] = IC_RAMPA[icColor];
      html = `<span class="ic-rampa"><span>0 %</span><i style="background:linear-gradient(90deg,${a},${b})"></i><span>100 %</span></span>`;
      sub.textContent = icColor === 'sinresp' ? 'Más oscuro = mayor parte de sus sedes sin responder.' : 'Más oscuro = mayor parte de sus sedes respondidas con intervención.';
    }
    if (icCirculo !== 'no'){
      const mx = Math.max(1, ...ms.map(m => icCirculo === 'pend' ? m.n_sedes - m.respondidas : m.respondidas));
      html += `<span class="ic-ley-c ${icCirculo === 'pend' ? 'c-pend' : 'c-resp'}"><b></b><b></b>${icCirculo === 'pend' ? 'Sedes por responder' : 'Sedes respondidas'} · máx. ${mx}</span>`;
    }
    el.innerHTML = html;
    // El título dice lo que muestra el color del mapa.
    const [tt, aria] = IC_TITULO[icColor] || IC_TITULO.estado;
    document.getElementById('ic-mapa-t').textContent = tt;
    document.getElementById('ic-cv').setAttribute('aria-label', `Mapa 3D de Caldas coloreado por ${aria} de cada municipio. Para recorrerlo con teclado use el selector «Municipio».`);
    icReencuadrarSiCambia();
  }
  const IC_TITULO = {
    estado: ['Dónde falta la certificación firmada', 'la etapa de la certificación'],
    sinresp: ['Dónde faltan sedes por responder', 'el porcentaje de sedes sin responder'],
    con: ['Dónde hay sedes con intervención', 'el porcentaje de sedes respondidas con intervención'],
  };

  function pintarIcFicha(){
    const el = document.getElementById('ic-ficha'), pista = document.getElementById('ic-pista');
    const k = icMapa ? icMapa.elegido() : -1, mu = k >= 0 ? icMapa.munis[k] : null;
    el.hidden = !mu; pista.classList.toggle('oculto', !!mu);
    if (!mu) return;
    const x = icMapaDato(mu);
    if (!x){
      el.innerHTML = `<button class="ic-cerrar" type="button" data-ic="cerrar" aria-label="Cerrar">✕</button><div class="eyebrow">Municipio</div><h3>${esc(mu.name)}</h3>
        <p class="sub">Manizales es secretaría de educación certificada aparte: no entra en esta campaña.</p>`;
      return;
    }
    const m = x.m, falta = m.n_sedes - m.respondidas, sinI = m.respondidas - m.con_intervencion;
    el.innerHTML = `<button class="ic-cerrar" type="button" data-ic="cerrar" aria-label="Cerrar">✕</button><div class="eyebrow">Municipio</div><h3>${esc(mu.name)}</h3>
      <div class="ic-ficha-est">${estadoConfBadge(m)}${typeof entregaChip === 'function' ? entregaChip(m) : ''}</div>
      <div class="ic-apil" role="img" aria-label="${m.con_intervencion} con intervención, ${sinI} sin intervención, ${falta} sin responder">
        <i style="flex:${m.con_intervencion};background:var(--ic-con)"></i><i style="flex:${sinI};background:var(--ic-sin)"></i><i style="flex:${falta};background:var(--sin-pt)"></i></div>
      <table class="ic-kv"><tr><th>Sedes respondidas</th><td>${m.respondidas} de ${m.n_sedes} (${icPct(m.respondidas, m.n_sedes)} %)</td></tr>
        <tr><th>Con intervención</th><td>${m.con_intervencion}</td></tr>
        <tr><th>Nivel 1 y 2</th><td>${x.graves ? `${x.graves} · ${x.gravesSin} sin responder` : 'ninguna'}</td></tr></table>
      <button class="b mini ic-abrir" type="button" data-ic="abrir" data-muni="${esc(m.municipio)}">Ver en «Confirmación de alcaldes» →</button>`;
  }

  /* ─── Anillo de 26 en dos tonos y desglose por etapa ─── */
  function pintarIcAnillo(animar){
    const ms = CONF.municipios, n = ms.length, carg = ms.filter(m => m.estado === 'CARGADA').length;
    const svg = typeof anilloAvanceSvg === 'function' ? anilloAvanceSvg(carg, n) : '';
    const cuenta = p => ms.filter(m => p === 'pdf' ? ['pdf', 'des'].includes(icEtapa(m)) : icEtapa(m) === p).length;
    const nDes = ms.filter(m => icEtapa(m) === 'des').length;
    document.getElementById('ic-anillo').innerHTML = `<div class="eyebrow">Certificación firmada</div><h2 class="ic-tt">Municipios con la certificación cargada</h2>
      <div class="ic-anillo-fila"><div class="ic-anillo" role="img" aria-label="${carg} de ${n} municipios con la certificación cargada">${svg}
        <div class="ic-centro"><b data-ic-n="${carg}">${animar ? 0 : carg}</b><span>de ${n}</span></div></div>
        <table class="ic-etapas" aria-label="Municipios por etapa; clic para resaltarlos en el mapa">${['car', 'pdf', 'res', 'sin'].map(p =>
          `<tr data-foco="${p}" tabindex="0"${icFoco && icFoco !== p ? ' class="apag"' : ''}><td><i style="background:${IC_ETAPA[p][1]}"></i>${IC_ETAPA[p][0]}${p === 'pdf' && nDes ? ` <span class="tenue">(${nDes} desactualizada${nDes === 1 ? '' : 's'})</span>` : ''}</td><td>${cuenta(p)}</td></tr>`).join('')}</table></div>`;
    if (animar) icContar(document.getElementById('ic-anillo'));
  }

  /* ─── Sedes con respuesta: cifra, composición y ritmo por día ─── */
  function pintarIcRespuestas(animar){
    const ms = CONF.municipios;
    const n = ms.reduce((a, m) => a + m.n_sedes, 0), resp = ms.reduce((a, m) => a + m.respondidas, 0), con = ms.reduce((a, m) => a + m.con_intervencion, 0);
    const sinI = resp - con, falta = n - resp;
    document.getElementById('ic-resp').innerHTML = `<div class="eyebrow">Sedes</div><h2 class="ic-tt">Sedes con respuesta</h2>
      <div class="ic-resp-fila"><div>
        <div class="ic-num"><b data-ic-n="${resp}">${animar ? 0 : formatNumIc(resp)}</b><small> de ${formatNumIc(n)} · ${icPct(resp, n)} %</small></div>
        <div class="ic-apil grande" role="img" aria-label="${con} con intervención, ${sinI} sin intervención, ${falta} sin responder">
          <i style="flex:${con};background:var(--ic-con)"></i><i style="flex:${sinI};background:var(--ic-sin)"></i><i style="flex:${falta};background:var(--sin-pt)"></i></div>
        <div class="ic-ley"><span><i style="background:var(--ic-con)"></i><b>${formatNumIc(con)}</b> con intervención</span><span><i style="background:var(--ic-sin)"></i><b>${formatNumIc(sinI)}</b> sin intervención</span><span><i style="background:var(--sin-pt)"></i><b>${formatNumIc(falta)}</b> sin responder</span></div>
      </div>${icSparkline(n)}</div>`;
    if (animar) icContar(document.getElementById('ic-resp'));
  }
  const formatNumIc = v => new Intl.NumberFormat('es-CO').format(v);

  // Respuestas vigentes acumuladas por día (hora de Bogotá), del primer día con respuestas a hoy.
  function icSparkline(total){
    const dia = f => { const d = new Date(f); return isNaN(d) ? '' : d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); };
    const cuenta = {};
    CONF.sedes.forEach(s => { if (s.respuesta && s.respuesta.fecha_registro){ const d = dia(s.respuesta.fecha_registro); if (d) cuenta[d] = (cuenta[d] || 0) + 1; } });
    const dias = Object.keys(cuenta).sort();
    if (!dias.length) return '';
    const hoy = dia(new Date()), serie = [];
    for (let d = new Date(dias[0] + 'T12:00:00-05:00'); ; d = new Date(d.getTime() + 864e5)){
      const k = dia(d); serie.push(k); if (k >= hoy || serie.length > 120) break;
    }
    let acum = 0; const v = serie.map(k => (acum += cuenta[k] || 0));
    const w = 420, h = 92, nn = v.length, xx = i => 6 + (w - 12) * (nn > 1 ? i / (nn - 1) : 0), yy = a => h - 6 - (h - 18) * a / Math.max(1, total);
    const pts = v.map((a, i) => `${xx(i).toFixed(1)},${yy(a).toFixed(1)}`);
    const corte = typeof CONFIRMACION_PLAZO_ORIGINAL_FIN !== 'undefined' ? dia(CONFIRMACION_PLAZO_ORIGINAL_FIN) : '';
    const kC = serie.indexOf(corte);
    // El día de más respuestas, para decirlo en palabras (no solo en la línea).
    let pico = serie[0]; serie.forEach(k => { if ((cuenta[k] || 0) > (cuenta[pico] || 0)) pico = k; });
    const fmt = k => { const [, m, d] = k.split('-'); return `${+d} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][+m - 1]}`; };
    return `<div class="ic-spark"><div class="ic-spark-tit">Ritmo de respuestas <span>· acumulado por día</span></div>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Respuestas acumuladas: ${v[nn - 1]} al ${fmt(serie[nn - 1])}. El día con más respuestas fue el ${fmt(pico)}, con ${cuenta[pico]}.">
        ${kC >= 0 ? `<line x1="${xx(kC)}" x2="${xx(kC)}" y1="4" y2="${h}" stroke="#94A3B8" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}
        <path class="ic-area" d="M${pts.join(' L')} L${xx(nn - 1)},${h} L${xx(0)},${h}Z" fill="#64748B" opacity=".10"/>
        <path class="ic-linea" d="M${pts.join(' L')}" fill="none" stroke="#475569" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <circle cx="${xx(nn - 1)}" cy="${yy(v[nn - 1])}" r="3.5" fill="#475569" stroke="#fff" stroke-width="1.5"/></svg>
      <div class="ic-spark-eje"><span>${fmt(serie[0])}</span>${kC >= 0 ? '<span>plazo original</span>' : ''}<span>hoy</span></div>
      <p class="ic-spark-nota">El día con más respuestas fue el <b>${fmt(pico)}</b> (${formatNumIc(cuenta[pico])}).</p></div>`;
  }

  // Cifras que cuentan desde 0, una sola vez por sesión.
  function icContar(raiz){
    raiz.querySelectorAll('[data-ic-n]').forEach(el => {
      const fin = Number(el.dataset.icN), t0 = performance.now() + 200, dur = 900;
      const paso = t => { const p = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3); el.textContent = formatNumIc(Math.round(fin * e)); if (p < 1) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    });
  }

  function icEnfocar(p){
    icFoco = icFoco === p ? null : p;
    pintarIcAnillo(false);
    if (icMapa){ icMapa.repintar(); pintarIcLeyenda(); }
  }

  /* ─── Eventos (delegados: el contenido se vuelve a pintar). Los registra arranque.js, una sola vez. ─── */
  function prepararInicioCampana(){
    const sec = document.getElementById('s-ini-campana');
    if (!sec) return;
    sec.addEventListener('click', e => {
      const f = e.target.closest('[data-foco]'); if (f){ icEnfocar(f.dataset.foco); return; }
      const c = e.target.closest('#ic-color button'); if (c){ icColor = c.dataset.c; pintarIcMapa(icMapaRes); return; }
      const r = e.target.closest('#ic-circ button'); if (r){ icCirculo = r.dataset.c; pintarIcMapa(icMapaRes); return; }
      const v = e.target.closest('#ic-vistas button');
      if (v && icMapa){ icMapa.vista(v.dataset.v); document.querySelectorAll('#ic-vistas button').forEach(b => b.setAttribute('aria-pressed', b === v)); return; }
      if (e.target.closest('#ic-zin') && icMapa){ icMapa.acercar(.75); return; }
      if (e.target.closest('#ic-zout') && icMapa){ icMapa.acercar(1 / .75); return; }
      const a = e.target.closest('[data-ic]');
      if (a && a.dataset.ic === 'cerrar' && icMapa){ icMapa.elegir(-1); document.getElementById('ic-muni').value = '-1'; pintarIcFicha(); return; }
      if (a && a.dataset.ic === 'abrir'){ avMuni = a.dataset.muni; vista = 'confirmaciones'; window.scrollTo(0, 0); pintar(); }
    });
    sec.addEventListener('keydown', e => { const f = e.target.closest('tr[data-foco]'); if (f && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); icEnfocar(f.dataset.foco); } });
    // Teclado: el selector de municipio recorre el mapa sin mouse.
    document.getElementById('ic-muni').addEventListener('change', e => {
      if (!icMapa) return; const k = Number(e.target.value); icMapa.elegir(k); pintarIcFicha();
    });
  }
  function icOpcionesMunicipio(){
    const s = document.getElementById('ic-muni');
    if (!icMapa || s.options.length > 1) return;
    s.innerHTML = '<option value="-1">Todos los municipios</option>' + icMapa.munis.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(m => `<option value="${m.k}">${esc(m.name)}</option>`).join('');
  }
