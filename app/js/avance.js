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
      // La barra de «Respondidas» lleva el color del paso del municipio.
      return `<tr class="click" data-av-muni="${esc(m.municipio)}" tabindex="0">
        <td><b>${esc(m.municipio)}</b></td><td class="av-alc">${alcalde}</td><td class="n">${m.n_sedes}</td>
        <td class="av-resp"><div class="av-barra" role="img" aria-label="${m.respondidas} de ${m.n_sedes} respondidas"><i class="et-${avColor(m.estado)}" style="width:${pct}%"></i></div>
          <span class="hace">${m.respondidas} de ${m.n_sedes}</span></td>
        <td class="n">${m.con_intervencion}</td><td>${estadoConfBadge(m)}</td><td class="av-cert">${cert}</td></tr>`;
    }).join('');
    $('av-pie').innerHTML = `Los ${ms.length} municipios de la campaña; sedes oficiales, activas y con matrícula, sin Manizales (${formatNum(nSedes, 0)}). ` +
      `Solo el alcalde de cada municipio responde y carga la certificación; aquí se consulta. Plazo: ${esc(CONFIRMACION_PLAZO)}.`;
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

  function plazoAvanceHtml(){
    if (typeof CONFIRMACION_PLAZO_FECHA === 'undefined') return '';
    const [a, me, d] = CONFIRMACION_PLAZO_FECHA.split('-').map(Number);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(a, me - 1, d) - hoy) / 864e5);
    const [cl, tx] = dias < 0 ? ['p-urg', `El plazo venció el ${CONFIRMACION_PLAZO}`]
      : dias === 0 ? ['p-urg', `Hoy, ${CONFIRMACION_PLAZO}, vence el plazo`]
      : dias === 1 ? ['p-urg', 'Mañana vence el plazo']
      : [dias <= 3 ? 'p-med' : 'p-ok', `Faltan ${dias} días · plazo ${CONFIRMACION_PLAZO}`];
    return `<span class="av-plazo ${cl}">${tx}</span>`;
  }

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

  function abrirAvanceMunicipio(m){ avMuni = m; window.scrollTo(0, 0); pintar(); }
  function cerrarAvanceMunicipio(){ avMuni = null; pintar(); }

  // Exportar a Excel: las respuestas vigentes de todas las sedes (o del
  // municipio abierto). Los campos son los del oficio más la identificación.
  const ENC_CONF_CSV = ['DANE sede', 'Municipio', 'Institución', 'Sede', 'Nivel de afectación (censo)',
    '¿Intervención terminada o en proceso?', 'Quién interviene', 'Nombre de quién interviene', 'Estado de la obra',
    'Registrado por', 'Fecha de registro', 'Estado del municipio', 'Código de verificación vigente'];
  // Un texto escrito por un usuario que empieza por = + - @ lo ejecutaría Excel como fórmula.
  const textoCSV = t => /^[=+\-@]/.test(String(t || '')) ? "'" + t : (t || '');
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
        fechaCSV(r.fecha_registro), (ESTADO_CONF[m.estado] || [0, ''])[1], m.codigo_actual || ''];
    });
    descargarCSV(`confirmacion-alcaldes_${avMuni ? slug(avMuni) : 'todos'}_${hoyArchivo()}.csv`, ENC_CONF_CSV, filas);
  }
