/* app/js/confirmacion.js — Confirmación de sedes por los alcaldes (D-48): pantalla del alcalde
   y lo que comparte con el panel de la Secretaría (avance.js).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* Opciones del oficio de la jefatura, idénticas a backend/Confirmaciones.gs.
     El servidor las vuelve a validar: estas solo arman la pantalla. */
  const CONF_SI = 'Sí', CONF_NO = 'No';
  const CONF_QUIEN = ['Alcaldía', 'IE con recursos de gratuidad', 'Ministerio de Educación (MEN)', 'FFIE', 'UNGRD',
    'Póliza / aseguradora', 'Donante', 'Cofinanciación (varias entidades)', 'Cooperación / sector privado'];
  const CONF_QUIEN_CON_NOMBRE = ['Donante', 'Cofinanciación (varias entidades)', 'Cooperación / sector privado'];
  const CONF_ESTADOS_OBRA = ['Planeación', 'Contratación', 'Ejecución', 'Terminada'];
  const CONF_NOMBRE_MAX = 200;
  const CERT_MAX_BYTES = 10 * 1024 * 1024;

  // Nivel de afectación como lo lista el oficio (el censo lo trae en mayúsculas).
  const NIVEL_OFICIO = { 1: '1. Colapso total o parcial (PRIORITARIO)', 2: '2. Riesgo inminente de colapso (PRIORITARIO)',
    3: '3. Afectaciones estructurales o funcionales parciales', 4: '4. Afectaciones menores', 5: '5. Sin afectación',
    7: '7. Sin revisar' };
  const nivelTexto = s => NIVEL_OFICIO[tipoNum(s)] || s.tipo_censo || 'Sin clasificar en el censo';
  const nivelHtml = s => { const t = tipoNum(s); return (t === 1 || t === 2 ? tipoChipNum(t) + ' ' : '') + esc(nivelTexto(s)); };

  // Estado de un municipio: lo calcula el servidor (_confEstadoMunicipio).
  const ESTADO_CONF = {
    SIN_EMPEZAR: ['e-pend', 'Sin empezar'],
    EN_DILIGENCIAMIENTO: ['e-rad', 'En diligenciamiento'],
    POR_GENERAR: ['e-rad', 'Falta generar la certificación'],
    GENERADA: ['e-ver', 'Falta cargar la certificación firmada'],
    CARGADA: ['e-apr', 'Certificación cargada'],
    DESACTUALIZADA: ['e-err', 'Certificación desactualizada'],
  };
  const estadoConfBadge = m => { const [c, t] = ESTADO_CONF[m && m.estado] || ['e-pend', '—']; return `<span class="est ${c}">${esc(t)}</span>`; };

  let CONF = null;          // respuesta de listarConfirmaciones: {sedes, municipios, alcalde?}
  let confCargadoEn = 0;
  let confError = '';
  let promesaConf = null;
  let confEdit = {};        // dane -> respuesta editada y todavía sin guardar
  let confErrores = {};     // dane -> error que devolvió el servidor al guardar
  let confFiltro = 'todas';

  function cargarConfirmaciones(){
    if (promesaConf) return promesaConf;
    promesaConf = (async () => {
      try {
        const r = await backend('listarConfirmaciones', { token: sesion.token });
        if (r && r.ok && Array.isArray(r.sedes)){ CONF = r; confError = ''; confCargadoEn = Date.now(); }
        else confError = (r && r.error) || 'No se pudo consultar el servidor.';
      } catch (err) {
        confError = err.message || 'No se pudo contactar el servidor.';
      }
    })().finally(() => { promesaConf = null; });
    return promesaConf;
  }

  // Lo que devuelven guardar, generar y cargar trae el municipio completo otra vez.
  function aplicarRespuestaConf(r){
    if (!CONF || !r || !Array.isArray(r.sedes)) return;
    const munis = new Set(r.municipios.map(m => m.municipio));
    CONF.sedes = CONF.sedes.filter(s => !munis.has(s.municipio)).concat(r.sedes);
    CONF.municipios = CONF.municipios.map(m => r.municipios.find(x => x.municipio === m.municipio) || m);
    confCargadoEn = Date.now();
  }

  /* ─── respuestas: la guardada, la editada y las reglas ─── */

  const confVacia = () => ({ tiene_intervencion: '', quien_interviene: '', nombre_quien_interviene: '', estado_obra: '' });
  const confGuardada = s => s.respuesta || null;
  const confActual = s => confEdit[s.dane_sede] || confGuardada(s) || confVacia();
  const pideNombre = quien => CONF_QUIEN_CON_NOMBRE.includes(quien);

  // Misma normalización que el servidor: con «No» no hay quién, nombre ni
  // estado; el nombre solo cuenta con Donante, Cofinanciación o Cooperación.
  function confNormal(r){
    if (r.tiene_intervencion === CONF_NO) return { tiene_intervencion: CONF_NO, quien_interviene: '', nombre_quien_interviene: '', estado_obra: '' };
    return { tiene_intervencion: r.tiene_intervencion, quien_interviene: r.quien_interviene,
      nombre_quien_interviene: pideNombre(r.quien_interviene) ? r.nombre_quien_interviene : '', estado_obra: r.estado_obra };
  }
  const confIgual = (a, b) => !!a && !!b && ['tiene_intervencion', 'quien_interviene', 'nombre_quien_interviene', 'estado_obra']
    .every(k => String(a[k] || '').trim() === String(b[k] || '').trim());

  // Qué le falta a una respuesta para poder guardarse ('' si está completa).
  function confFalta(r){
    if (r.tiene_intervencion !== CONF_SI && r.tiene_intervencion !== CONF_NO) return 'Responda Sí o No';
    if (r.tiene_intervencion === CONF_NO) return '';
    if (!CONF_QUIEN.includes(r.quien_interviene)) return 'Elija quién interviene';
    if (pideNombre(r.quien_interviene) && !String(r.nombre_quien_interviene || '').trim()) return 'Escriba el nombre de quién interviene';
    if (!CONF_ESTADOS_OBRA.includes(r.estado_obra)) return 'Elija el estado de la obra';
    return '';
  }

  const confSucia = s => !!confEdit[s.dane_sede] && !confIgual(confEdit[s.dane_sede], confGuardada(s));
  const confSedesMias = () => (CONF ? CONF.sedes : []);
  const confPendientesDeGuardar = () => confSedesMias().filter(confSucia);
  const confHayCambios = () => rol === 'alcalde' && confPendientesDeGuardar().length > 0;

  // Estado de una fila, en forma y en palabras.
  function confEstadoFila(s){
    if (confErrores[s.dane_sede] && confSucia(s)) return ['er', confErrores[s.dane_sede]];
    if (confSucia(s)){
      const falta = confFalta(confActual(s));
      return falta ? ['er', falta] : ['al', 'Sin guardar'];
    }
    return confGuardada(s) ? ['ok', 'Guardada'] : ['na', 'Sin responder'];
  }

  const FILTROS_CONF = {
    todas: ['Todas', () => true],
    sin: ['Sin responder', s => !confGuardada(s)],
    si: ['Con intervención', s => confActual(s).tiene_intervencion === CONF_SI],
    no: ['Sin intervención', s => confActual(s).tiene_intervencion === CONF_NO],
    cambios: ['Sin guardar', s => confSucia(s)],
  };

  /* ─── pantalla del alcalde ─── */

  function pintarConfirmacion(){
    const $ = id => document.getElementById(id);
    if (!CONF){
      $('conf-franja').innerHTML = esqueletoFranja(5);
      $('conf-pasos').innerHTML = confError ? `<p class="vacio-tx">${esc(confError)}</p>`
        : '<p class="hace">Cargando las sedes de su municipio. Si el servidor está lento puede tardar hasta un minuto; no cierre la página.</p>' + esqueletoLineas(3);
      $('conf-tbody').innerHTML = confError ? '' : filasEsqueleto(7, 6);
      $('conf-filtros').innerHTML = '';
      pintarBarraConf();
      return;
    }
    const m = CONF.municipios[0];
    if (!m){
      $('conf-franja').innerHTML = '';
      $('conf-pasos').innerHTML = `<p class="vacio-tx">No hay sedes registradas para su municipio (${esc((CONF.alcalde || {}).municipio || '')}). Comuníquese con la Secretaría de Educación.</p>`;
      $('conf-tbody').innerHTML = '';
      return;
    }
    const sedes = confSedesMias();
    const faltan = m.n_sedes - m.respondidas;
    $('conf-franja').innerHTML = [
      ['', m.n_sedes, 'Sedes oficiales del municipio'],
      [faltan ? '' : 'ok', m.respondidas, 'Respondidas'],
      [faltan ? 'al' : 'na', faltan, 'Por responder'],
      ['', m.con_intervencion, 'Con intervención'],
      ['', m.sin_intervencion, 'Sin intervención'],
    ].map(([c, n, t]) => `<div class="c ${c}"><b>${formatNum(n, 0)}</b><span>${t}</span></div>`).join('');
    const [claseEst, textoEst] = ESTADO_CONF[m.estado] || ['e-pend', '—'];
    $('conf-estado').className = 'est ' + claseEst;
    $('conf-estado').textContent = textoEst;
    pintarPasosConf(m);

    if (!FILTROS_CONF[confFiltro]) confFiltro = 'todas';
    $('conf-filtros').innerHTML = Object.entries(FILTROS_CONF).map(([k, [txt, f]]) =>
      `<button type="button" class="chip" data-filtro="${k}" aria-pressed="${k === confFiltro}">${txt} <b>${sedes.filter(f).length}</b></button>`).join('');
    pintarTablaConf();
    pintarBarraConf();
  }

  // Los tres pasos del proceso: el orden es información (el que sigue va resaltado).
  function pintarPasosConf(m){
    const cambios = confPendientesDeGuardar().length;
    const todas = m.respondidas === m.n_sedes;
    const fecha = f => f ? new Date(f).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '';
    const paso = (n, estado, titulo, cuerpo) =>
      `<li class="cp ${estado}"><span class="cp-n" aria-hidden="true">${estado === 'hecho' ? '✓' : n}</span>
        <div class="cp-tx"><h3>${titulo}<span class="sr"> — ${estado === 'hecho' ? 'hecho' : (estado === 'act' ? 'paso actual' : 'pendiente')}</span></h3>${cuerpo}</div></li>`;

    const p1 = todas && !cambios
      ? paso(1, 'hecho', 'Responder todas las sedes', `<p>Las ${m.n_sedes} sedes tienen respuesta. Puede corregir cualquiera antes de generar la certificación.</p>`)
      : paso(1, 'act', 'Responder todas las sedes', `<p>${todas ? 'Tiene cambios sin guardar.' : `Faltan <b>${m.n_sedes - m.respondidas}</b> de ${m.n_sedes}.`} Responda en la tabla de abajo y pulse <b>Guardar cambios</b>; puede hacerlo por partes.</p>`);

    // La certificación se baja en Word (D-50). Los id conf-btn-generar y
    // conf-btn-imprimir se conservan aunque los dos bajen el Word: un arranque.js
    // anterior todavía en caché los despacha igual.
    const generada = m.estado === 'GENERADA' || m.estado === 'CARGADA';
    let c2;
    if (generada){
      c2 = `<p>Generada${m.generado ? ' el ' + esc(fecha(m.generado.fecha)) : ''} · código de verificación <b class="mono">${esc(m.codigo_actual)}</b>.</p>
        <button class="b sec mini" type="button" id="conf-btn-imprimir">Descargar el Word de nuevo</button>`;
    } else {
      const bloqueo = !todas ? 'Se habilita cuando todas las sedes tengan respuesta.' : (cambios ? 'Guarde los cambios antes de generarla.' : '');
      c2 = `<p>La aplicación arma la certificación en Word con sus respuestas. Copie su contenido en el formato oficial de su alcaldía <b>sin modificarlo</b>, con la tabla completa y el código de verificación.</p>
        <button class="b mini" type="button" id="conf-btn-generar" ${bloqueo ? 'disabled' : ''}>Descargar la certificación en Word</button>
        ${bloqueo ? `<span class="hace">${bloqueo}</span>` : ''}`;
    }
    const p2 = paso(2, generada ? 'hecho' : (todas && !cambios ? 'act' : ''), 'Generar la certificación en Word', c2);

    let c3, e3 = '';
    const elegir = `<input type="file" id="conf-pdf" accept="application/pdf,.pdf" class="oculto">`;
    if (m.estado === 'CARGADA'){
      e3 = 'hecho';
      c3 = `<p><b>Reporte finalizado.</b> Cargada el ${esc(fecha(m.cargado.fecha))}: ${esc(m.cargado.archivo_nombre)} (${tamanoTexto(m.cargado.tamano_bytes)}).</p>
        <div class="acciones-v"><button class="b sec mini" type="button" data-descargar="${esc(m.cargado.id_certificacion)}">Ver el PDF cargado</button>
        <button class="b sec mini" type="button" id="conf-btn-elegir">Cargar otro escaneo</button></div>${elegir}
        <p class="hace">Si cambia una respuesta, esta certificación deja de valer y debe generar y cargar una nueva.</p>`;
    } else if (m.estado === 'GENERADA'){
      e3 = 'act';
      c3 = `<p>Fírmela por parte del Alcalde Municipal, escanéela como <b>un solo archivo PDF</b> con todas sus páginas (máximo 10 MB) y cárguela. Con este cargue se da por finalizado el reporte.</p>
        <div class="soltar conf-soltar" id="conf-soltar"><button class="b mini" type="button" id="conf-btn-elegir">Elegir el PDF firmado</button>
        <span class="hace">o arrástrelo aquí. Si pesa más de 10 MB, escanéelo en blanco y negro o en escala de grises, a 150 o 200 ppp.</span></div>${elegir}`;
    } else {
      c3 = '<p>Se habilita cuando genere la certificación.</p>';
    }
    const p3 = paso(3, e3, 'Firmar, escanear y cargar la certificación', c3);

    const aviso = m.cargada_desactualizada
      ? `<div class="aviso-conf"><b>La certificación que cargó ya no corresponde a sus respuestas.</b> Cambió una respuesta después de cargarla: ${m.estado === 'GENERADA' ? 'cargue la nueva, firmada.' : 'genere la certificación de nuevo, fírmela y cárguela.'}</div>`
      : '';
    document.getElementById('conf-pasos').innerHTML = aviso + `<ol class="conf-pasos">${p1}${p2}${p3}</ol>` + historialConfHtml(m, true);
  }

  // Certificaciones cargadas antes (historial). En el panel de la Secretaría se
  // ven todas; al alcalde, solo si hay más de una.
  function historialConfHtml(m, soloSiHayVarias){
    const cargadas = (m.certificaciones || []).filter(c => c.evento === 'CARGADO');
    if (!cargadas.length || (soloSiHayVarias && cargadas.length < 2)) return '';
    const vigente = m.cargado && m.cargado.id_certificacion;
    return `<details class="conf-hist"><summary>Certificaciones cargadas (${cargadas.length})</summary><div class="scroll"><table>
      <thead><tr><th>Cargada</th><th>Por</th><th>Código</th><th class="n">Tamaño</th><th>Vigencia</th><th><span class="sr">Descargar</span></th></tr></thead>
      <tbody>${cargadas.map(c => `<tr><td>${esc(new Date(c.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
        <td>${esc(c.correo)}</td><td class="mono">${esc(c.codigo_verificacion)}</td><td class="n">${tamanoTexto(c.tamano_bytes)}</td>
        <td>${c.id_certificacion === vigente ? '<span class="est e-apr">Vigente</span>' : '<span class="est e-pend">Reemplazada</span>'}</td>
        <td><button class="b sec mini" type="button" data-descargar="${esc(c.id_certificacion)}">Descargar</button></td></tr>`).join('')}</tbody>
      </table></div></details>`;
  }

  const tamanoTexto = b => { b = Number(b) || 0; return b >= 1048576 ? `${formatNum(b / 1048576, 1)} MB` : `${formatNum(Math.max(1, Math.round(b / 1024)), 0)} KB`; };

  function pintarTablaConf(){
    const sedes = confSedesMias();
    const f = FILTROS_CONF[confFiltro][1];
    const filas = sedes.map((s, i) => [s, i + 1]).filter(([s]) => f(s));
    document.getElementById('conf-tbody').innerHTML = filas.length
      ? filas.map(([s, n]) => filaConfHtml(s, n)).join('')
      : `<tr><td colspan="7" class="vacio-tx">Ninguna sede en «${esc(FILTROS_CONF[confFiltro][0])}».</td></tr>`;
    document.getElementById('conf-eyebrow').textContent = confFiltro === 'todas' ? `${sedes.length} sedes` : `${filas.length} de ${sedes.length} sedes`;
  }

  function filaConfHtml(s, n){
    const r = confActual(s);
    const d = esc(s.dane_sede);
    const nom = esc(s.sede);
    const conSi = r.tiene_intervencion === CONF_SI;
    const opciones = (lista, valor) => `<option value="">Elija…</option>` +
      lista.map(o => `<option${o === valor ? ' selected' : ''}>${esc(o)}</option>`).join('');
    const [cls, txt] = confEstadoFila(s);
    return `<tr data-conf="${d}" class="${confSucia(s) ? 'sucia' : ''}">
      <td class="n">${n}</td>
      <td class="conf-sede"><b>${nom}</b><span class="hace">${esc(s.institucion)} · DANE ${d}</span></td>
      <td class="conf-nivel">${nivelHtml(s)}</td>
      <td><div class="sino" role="radiogroup" aria-label="¿${nom} tiene una intervención terminada o en proceso?">
        <label><input type="radio" name="ti-${d}" value="${CONF_SI}" data-campo="tiene_intervencion"${r.tiene_intervencion === CONF_SI ? ' checked' : ''}><span>Sí</span></label>
        <label><input type="radio" name="ti-${d}" value="${CONF_NO}" data-campo="tiene_intervencion"${r.tiene_intervencion === CONF_NO ? ' checked' : ''}><span>No</span></label></div></td>
      <td class="conf-quien">${conSi ? `<select data-campo="quien_interviene" aria-label="Quién interviene en ${nom}">${opciones(CONF_QUIEN, r.quien_interviene)}</select>` : '<span class="tenue">—</span>'}${conSi && pideNombre(r.quien_interviene)
        ? `<input type="text" data-campo="nombre_quien_interviene" maxlength="${CONF_NOMBRE_MAX}" value="${esc(r.nombre_quien_interviene)}" placeholder="Nombre (obligatorio)" aria-label="Nombre de quién interviene en ${nom}">`
        : ''}</td>
      <td>${conSi ? `<select data-campo="estado_obra" aria-label="Estado de la obra en ${nom}">${opciones(CONF_ESTADOS_OBRA, r.estado_obra)}</select>` : '<span class="tenue">—</span>'}</td>
      <td><span class="fila-est ${cls}">${esc(txt)}</span></td>
    </tr>`;
  }

  // Un cambio en una fila: se guarda en confEdit y se repinta solo esa fila
  // (repintar toda la tabla haría perder el foco a quien está escribiendo).
  function cambioConf(el, repintarFila){
    const tr = el.closest('tr[data-conf]');
    if (!tr || !CONF) return;
    const dane = tr.dataset.conf;
    const s = CONF.sedes.find(x => x.dane_sede === dane);
    if (!s) return;
    const r = Object.assign({}, confActual(s));
    r[el.dataset.campo] = el.value;
    const nueva = confNormal(r);
    if (confIgual(nueva, confGuardada(s))) delete confEdit[dane]; else confEdit[dane] = nueva;
    delete confErrores[dane];
    if (repintarFila){
      const campo = el.dataset.campo, valor = el.value;
      const n = tr.querySelector('td').textContent;
      tr.outerHTML = filaConfHtml(s, n);
      const nuevo = document.querySelector(`tr[data-conf="${dane}"] [data-campo="${campo}"]${campo === 'tiene_intervencion' ? `[value="${valor}"]` : ''}`);
      if (nuevo) nuevo.focus();
    } else {
      const [cls, txt] = confEstadoFila(s);
      const est = tr.querySelector('.fila-est');
      est.className = 'fila-est ' + cls; est.textContent = txt;
      tr.classList.toggle('sucia', confSucia(s));
    }
    pintarBarraConf();
  }

  function pintarBarraConf(){
    const barra = document.getElementById('conf-barra');
    const pend = confPendientesDeGuardar();
    const listas = pend.filter(s => !confFalta(confActual(s)));
    const incompletas = pend.length - listas.length;
    barra.classList.toggle('oculto', !pend.length);
    if (!pend.length) return;
    document.getElementById('conf-barra-tx').innerHTML =
      `<b>${pend.length} sede${pend.length === 1 ? '' : 's'} con cambios sin guardar</b>` +
      (incompletas ? ` · ${incompletas} incompleta${incompletas === 1 ? '' : 's'}: complétela${incompletas === 1 ? '' : 's'} para poder guardarla${incompletas === 1 ? '' : 's'}` : '');
    document.getElementById('conf-btn-guardar').disabled = !listas.length;
    document.getElementById('conf-btn-guardar').textContent = listas.length ? `Guardar ${listas.length} cambio${listas.length === 1 ? '' : 's'}` : 'Guardar cambios';
  }

  async function guardarConfirmacionesUI(){
    const listas = confPendientesDeGuardar().filter(s => !confFalta(confActual(s)));
    if (!listas.length) return;
    const m = CONF.municipios[0];
    if (m && (m.estado === 'CARGADA' || m.estado === 'GENERADA')){
      const ok = await confirmar({
        titulo: 'Cambiar respuestas ya certificadas',
        html: `<p>Ya ${m.estado === 'CARGADA' ? 'cargó' : 'generó'} la certificación con las respuestas actuales. Si guarda estos cambios, esa certificación deja de valer y deberá <b>generar, firmar y cargar una nueva</b>.</p>`,
        aceptar: 'Guardar de todos modos' });
      if (!ok) return;
    }
    const soltar = ocupar(document.getElementById('conf-btn-guardar'), 'Guardando…');
    try {
      const r = await backend('guardarConfirmaciones', { token: sesion.token,
        respuestas: listas.map(s => Object.assign({ dane_sede: s.dane_sede }, confActual(s))) });
      if (!r.ok){ avisar(r.error || 'No se pudieron guardar las respuestas.', 'error'); return; }
      aplicarRespuestaConf(r);
      (r.resultados || []).forEach(x => {
        if (x.ok) { delete confEdit[x.dane_sede]; delete confErrores[x.dane_sede]; }
        else confErrores[x.dane_sede] = x.error;
      });
      const n = r.guardadas + r.sin_cambios;
      if (r.con_error) avisar(`Se guardaron ${n} y ${r.con_error} no: revise las filas marcadas en rojo.`, 'error');
      else avisar(`Se guardaron ${n} respuesta${n === 1 ? '' : 's'}.`, 'ok');
    } catch (err) {
      avisar(err.message || 'No se pudo contactar el servidor. Sus cambios siguen en pantalla: intente de nuevo.', 'error');
    } finally {
      soltar();
      pintarConfirmacion();
    }
  }

  async function deshacerConfUI(){
    const n = confPendientesDeGuardar().length;
    const ok = await confirmar({ titulo: 'Deshacer los cambios',
      html: `<p>Se descartan los cambios de ${n} sede${n === 1 ? '' : 's'} y vuelven las respuestas guardadas.</p>`, aceptar: 'Deshacer', peligro: true });
    if (!ok) return;
    confEdit = {}; confErrores = {};
    pintarConfirmacion();
  }

  // Baja el Word (D-50). Si el certificado.js en caché es anterior y no trae el
  // Word, abre la ventana de impresión como antes.
  async function generarCertificadoUI(btn){
    const soltar = ocupar(btn, 'Generando…');
    try {
      const r = await backend('generarCertificado', { token: sesion.token });
      if (!r.ok){ avisar(r.error || 'No se pudo generar la certificación.', 'error'); return; }
      aplicarRespuestaConf(r);
      if (typeof descargarCertificadoWord === 'function'){
        descargarCertificadoWord(r.certificado, r.sedes, r.municipios[0]);
        avisar('Certificación descargada en Word. Pase su contenido al formato de su alcaldía sin modificarlo.', 'ok');
      } else {
        await imprimirCertificado(r.certificado, r.sedes, r.municipios[0]);
        avisar('Certificación generada. En la ventana de impresión, imprímala o guárdela en PDF para firmarla.', 'ok');
      }
    } catch (err) {
      avisar(err.message || 'No se pudo contactar el servidor.', 'error');
    } finally {
      soltar();
      pintarConfirmacion();
    }
  }

  // Revisión en el navegador antes de enviar: evita subir 13 MB para que el
  // servidor los rechace. El servidor revisa todo otra vez.
  async function cargarCertificadoUI(archivo){
    if (!archivo) return;
    const m = CONF && CONF.municipios[0];
    if (!/\.pdf$/i.test(archivo.name) && archivo.type !== 'application/pdf'){
      avisar('El archivo debe ser un PDF. Escanee la certificación firmada como PDF.', 'error'); return;
    }
    if (archivo.size > CERT_MAX_BYTES){
      avisar(`El archivo supera el máximo de 10 MB (pesa ${tamanoTexto(archivo.size)}). Escanéelo en blanco y negro o en escala de grises, a 150 o 200 ppp.`, 'error'); return;
    }
    const cabecera = new TextDecoder('latin1').decode(await archivo.slice(0, 5).arrayBuffer());
    if (cabecera !== '%PDF-'){ avisar('El archivo no es un PDF válido. Escanee la certificación firmada como PDF.', 'error'); return; }
    const ok = await confirmar({ titulo: 'Cargar la certificación firmada',
      html: `<p>Va a cargar <b>${esc(archivo.name)}</b> (${tamanoTexto(archivo.size)}) como la certificación firmada de ${esc(m ? m.municipio : '')}.</p>
        <p class="nota-dlg">Revise que sea el documento completo y firmado, y que muestre el código de verificación <b class="mono">${esc(m ? m.codigo_actual : '')}</b>. Con este cargue se da por finalizado el reporte.</p>`,
      aceptar: 'Cargar' });
    if (!ok) return;
    const btn = document.getElementById('conf-btn-elegir');
    const soltar = ocupar(btn, 'Cargando… puede tardar unos minutos');
    try {
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).replace(/^data:[^,]*,/, ''));
        fr.onerror = () => rej(new Error('No se pudo leer el archivo.'));
        fr.readAsDataURL(archivo);
      });
      const r = await backend('subirCertificado', { token: sesion.token, contenido_base64: b64, nombre: archivo.name });
      if (!r.ok){ avisar(r.error || 'No se pudo cargar la certificación.', 'error'); return; }
      aplicarRespuestaConf(r);
      avisar(r.ya_estaba ? 'Ese mismo archivo ya estaba cargado: no se duplicó.' : 'Certificación cargada. El reporte de su municipio quedó finalizado.', 'ok');
    } catch (err) {
      avisar(err.message || 'No se pudo contactar el servidor.', 'error');
    } finally {
      soltar();
      pintarConfirmacion();
    }
  }

  // Descarga un PDF cargado (alcalde: el suyo; Secretaría: cualquiera).
  async function descargarCertificadoUI(id, btn){
    const soltar = ocupar(btn, 'Descargando…');
    try {
      const r = await backend('descargarCertificado', { token: sesion.token, id_certificacion: id });
      if (!r.ok){ avisar(r.error || 'No se pudo descargar la certificación.', 'error'); return; }
      const bin = atob(r.contenido_base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = r.nombre || 'certificacion.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      avisar(err.message || 'No se pudo contactar el servidor.', 'error');
    } finally {
      soltar();
    }
  }

  // Descargar de nuevo la certificación ya generada: se pide al servidor, que
  // devuelve la misma (misma fecha y código) sin crear otra. El nombre viene de
  // cuando este botón imprimía; arranque.js lo llama así.
  async function reimprimirCertificadoUI(btn){ await generarCertificadoUI(btn); }

  function olvidarConfirmaciones(){
    CONF = null; confCargadoEn = 0; confError = ''; confEdit = {}; confErrores = {}; confFiltro = 'todas';
  }
