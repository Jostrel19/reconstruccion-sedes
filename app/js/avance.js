/* app/js/avance.js — Confirmación de alcaldes: avance que ve la Secretaría (D-48).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Solo lectura: Administrador, Verificador y Consulta ven los 26
     municipios, las respuestas de cada uno y descargan los PDF firmados.
     Nadie de la Secretaría responde por un alcalde (D-48). ─── */
  let avMuni = null; // municipio abierto en el detalle, o null para la lista

  function pintarAvance(){
    const $ = id => document.getElementById(id);
    $('av-lista-caja').classList.toggle('oculto', !!avMuni);
    $('av-detalle').classList.toggle('oculto', !avMuni);
    if (!CONF){
      $('av-franja').innerHTML = confError ? '' : esqueletoFranja(6);
      $('av-tbody').innerHTML = confError ? `<tr><td colspan="7" class="vacio-tx">${esc(confError)}</td></tr>` : filasEsqueleto(7, 8);
      $('av-pie').textContent = '';
      return;
    }
    if (avMuni && !CONF.municipios.some(m => m.municipio === avMuni)) avMuni = null;
    if (avMuni){ pintarAvanceMunicipio(); return; }

    const ms = CONF.municipios;
    const cuenta = e => ms.filter(m => m.estado === e).length;
    const nSedes = ms.reduce((a, m) => a + m.n_sedes, 0);
    const resp = ms.reduce((a, m) => a + m.respondidas, 0);
    const con = ms.reduce((a, m) => a + m.con_intervencion, 0);
    $('av-franja').innerHTML = [
      ['ok', cuenta('CARGADA'), `de ${ms.length} municipios con la certificación cargada`],
      ['al', cuenta('GENERADA'), 'Generada, falta cargarla firmada'],
      ['', cuenta('EN_DILIGENCIAMIENTO') + cuenta('POR_GENERAR'), 'Diligenciando'],
      [cuenta('SIN_EMPEZAR') ? 'er' : 'na', cuenta('SIN_EMPEZAR'), 'Sin empezar'],
      [cuenta('DESACTUALIZADA') ? 'er' : 'na', cuenta('DESACTUALIZADA'), 'Certificación desactualizada'],
      ['', `${formatNum(resp, 0)}<span class="u"> / ${formatNum(nSedes, 0)}</span>`, `Sedes respondidas · ${formatNum(con, 0)} con intervención`],
    ].map(([c, v, t]) => `<div class="c ${c}"><b>${v}</b><span>${t}</span></div>`).join('');

    $('av-tbody').innerHTML = ms.map(m => {
      const pct = m.n_sedes ? Math.round(100 * m.respondidas / m.n_sedes) : 0;
      const al = (m.alcaldes || []).filter(a => a.activo);
      const alcalde = al.length ? al.map(a => esc(a.nombre)).join('<br>')
        : `<span class="fila-est er">${(m.alcaldes || []).length ? 'Alcalde inactivo' : 'Sin usuario'}</span>`;
      const ultimo = (m.certificaciones || []).find(c => c.evento === 'CARGADO');
      const cert = m.cargado
        ? `<button class="b sec mini" type="button" data-descargar="${esc(m.cargado.id_certificacion)}">Descargar PDF</button><span class="hace">${esc(hace(m.cargado.fecha))}</span>`
        : (ultimo ? `<button class="b sec mini" type="button" data-descargar="${esc(ultimo.id_certificacion)}">Descargar la anterior</button>` : '<span class="tenue">—</span>');
      return `<tr class="click" data-av-muni="${esc(m.municipio)}" tabindex="0">
        <td><b>${esc(m.municipio)}</b></td><td>${alcalde}</td><td class="n">${m.n_sedes}</td>
        <td><div class="av-barra" role="img" aria-label="${m.respondidas} de ${m.n_sedes} respondidas"><i style="width:${pct}%"></i></div>
          <span class="hace">${m.respondidas} de ${m.n_sedes}</span></td>
        <td class="n">${m.con_intervencion}</td><td>${estadoConfBadge(m)}</td><td class="av-cert">${cert}</td></tr>`;
    }).join('');
    $('av-pie').innerHTML = `Los ${ms.length} municipios de la campaña; sedes oficiales, activas y con matrícula, sin Manizales (${formatNum(nSedes, 0)}). ` +
      `Solo el alcalde de cada municipio responde y carga la certificación; aquí se consulta. Plazo: ${esc(CONFIRMACION_PLAZO)}.`;
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
      ['', m.n_sedes, 'Sedes'], [m.respondidas === m.n_sedes ? 'ok' : 'al', m.respondidas, 'Respondidas'],
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
      return `<tr${r ? '' : ' class="tenue"'}><td class="n">${i + 1}</td>
        <td class="conf-sede"><b>${esc(s.sede)}</b><span class="hace">${esc(s.institucion)}</span></td>
        <td class="mono">${esc(s.dane_sede)}</td><td class="conf-nivel">${nivelHtml(s)}</td>
        <td>${r ? esc(r.tiene_intervencion) : 'Sin responder'}</td><td>${si ? esc(r.quien_interviene) : '—'}</td>
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
