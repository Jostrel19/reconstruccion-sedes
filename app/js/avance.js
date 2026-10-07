/* app/js/avance.js — Confirmación de alcaldes: avance que ve la Secretaría (D-48).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Solo lectura: Administrador, Verificador y Consulta ven los 26
     municipios, las respuestas de cada uno y descargan los PDF firmados.
     Nadie de la Secretaría responde por un alcalde (D-48). ─── */
  let avMuni = null; // municipio abierto en el detalle, o null para la lista

  /* Rediseño claro (2026-10-01, muestra aprobada por el usuario): arriba, «Certificación firmada» como una ruta de
     4 pasos con el nombre de cada municipio en el paso donde va, un anillo de 26 segmentos (verde = cargada), la cuenta
     regresiva del plazo y la frase «Para llamar hoy»; debajo, «Sedes respondidas». Los pasos y sus colores vienen de
     confirmacion.js (CONF_ETAPAS, colorConf); si un confirmacion.js anterior quedó en caché, se usa lo mínimo. */
  const avEtapas = typeof CONF_ETAPAS !== 'undefined' ? CONF_ETAPAS : [];
  const avColor = typeof colorConf === 'function' ? colorConf : () => 'sin';
  const AV_VISIBLES = 10;          // nombres por paso antes de «+N más»
  const avAbiertas = new Set();    // pasos con todos sus nombres a la vista
  let avAnimadoTok = null;         // el movimiento de entrada, una sola vez por sesión
  const avQuieto = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const avNombre = s => String(s).toLowerCase().replace(/(^|\s)(\S)/g, (x, a, b) => a + b.toUpperCase());
  const avPlural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  function alternarPasoAv(p){ if (avAbiertas.has(p)) avAbiertas.delete(p); else avAbiertas.add(p); pintarAvance(); }

  function pintarAvance(){
    const $ = id => document.getElementById(id);
    $('av-lista-caja').classList.toggle('oculto', !!avMuni);
    $('av-detalle').classList.toggle('oculto', !avMuni);
    // En el detalle de un municipio la ruta no se muestra: el detalle queda arriba, como en la muestra aprobada.
    $('av-franja').classList.toggle('oculto', !!avMuni);
    if (!CONF){
      $('av-franja').innerHTML = confError ? '' : esqueletoAvance();
      $('av-tbody').innerHTML = confError ? `<tr><td colspan="7" class="vacio-tx">${esc(confError)}</td></tr>` : filasEsqueleto(7, 8);
      $('av-pie').textContent = '';
      return;
    }
    if (avMuni && !CONF.municipios.some(m => m.municipio === avMuni)) avMuni = null;
    if (avMuni){ pintarAvanceMunicipio(); return; }

    const ms = CONF.municipios;
    const nSedes = ms.reduce((a, m) => a + m.n_sedes, 0);
    const resp = ms.reduce((a, m) => a + m.respondidas, 0);
    const con = ms.reduce((a, m) => a + m.con_intervencion, 0);
    const animar = !!sesion && avAnimadoTok !== sesion.token && !avQuieto();
    if (sesion) avAnimadoTok = sesion.token;
    $('av-franja').innerHTML = rutaAvanceHtml(ms, animar) + heroeAvanceHtml(nSedes, resp, con, animar);
    if (animar) animarAvance($('av-franja'));
    const n = $('av-n');
    if (n) n.textContent = ms.length;

    $('av-tbody').innerHTML = ms.map(m => {
      const pct = m.n_sedes ? Math.round(100 * m.respondidas / m.n_sedes) : 0;
      const al = (m.alcaldes || []).filter(a => a.activo);
      // El nombre tal como está en Usuarios (en mayúscula): es el que sale en la certificación.
      const alcalde = al.length ? al.map(a => esc(a.nombre)).join('<br>')
        : `<span class="fila-est er">${(m.alcaldes || []).length ? 'Alcalde inactivo' : 'Sin usuario'}</span>`;
      const ultimo = (m.certificaciones || []).find(c => c.evento === 'CARGADO');
      const cert = m.cargado
        ? `<button class="b sec mini" type="button" data-descargar="${esc(m.cargado.id_certificacion)}">Descargar PDF</button><span class="hace">${esc(hace(m.cargado.fecha))}</span>`
        : (ultimo ? `<button class="b sec mini" type="button" data-descargar="${esc(ultimo.id_certificacion)}">Descargar la anterior</button>` : '<span class="tenue">—</span>');
      const entrega = entregaChip(m);
      // La barra de «Respondidas» lleva el color del paso del municipio.
      return `<tr class="click" data-av-muni="${esc(m.municipio)}" tabindex="0">
        <td><b>${esc(m.municipio)}</b></td><td class="av-alc">${alcalde}</td><td class="n">${m.n_sedes}</td>
        <td class="av-resp"><div class="av-barra" role="img" aria-label="${m.respondidas} de ${m.n_sedes} respondidas"><i class="et-${avColor(m.estado)}" style="width:${pct}%"></i></div>
          <span class="hace">${m.respondidas} de ${m.n_sedes}</span></td>
        <td class="n">${m.con_intervencion}</td><td>${estadoConfBadge(m)}</td><td class="av-cert">${cert}${entrega}</td></tr>`;
    }).join('');
    $('av-pie').innerHTML = `Los ${ms.length} municipios de la campaña; sedes oficiales, activas y con matrícula, sin Manizales (${formatNum(nSedes, 0)}). ` +
      `Solo el alcalde de cada municipio responde y carga la certificación; aquí se consulta. Plazo: ${CONFIRMACION_PLAZO ? esc(CONFIRMACION_PLAZO) : 'en ampliación'}` +
      (typeof CONFIRMACION_PLAZO_ORIGINAL === 'undefined' ? '.' : ` (plazo original: ${esc(CONFIRMACION_PLAZO_ORIGINAL)}). ` +
        '«A tiempo» = la primera certificación cargada antes del plazo original; si la rehace después, la primera sigue contando.');
  }

  /* ─── Certificación firmada: la ruta ─── */

  const AV_META_PDF = { POR_GENERAR: 'falta el Word', GENERADA: 'Word descargado', DESACTUALIZADA: 'cambió respuestas' };
  const AV_AYUDA_PDF = { POR_GENERAR: 'respondió todas las sedes; le falta descargar el Word, firmarlo y cargar el PDF',
    GENERADA: 'descargó el Word; le falta firmarlo y cargar el PDF',
    DESACTUALIZADA: 'cargó la certificación y después cambió respuestas: debe descargar, firmar y cargar una nueva' };
  // Orden dentro de cada paso: los que más sedes tienen sin empezar, los más avanzados respondiendo,
  // y en «Falta firmar y cargar» primero los que deben cargar una nueva.
  const AV_ORDEN = { sin: (a, b) => b.n_sedes - a.n_sedes, res: (a, b) => b.respondidas / b.n_sedes - a.respondidas / a.n_sedes,
    pdf: (a, b) => AV_ORDEN_PDF.indexOf(a.estado) - AV_ORDEN_PDF.indexOf(b.estado), car: () => 0 };
  const AV_ORDEN_PDF = ['DESACTUALIZADA', 'GENERADA', 'POR_GENERAR'];

  /* Plazo y trazabilidad (D-53). Siempre se muestran las dos fechas: el plazo original (constancia, no se borra) y el
     vigente. Sin fecha vigente (plazo en ampliación) no hay cuenta regresiva: el aviso va en gris, que no es un estado
     de la campaña. */
  const plazoOriginalVencido = () => typeof CONFIRMACION_PLAZO_ORIGINAL_FIN !== 'undefined' && Date.now() > new Date(CONFIRMACION_PLAZO_ORIGINAL_FIN).getTime();
  const plazoOriginalHtml = () => typeof CONFIRMACION_PLAZO_ORIGINAL === 'undefined' ? ''
    : `<span class="av-plazo-orig">Plazo original: <b>${esc(CONFIRMACION_PLAZO_ORIGINAL)}</b>${plazoOriginalVencido() ? ' · venció' : ''}</span>`;
  function plazoAvanceHtml(){
    if (typeof CONFIRMACION_PLAZO_FECHA === 'undefined') return '';
    let pastilla;
    if (!CONFIRMACION_PLAZO_FECHA) pastilla = '<span class="av-plazo p-amp">Plazo en ampliación</span>';
    else {
      const [a, me, d] = CONFIRMACION_PLAZO_FECHA.split('-').map(Number);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const dias = Math.round((new Date(a, me - 1, d) - hoy) / 864e5);
      const [cl, tx] = dias < 0 ? ['p-urg', `El plazo venció el ${CONFIRMACION_PLAZO}`]
        : dias === 0 ? ['p-urg', `Hoy, ${CONFIRMACION_PLAZO}, vence el plazo`]
        : dias === 1 ? ['p-urg', 'Mañana vence el plazo']
        : [dias <= 3 ? 'p-med' : 'p-ok', `Faltan ${dias} días · plazo ${CONFIRMACION_PLAZO}`];
      pastilla = `<span class="av-plazo ${cl}">${tx}</span>`;
    }
    return `<span class="av-plazos">${pastilla}${plazoOriginalHtml()}</span>`;
  }

  /* ¿Entregó a tiempo? Se calcula de las fechas que ya guarda la hoja Certificaciones, sin tocar el servidor: la PRIMERA
     certificación cargada frente al corte del plazo original. Si después rehace el PDF (p. ej. por el formato), la
     fecha de la nueva se ve aparte y no borra que entregó a tiempo. Es una marca informativa, no un estado de la campaña. */
  function entregaPlazo(m){
    const cargas = (m.certificaciones || []).filter(c => c.evento === 'CARGADO').map(c => new Date(c.fecha)).filter(d => !isNaN(d)).sort((x, y) => x - y);
    if (!cargas.length || typeof CONFIRMACION_PLAZO_ORIGINAL_FIN === 'undefined') return { clave: 'sin', texto: 'Sin cargar', primera: null };
    const aTiempo = cargas[0] <= new Date(CONFIRMACION_PLAZO_ORIGINAL_FIN);
    return { clave: aTiempo ? 'a-tiempo' : 'ampliacion', texto: aTiempo ? 'A tiempo' : 'En la ampliación', primera: cargas[0] };
  }
  const entregaChip = m => { const e = entregaPlazo(m); return e.primera ? `<span class="av-entrega ${e.clave}" title="Primera certificación cargada: ${esc(new Date(e.primera).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }))}">${e.texto}</span>` : ''; };

  // Un segmento por municipio: se ve que son 26 y cuántos ya están (verde = cargada, gris = todavía no).
  function anilloAvanceSvg(n, total){
    const C = 78, R = 64, hueco = 2.6, rad = g => g * Math.PI / 180;
    const pt = a => `${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)}`;
    let s = '';
    for (let i = 0; i < total; i++){
      const a0 = rad(-90 + i * 360 / total + hueco / 2), a1 = rad(-90 + (i + 1) * 360 / total - hueco / 2);
      s += `<path${i < n ? ' class="s-car"' : ''} d="M ${pt(a0)} A ${R} ${R} 0 0 1 ${pt(a1)}"/>`;
    }
    return `<svg viewBox="0 0 156 156" aria-hidden="true">${s}</svg>`;
  }

  function chipAvance(m, p){
    const n = avNombre(m.municipio);
    let cl = '', st = '', meta, ayuda;
    if (p === 'sin'){ meta = `${m.n_sedes} sedes`; ayuda = `${m.n_sedes} sedes sin responder`; }
    else if (p === 'res'){
      const pc = m.n_sedes ? Math.round(100 * m.respondidas / m.n_sedes) : 0;
      meta = `${pc} %`; cl = 'lleno'; st = ` style="--p:${pc}%"`; ayuda = `${m.respondidas} de ${m.n_sedes} sedes respondidas`;
    } else if (p === 'pdf'){ meta = AV_META_PDF[m.estado] || ''; ayuda = AV_AYUDA_PDF[m.estado] || ''; if (m.estado === 'DESACTUALIZADA') cl = 'alerta'; }
    else { meta = m.cargado ? hace(m.cargado.fecha) : ''; ayuda = `certificación firmada cargada ${meta}`; }
    return `<button type="button" class="av-chip ${cl}" data-av-muni="${esc(m.municipio)}"${st} title="${esc(n + ': ' + ayuda)}"` +
      ` aria-label="${esc(n + ': ' + ayuda + '. Abrir el detalle')}"><b>${esc(n)}</b><span>${esc(meta)}</span></button>`;
  }

  function rutaAvanceHtml(ms, animar){
    const total = ms.length;
    const grupos = avEtapas.map(e => ms.filter(m => e.estados.includes(m.estado)).sort(AV_ORDEN[e.p]));
    const de = p => grupos[avEtapas.findIndex(e => e.p === p)] || [];
    const sin = de('sin'), res = de('res'), pdf = de('pdf'), car = de('car');
    const nDes = pdf.filter(m => m.estado === 'DESACTUALIZADA').length;
    const pasos = avEtapas.map((e, k) => {
      const lista = grupos[k], ver = avAbiertas.has(e.p) ? lista : lista.slice(0, AV_VISIBLES), mas = lista.length - ver.length;
      const extra = mas > 0 ? `<button type="button" class="av-chip mas" data-av-mas="${e.p}">+${mas} más</button>`
        : (lista.length > AV_VISIBLES ? `<button type="button" class="av-chip mas" data-av-mas="${e.p}">Ver menos</button>` : '');
      return `<li class="av-paso" data-p="${e.p}"><div class="av-bola" aria-hidden="true">${lista.length}</div>
        <h3>${e.titulo}<span class="sr">: ${avPlural(lista.length, 'municipio', 'municipios')}</span></h3><p class="av-desc">${e.desc}</p>
        ${lista.length ? `<div class="av-chips">${ver.map(m => chipAvance(m, e.p)).join('')}${extra}</div>` : '<p class="av-ninguno">Ninguno</p>'}</li>`;
    }).join('');
    // Lo que hay que hacer hoy, con el color del paso del que habla.
    let etiqueta = 'Para llamar hoy:', hoy;
    if (total && car.length === total){
      etiqueta = 'Para revisar:';
      hoy = `los ${total} municipios cargaron la certificación firmada. Falta revisar cada PDF: firma, código de verificación y resumen.`;
    } else {
      const partes = [];
      if (pdf.length) partes.push(`<b class="t-pdf">${pdf.length} ${pdf.length === 1 ? 'municipio ya respondió' : 'municipios ya respondieron'} todas las sedes</b> y solo ${pdf.length === 1 ? 'le' : 'les'} falta la certificación firmada` +
        (nDes ? ` (<span class="t-des">${nDes === 1 ? 'uno la cargó y después cambió respuestas: debe cargar una nueva' : nDes + ' la cargaron y después cambiaron respuestas: deben cargar una nueva'}</span>)` : '') + '.');
      if (sin.length) partes.push(`<b class="t-sin">${sin.length} no ${sin.length === 1 ? 'ha' : 'han'} empezado</b>: ${formatNum(sin.reduce((a, m) => a + m.n_sedes, 0), 0)} sedes sin ninguna respuesta.`);
      if (!partes.length) partes.push(`${res.length === 1 ? 'el que falta está respondiendo sus sedes' : `los ${res.length} que faltan están respondiendo sus sedes`}.`);
      hoy = partes.join(' ');
    }
    return `<article class="av-tile av-ruta" aria-labelledby="av-ruta-tit">
      <div class="av-ruta-cab"><h2 id="av-ruta-tit">Certificación firmada</h2><span class="av-que">En qué paso va cada municipio</span>${plazoAvanceHtml()}</div>
      <div class="av-meta"><div class="av-anillo" role="img" aria-label="${car.length} de ${total} municipios ya cargaron la certificación firmada">${anilloAvanceSvg(car.length, total)}
          <div class="av-centro"><b data-av-n="${car.length}">${animar ? 0 : car.length}</b><span>de ${total}</span></div></div>
        <p>municipios ya cargaron la certificación firmada</p></div>
      <ol class="av-pasos">${pasos}</ol>
      <div class="av-hoy"><b>${etiqueta}</b> ${hoy}</div></article>`;
  }

  function heroeAvanceHtml(nSedes, resp, con, animar){
    const p = nSedes ? resp / nSedes : 0;
    return `<article class="av-tile av-heroe">
      <div><h2 class="av-rot">Sedes respondidas<span class="av-pct">${Math.round(p * 100)} %</span></h2>
        <div class="av-num"><b data-av-n="${resp}">${animar ? 0 : formatNum(resp, 0)}</b><small>/ ${formatNum(nSedes, 0)}</small></div></div>
      <div><div class="av-barra-g" role="img" aria-label="${formatNum(resp, 0)} de ${formatNum(nSedes, 0)} sedes respondidas"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
        <div class="av-sub"><div><b>${formatNum(con, 0)}</b><span>con intervención</span></div><div><b>${formatNum(resp - con, 0)}</b><span>sin intervención</span></div>
          <div class="pend"><b>${formatNum(nSedes - resp, 0)}</b><span>por responder</span></div></div></div></article>`;
  }

  function esqueletoAvance(){
    const col = '<div><b class="esq" style="display:block;width:38px;height:38px;border-radius:50%"></b><span class="esq esq-linea"></span><span class="esq esq-linea"></span><span class="esq" style="display:block;height:58px;margin-top:.6rem"></span></div>';
    return `<div class="av-tile av-ruta av-cargando"><div class="av-ruta-cab"><span class="esq" style="display:block;width:220px;height:18px"></span></div>
      <div class="av-meta"><span class="esq" style="display:block;width:156px;height:156px;border-radius:50%"></span></div><div class="av-pasos">${col.repeat(4)}</div></div>
      <div class="av-tile av-heroe av-cargando"><div><span class="esq" style="display:block;width:160px;height:16px"></span><span class="esq" style="display:block;width:190px;height:44px;margin-top:10px"></span></div>
        <div><span class="esq" style="display:block;height:10px"></span></div></div>`;
  }

  // Entrada: las cifras cuentan desde 0, los segmentos verdes del anillo y los nombres aparecen en orden.
  function animarAvance(cont){
    cont.querySelectorAll('[data-av-n]').forEach(el => {
      const fin = Number(el.dataset.avN), t0 = performance.now(), dur = 800;
      const paso = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = formatNum(Math.round(fin * (1 - Math.pow(1 - k, 3))), 0); if (k < 1) requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
    });
    if (!Element.prototype.animate) return;
    cont.querySelectorAll('.av-anillo path.s-car').forEach((s, i) => s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 250 + i * 55, easing: 'ease-out', fill: 'backwards' }));
    cont.querySelectorAll('.av-bola, .av-chip').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: Math.min(i, 30) * 16, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
  }

  function pintarAvanceMunicipio(){
    const $ = id => document.getElementById(id);
    const m = CONF.municipios.find(x => x.municipio === avMuni);
    const sedes = CONF.sedes.filter(s => s.municipio === avMuni);
    $('av-det-titulo').textContent = m.municipio;
    const [c, t] = ESTADO_CONF[m.estado] || ['e-pend', '—'];
    $('av-det-estado').className = 'est ' + c;
    $('av-det-estado').textContent = t;
    const ficha = $('av-det-ficha');
    if (ficha){
      // Ficha del municipio (2026-10-01, segunda muestra aprobada): dos tarjetas en vez de 8 cifras sueltas.
      ficha.innerHTML = fichaRespuestasHtml(m) + fichaCertificacionHtml(m);
      $('av-det-cifras').innerHTML = '';
      $('av-det-info').innerHTML = '';
      const n = $('av-det-n');
      if (n) n.textContent = m.n_sedes;
    } else {
      // index.html anterior en caché: las cifras y el párrafo de siempre.
      const al = (m.alcaldes || []).filter(a => a.activo);
      $('av-det-cifras').innerHTML = [
        ['', m.n_sedes, 'Sedes'], [(m.respondidas === m.n_sedes ? 'ok' : 'al') + ' et-' + avColor(m.estado), m.respondidas, 'Respondidas'],
        ['', m.con_intervencion, 'Con intervención'], ['', m.sin_intervencion, 'Sin intervención'],
        ...CONF_ESTADOS_OBRA.map(e => ['', (m.por_estado_obra || {})[e] || 0, e]),
      ].map(([cl, v, tx]) => `<div class="cifra ${cl}"><b>${v}</b><span>${esc(tx)}</span></div>`).join('');
      $('av-det-info').innerHTML =
        `<p><b>Alcalde:</b> ${al.length ? al.map(a => `${esc(a.nombre)} (${esc(a.correo)})`).join(', ') : 'sin usuario activo'}.` +
        (m.codigo_actual ? ` <b>Código de verificación vigente:</b> <span class="mono">${esc(m.codigo_actual)}</span> — el PDF firmado debe mostrarlo en el encabezado de la tabla, y su resumen debe coincidir con estas cifras.` : '') + '</p>' +
        (m.cargada_desactualizada ? '<p class="aviso-conf"><b>La certificación cargada ya no corresponde:</b> el alcalde cambió respuestas después de cargarla.</p>' : '') +
        (historialConfHtml(m, false) || '<p class="vacio-tx">Todavía no ha cargado ninguna certificación.</p>');
    }
    $('av-det-tbody').innerHTML = sedes.map((s, i) => {
      const r = s.respuesta;
      const si = r && r.tiene_intervencion === CONF_SI;
      // Sí / No es una respuesta, no un avance: va sin colores de estado.
      const resp = r ? `<span class="sino-r${si ? ' si' : ''}">${esc(r.tiene_intervencion)}</span>` : '<span class="tenue">Sin responder</span>';
      return `<tr${r ? '' : ' class="tenue"'}><td class="n">${i + 1}</td>
        <td class="conf-sede"><b>${esc(s.sede)}</b><span class="hace" title="${esc(s.institucion)}">${esc(s.institucion)}</span></td>
        <td class="mono">${esc(s.dane_sede)}</td><td class="conf-nivel">${nivelHtml(s)}</td>
        <td>${resp}</td><td>${si ? esc(r.quien_interviene) : '—'}</td>
        <td>${si && r.nombre_quien_interviene ? esc(r.nombre_quien_interviene) : '—'}</td><td>${si ? esc(r.estado_obra) : '—'}</td>
        <td>${r ? `<span class="hace">${esc(hace(r.fecha_registro))}</span>` : ''}</td></tr>`;
    }).join('');
  }

  // Tarjeta 1: cuántas sedes respondió, cómo respondieron (una sola barra con todas las sedes) y en qué va cada obra.
  // Sí/No son respuestas, no avances: van en gris oscuro y claro; «sin responder» en rosa, el color de lo que falta.
  function fichaRespuestasHtml(m){
    const n = m.n_sedes, resp = m.respondidas, con = m.con_intervencion, sin = m.sin_intervencion, pend = n - resp;
    const pct = x => n ? Math.round(100 * x / n) : 0;
    const seg = (cl, x) => x ? `<i class="${cl}" style="width:${(100 * x / n).toFixed(2)}%"></i>` : '';
    const porObra = CONF_ESTADOS_OBRA.map(e => (m.por_estado_obra || {})[e] || 0);
    const obras = con
      ? `<ol class="af-obras">${CONF_ESTADOS_OBRA.map((e, i) => `<li class="${i === CONF_ESTADOS_OBRA.length - 1 ? 'fin' : ''}"><b>${porObra[i]}</b><span>${esc(e)}</span>
          <div class="af-tr"><i style="width:${(100 * porObra[i] / con).toFixed(1)}%"></i></div></li>`).join('')}</ol>`
      : '<p class="af-nada">Ninguna sede con intervención todavía.</p>';
    return `<section class="af-card" aria-labelledby="af-t1"><h2 id="af-t1">Respuestas de las sedes</h2>
      <div class="af-resp"><div class="af-rot">Respondidas<span class="af-pct">${pct(resp)} %</span></div>
        <div class="af-num">${formatNum(resp, 0)}<small>/ ${formatNum(n, 0)}</small></div>
        <div><div class="af-barra" data-et="${avColor(m.estado)}" role="img" aria-label="${resp} de ${n} sedes respondidas"><i style="width:${pct(resp)}%"></i></div>
          <span class="af-nota">${pend ? `Faltan ${avPlural(pend, 'sede', 'sedes')} por responder` : 'Todas las sedes tienen respuesta'}</span></div></div>
      <div class="af-sec"><h3>Cómo respondieron <span>· ¿La sede tiene una intervención terminada o en proceso?</span></h3>
        <div class="af-apilada" role="img" aria-label="${con} con intervención, ${sin} sin intervención y ${pend} sin responder, de ${n} sedes">${seg('con', con)}${seg('sin', sin)}${seg('pend', pend)}</div>
        <ul class="af-ley"><li><i class="con"></i><b>${con}</b> con intervención <em>${pct(con)} %</em></li><li><i class="sin"></i><b>${sin}</b> sin intervención <em>${pct(sin)} %</em></li>
          <li><i class="pend"></i><b>${pend}</b> sin responder <em>${pct(pend)} %</em></li></ul></div>
      <div class="af-sec"><h3>Estado de las obras <span>· de ${con === 1 ? 'la sede' : `las ${con} sedes`} con intervención</span></h3>${obras}</div></section>`;
  }

  // Tarjeta 2: en qué va la certificación, con los nombres y colores de los pasos del alcalde. Son tres y no cuatro: el
  // paso 3 del alcalde (pasar el contenido a su formato) es una casilla que vive solo en su pantalla y el sistema no la guarda.
  function fichaCertificacionHtml(m){
    const e = m.estado, todas = m.n_sedes > 0 && m.respondidas === m.n_sedes;
    const generada = e === 'GENERADA' || e === 'CARGADA', cargada = e === 'CARGADA';
    const [cls, txt] = ESTADO_CONF[e] || ['e-pend', '—'];
    const paso = (cl, et, n, titulo, meta) => `<li class="${cl}" data-et="${et}"><span class="af-n" aria-hidden="true">${cl === 'hecho' ? '✓' : n}</span>` +
      `<div><b>${titulo}<span class="sr"> — ${cl === 'hecho' ? 'hecho' : (cl === 'act' ? 'paso actual' : 'pendiente')}</span></b><span class="af-m">${meta}</span></div></li>`;
    const p1 = paso(todas ? 'hecho' : 'act', 'res', 1, 'Responder todas las sedes',
      todas ? `Las ${m.n_sedes} tienen respuesta` : `${m.respondidas} de ${m.n_sedes} respondidas`);
    const p2 = paso(generada ? 'hecho' : (todas ? 'act' : 'pend'), 'pdf', 2, 'Descargar la certificación en Word',
      generada ? `Word descargado ${m.generado ? esc(hace(m.generado.fecha)) : ''}`
        : (todas ? (e === 'DESACTUALIZADA' ? 'Debe descargarla de nuevo: cambió respuestas' : 'Todavía no la ha descargado') : 'Se habilita con todas las sedes respondidas'));
    const p3 = paso(cargada ? 'hecho' : (generada ? 'act' : 'pend'), 'pdf', 3, 'Firmar, escanear y cargar',
      cargada ? `Cargada ${esc(hace(m.cargado.fecha))} · <button class="af-enlace" type="button" data-descargar="${esc(m.cargado.id_certificacion)}">Descargar PDF</button>`
        : (generada ? 'Falta cargar el PDF firmado' : 'Se habilita al generar la certificación'));
    const anterior = (m.certificaciones || []).find(c => c.evento === 'CARGADO');
    const aviso = m.cargada_desactualizada
      ? `<p class="af-aviso"><b>La certificación cargada ya no corresponde:</b> el alcalde cambió respuestas después de cargarla.` +
        (anterior ? ` <button class="af-enlace" type="button" data-descargar="${esc(anterior.id_certificacion)}">Descargar la anterior</button>` : '') + '</p>' : '';
    const codigo = m.codigo_actual
      ? `<div class="af-codigo"><span>Código de verificación vigente</span><code>${esc(m.codigo_actual)}</code><span>El PDF firmado debe mostrarlo en el encabezado de la tabla, y su resumen debe coincidir con estas cifras.</span></div>`
      : '<div class="af-codigo"><span>El código de verificación se genera cuando todas las sedes tengan respuesta.</span></div>';
    // Trazabilidad del plazo (D-53): primera carga, entrega frente al plazo original y la certificación vigente.
    const ent = entregaPlazo(m), fh = f => esc(new Date(f).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }));
    const traza = ent.primera
      ? `<div class="af-plazo"><span>Plazo original: ${esc(typeof CONFIRMACION_PLAZO_ORIGINAL === 'undefined' ? '' : CONFIRMACION_PLAZO_ORIGINAL)}</span>` +
        `<span>Primera carga: <b>${fh(ent.primera)}</b> · <span class="av-entrega ${ent.clave}">${ent.texto}</span></span>` +
        (m.cargado ? `<span>Certificación vigente: <b>${fh(m.cargado.fecha)}</b></span>` : '') + '</div>'
      : `<div class="af-plazo"><span>Plazo original: ${esc(typeof CONFIRMACION_PLAZO_ORIGINAL === 'undefined' ? '' : CONFIRMACION_PLAZO_ORIGINAL)}</span><span>Todavía no ha cargado ninguna certificación.</span></div>`;
    const al = (m.alcaldes || []).filter(a => a.activo);
    return `<section class="af-card" aria-labelledby="af-t2"><h2 id="af-t2">Certificación <span class="est ${cls}">${esc(txt)}</span></h2>
      ${aviso}<ol class="af-pasos">${p1}${p2}${p3}</ol>${codigo}${traza}
      <p class="af-alc">Alcalde: ${al.length ? al.map(a => `<b>${esc(a.nombre)}</b> · ${esc(a.correo)}`).join('; ') : '<b>sin usuario activo</b>'}</p>
      ${historialConfHtml(m, false)}</section>`;
  }

  function abrirAvanceMunicipio(m){ avMuni = m; window.scrollTo(0, 0); pintar(); }
  function cerrarAvanceMunicipio(){ avMuni = null; pintar(); }

  // Exportar a Excel: las respuestas vigentes de todas las sedes (o del
  // municipio abierto). Los campos son los del oficio más la identificación.
  const ENC_CONF_CSV = ['DANE sede', 'Municipio', 'Institución', 'Sede', 'Nivel de afectación (censo)',
    '¿Intervención terminada o en proceso?', 'Quién interviene', 'Nombre de quién interviene', 'Estado de la obra',
    'Registrado por', 'Fecha de registro', 'Estado del municipio', 'Código de verificación vigente',
    // Trazabilidad del plazo (D-53): se calculan aquí con las fechas de la hoja Certificaciones.
    'Primera carga', 'Entrega', 'Certificación vigente (carga)', 'Plazo aplicado'];
  // Un texto escrito por un usuario que empieza por = + - @ lo ejecutaría Excel como fórmula.
  const textoCSV = t => /^[=+\-@]/.test(String(t || '')) ? "'" + t : (t || '');
  // Primera carga · Entrega (a tiempo, en la ampliación o sin cargar) · fecha de la certificación vigente · plazo aplicado.
  function columnasPlazoCSV(m){
    const e = entregaPlazo(m);
    const orig = typeof CONFIRMACION_PLAZO_ORIGINAL === 'undefined' ? 'Original' : 'Original (' + CONFIRMACION_PLAZO_ORIGINAL + ')';
    return [e.primera ? fechaCSV(e.primera) : '', e.texto, m.cargado ? fechaCSV(m.cargado.fecha) : '',
      e.clave === 'a-tiempo' ? orig : (e.clave === 'ampliacion' ? 'Ampliación' : '')];
  }
  function exportarConfirmaciones(){
    if (!CONF) return;
    const sedes = avMuni ? CONF.sedes.filter(s => s.municipio === avMuni) : CONF.sedes;
    const porMuni = {};
    CONF.municipios.forEach(m => { porMuni[m.municipio] = m; });
    const filas = sedes.map(s => {
      const r = s.respuesta || {};
      const m = porMuni[s.municipio] || {};
      return [s.dane_sede, s.municipio, s.institucion, s.sede, nivelTexto(s), r.tiene_intervencion || 'Sin responder',
        r.quien_interviene || '', textoCSV(r.nombre_quien_interviene), r.estado_obra || '', r.registrado_por || '',
        fechaCSV(r.fecha_registro), (ESTADO_CONF[m.estado] || [0, ''])[1], m.codigo_actual || '',
        ...columnasPlazoCSV(m)];
    });
    descargarCSV(`confirmacion-alcaldes_${avMuni ? slug(avMuni) : 'todos'}_${hoyArchivo()}.csv`, ENC_CONF_CSV, filas);
  }
