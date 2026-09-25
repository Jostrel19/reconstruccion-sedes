/* app/js/inicio.js — Inicio: lo que requiere atención de cada rol, cómo vamos y los últimos movimientos.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Inicio (D-46) ───
     Primera pantalla de los cuatro roles. Responde dos preguntas: qué me toca
     hacer (tarjetas con cifra y acceso directo, distintas por rol) y cómo
     vamos (la misma franja del Tablero, siempre sobre todo el alcance). Todo
     sale de SEDES, ACTIVIDAD y HALLAZGOS: nada está escrito en el HTML. */

  // Hallazgos para contar en Inicio (Administrador y Verificador), como mucho
  // una vez por minuto. La pantalla Hallazgos también actualiza HALLAZGOS.
  async function cargarHallazgosInicio(){
    if (!sesion || !(rol === 'admin' || rol === 'verif')) return;
    if (Date.now() - hallazgosLeidosEn < 60 * 1000) return;
    hallazgosLeidosEn = Date.now();
    try {
      const r = await backend('listarHallazgos', { token: sesion.token });
      if (r && r.ok){
        HALLAZGOS = r.hallazgos || [];
        actualizarBadgeHallazgosRiel(HALLAZGOS);
        if (vista === 'inicio') pintarInicioReal();
      } else hallazgosLeidosEn = 0;
    } catch (err) { hallazgosLeidosEn = 0; }
  }

  const esperandoConcepto = s => estadoDe(s) === 'RADICADO' || estadoDe(s) === 'EN_VERIFICACION';

  // Días de la radicación más antigua sin concepto, o null si no hay ninguna.
  function esperaMasAntigua(sedes){
    const dias = sedes.filter(esperandoConcepto).map(s => diasDesde(s.presupuesto.fecha_creacion)).filter(d => d != null);
    return dias.length ? Math.max(...dias) : null;
  }
  const tonoEspera = d => d == null ? '' : (d > ESPERA_ALERTA_DIAS ? 'er' : (d > ESPERA_OK_DIAS ? 'al' : ''));
  const diasTxt = d => d === 0 ? 'hoy' : (d === 1 ? '1 día' : `${d} días`);

  /* Tarjetas por rol: { n, titulo, detalle, tono, accion, ir }. n = null
     mientras el dato todavía no llega (se pinta como bloque de carga). */
  function tareasInicio(){
    const S = SEDES;
    const esperan = S.filter(esperandoConcepto);
    const ajuste = S.filter(s => estadoDe(s) === 'REQUIERE_AJUSTE');
    const d = esperaMasAntigua(S);
    const tEsperan = {
      n: esperan.length, titulo: 'Esperando concepto',
      detalle: esperan.length ? `La más antigua lleva ${diasTxt(d)} sin concepto.` : 'No hay presupuestos radicados esperando concepto.',
      tono: tonoEspera(d), accion: 'Abrir Verificación', ir: irVerificacion };
    const abiertos = HALLAZGOS ? HALLAZGOS.filter(h => h.estado === 'ABIERTO') : null;
    const tHallazgos = {
      n: abiertos ? abiertos.length : null, titulo: 'Hallazgos abiertos',
      detalle: !abiertos ? 'Consultando…' : (abiertos.length
        ? (() => { const e = abiertos.filter(h => h.severidad === 'ERROR').length, i = abiertos.length - e;
            return `${e} ${e === 1 ? 'bloquea' : 'bloquean'} un cruce · ${i} informativo${i === 1 ? '' : 's'}.`; })()
        : 'No hay inconsistencias por revisar.'),
      tono: abiertos && abiertos.some(h => h.severidad === 'ERROR') ? 'er' : '',
      accion: 'Ver hallazgos', ir: () => { vista = 'hallazgos'; pintar(); } };
    const tAjuste = {
      n: ajuste.length, titulo: 'Devueltas para ajuste',
      detalle: ajuste.length ? 'Esperan a que el municipio corrija y vuelva a radicar.' : 'Ninguna sede está devuelta.',
      tono: '', accion: 'Ver en Verificación', ir: irVerificacion };

    if (rol === 'admin'){
      const act = lotesActivos();
      const enLotes = S.filter(s => s.lote && s.lote.activo).length;
      return [tEsperan, tHallazgos, tAjuste, {
        n: act.length, titulo: act.length === 1 ? 'Lote activo' : 'Lotes activos',
        detalle: act.length ? `${enLotes} sede${enLotes === 1 ? '' : 's'} organizadas en lotes.`
          : 'Todavía no hay lotes. Puede organizar el seguimiento por fases, por ejemplo con las sedes tipo 1 y 2 del censo.',
        tono: act.length ? '' : 'al', accion: act.length ? 'Ver lotes' : 'Crear un lote', ir: irLotes }];
    }
    if (rol === 'verif'){
      return [tEsperan, tHallazgos, tAjuste, {
        n: null, sinCifra: true, titulo: 'Cargar presupuestos en Excel',
        detalle: 'Suba el resultado del lector de una alcaldía y confirme qué se vuelca.',
        tono: '', accion: 'Ir a Cargas', ir: () => { vista = 'cargas'; pintar(); } }];
    }
    if (rol === 'resp'){
      const borr = S.filter(s => estadoDe(s) === 'BORRADOR');
      const falta = S.filter(s => conDano(s) && !s.presupuesto);
      return [
        { n: ajuste.length, titulo: 'Devueltas para ajuste', tono: ajuste.length ? 'er' : '',
          detalle: ajuste.length ? 'El arquitecto pidió ajustes: lea sus observaciones en la ficha y vuelva a radicar.' : 'Ninguna de sus sedes está devuelta.' },
        { n: borr.length, titulo: 'Borradores sin radicar', tono: borr.length ? 'al' : '',
          detalle: borr.length ? 'Guardados pero no radicados: la Secretaría todavía no los recibe.' : 'No tiene borradores pendientes.' },
        { n: falta.length, titulo: 'Con daño y sin presupuesto', tono: '',
          detalle: 'Sedes con daño reportado en el censo (tipos 1 a 4) que todavía no tienen presupuesto.' },
        { n: esperan.length, titulo: 'En verificación', tono: '',
          detalle: esperan.length ? 'Radicadas: el arquitecto las está revisando. No requieren nada de su parte.' : 'No tiene presupuestos en revisión.' },
      ];
    }
    return []; // Consulta: no tiene tareas, solo ve cómo vamos.
  }

  function tarjetaHtml(t, i){
    const cifra = t.sinCifra ? '' : (t.n == null ? '<b class="n esq esq-num"></b>' : `<b class="n">${t.n}</b>`);
    const boton = t.accion ? `<button type="button" class="b sec mini" data-tarea="${i}">${esc(t.accion)}</button>` : '';
    return `<div class="tarea${t.tono ? ' ' + t.tono : ''}${t.sinCifra ? ' sin-cifra' : ''}">${cifra}` +
      `<div class="tx"><h3>${esc(t.titulo)}</h3><p>${esc(t.detalle)}</p></div>${boton}</div>`;
  }

  /* Responsable de sede: la lista concreta de sus sedes con algo pendiente,
     en orden de urgencia: devueltas, borradores, y las que tienen daño y no
     tienen presupuesto, del daño más grave al más leve. */
  const MAX_PENDIENTES = 12;
  function pendientesResponsable(){
    const peso = s => estadoDe(s) === 'REQUIERE_AJUSTE' ? 0 : (estadoDe(s) === 'BORRADOR' ? 1 : 2);
    return SEDES.filter(s => ['REQUIERE_AJUSTE', 'BORRADOR'].includes(estadoDe(s)) || (conDano(s) && !s.presupuesto))
      .sort((a, b) => peso(a) - peso(b) || (tipoNum(a) || 9) - (tipoNum(b) || 9));
  }
  function queSigue(s){
    const e = estadoDe(s);
    if (e === 'REQUIERE_AJUSTE') return ['Corregir y volver a radicar', 'Corregir'];
    if (e === 'BORRADOR') return ['Terminar y radicar', 'Continuar'];
    return ['Registrar el presupuesto', 'Registrar'];
  }
  function irRegistrarSede(dane){
    daneActual = String(dane);
    const s = SEDES && SEDES.find(x => String(x.dane_sede) === daneActual);
    if (s) muniActual = s.municipio;
    irRegistrar();
  }

  // Movimientos: para roles internos, la actividad real que manda el backend
  // (con quién la hizo); para Responsable de sede, que no la recibe porque
  // trae correos de otras personas, lo último de sus propias sedes.
  function eventosInicio(){
    if (ROLES[rol].interno) return ACTIVIDAD.slice(0, 8);
    return SEDES.filter(s => s.presupuesto).map(s => {
      const p = s.presupuesto, conConcepto = p.fecha_concepto && p.concepto_resultado;
      return conConcepto
        ? { tipo: 'CONCEPTO', resultado: p.concepto_resultado, version: p.version, dane_sede: s.dane_sede, fecha: p.fecha_concepto }
        : { tipo: p.estado === 'BORRADOR' ? 'BORRADOR' : (p.origen === 'CARGA' ? 'CARGA' : 'RADICADO'),
            version: p.version, total_presupuesto: p.total_presupuesto, dane_sede: s.dane_sede, fecha: p.fecha_creacion };
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8);
  }

  // Bitácora de movimientos (antes en el Tablero, ahora en Inicio).
  function pintarBitacora(cont, eventos){
    const porDane = new Map(SEDES.map(s => [String(s.dane_sede), s]));
    const COLOR = { RADICADO: 'var(--verde)', CARGA: 'var(--oro)', BORRADOR: 'var(--borde-f)', CONCEPTO: 'var(--ok)' };
    cont.innerHTML = eventos.length ? eventos.map(ev => {
      const s = porDane.get(String(ev.dane_sede));
      const nombre = s ? nombreSedeCorto(s) : ev.dane_sede;
      let que;
      if (ev.tipo === 'CONCEPTO') {
        que = `concepto: ${esc(RESULTADO_TXT[ev.resultado] || ev.resultado)} (v${esc(ev.version)})`;
      } else {
        const verbo = { RADICADO: 'radicado', CARGA: 'cargado desde Excel', BORRADOR: 'borrador guardado' }[ev.tipo] || ev.tipo;
        que = `v${esc(ev.version)} ${verbo} · ${esc(cop(ev.total_presupuesto))}`;
      }
      const color = ev.tipo === 'CONCEPTO' && ev.resultado !== 'CORRESPONDE' ? 'var(--err)' : (COLOR[ev.tipo] || 'var(--gris)');
      const quien = [s ? s.municipio : '', ev.por || ''].filter(Boolean).join(' · ');
      return `<div class="fi click" data-dane="${esc(ev.dane_sede)}" tabindex="0" role="link"><span class="pto" style="background:${color}"></span>` +
        `<span class="tx"><b>${esc(nombre)}</b> · ${que}<span>${esc(quien)}</span></span>` +
        `<span class="hace">${esc(hace(ev.fecha))}</span></div>`;
    }).join('') : '<p class="vacio-tx">Todavía no hay movimientos registrados.</p>';
    cont.querySelectorAll('[data-dane]').forEach(el => {
      el.addEventListener('click', () => irFicha(el.dataset.dane));
      el.addEventListener('keydown', e => { if (e.key === 'Enter') irFicha(el.dataset.dane); });
    });
  }

  function pintarInicioReal(){
    const $ = id => document.getElementById(id);
    const R = ROLES[rol];
    const esResp = rol === 'resp';
    $('ini-pend-caja').classList.toggle('oculto', !esResp);
    $('ini-como').classList.toggle('oculto', !esResp);
    $('ini-tablero').classList.toggle('oculto', !R.ve.includes('tablero'));
    $('ini-tareas-caja').classList.toggle('oculto', rol === 'consulta');
    if (!SEDES){
      $('ini-tareas').innerHTML = esqueletoLineas(3);
      $('ini-franja').innerHTML = esqueletoFranja(6);
      $('ini-franja-pie').textContent = '';
      $('ini-bitacora').innerHTML = esqueletoLineas(4);
      if (esResp) $('ini-pend-tbody').innerHTML = filasEsqueleto(6, 3);
      return;
    }

    // Qué requiere atención.
    const tareas = tareasInicio();
    $('ini-tareas').innerHTML = tareas.map(tarjetaHtml).join('');
    $('ini-tareas').querySelectorAll('[data-tarea]').forEach(b =>
      b.addEventListener('click', () => { window.scrollTo(0, 0); tareas[Number(b.dataset.tarea)].ir(); }));

    // Responsable de sede: sus sedes con algo pendiente.
    if (esResp){
      const pend = pendientesResponsable();
      const tbody = $('ini-pend-tbody');
      tbody.innerHTML = pend.length ? pend.slice(0, MAX_PENDIENTES).map(s => {
        const [txt, boton] = queSigue(s);
        return `<tr class="click" data-dane="${esc(s.dane_sede)}" tabindex="0"><td>${esc(nombreSedeCorto(s))}</td><td>${esc(s.municipio)}</td>` +
          `<td>${tipoChip(s)}</td><td>${estadoBadge(s)}</td><td>${esc(txt)}</td>` +
          `<td><button type="button" class="b mini" data-registrar="${esc(s.dane_sede)}">${boton}</button></td></tr>`;
      }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--tx-sec);padding:1rem">No tiene sedes pendientes. Todo lo que tenía daño reportado ya tiene presupuesto radicado.</td></tr>';
      tbody.querySelectorAll('tr[data-dane]').forEach(tr => {
        tr.addEventListener('click', e => { if (!e.target.closest('[data-registrar]')) irFicha(tr.dataset.dane); });
        tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) irFicha(tr.dataset.dane); });
      });
      tbody.querySelectorAll('[data-registrar]').forEach(b => b.addEventListener('click', () => irRegistrarSede(b.dataset.registrar)));
      $('ini-pend-eyebrow').textContent = pend.length ? `${pend.length} sede${pend.length === 1 ? '' : 's'}` : '';
      $('ini-pend-pie').textContent = pend.length > MAX_PENDIENTES
        ? `Se muestran las ${MAX_PENDIENTES} más urgentes de ${pend.length}. Las demás están en «Mis sedes», con el filtro «Con daño y sin presupuesto» de cada municipio.`
        : 'Primero las devueltas, luego los borradores y después las sedes con daño sin presupuesto, de la más grave a la más leve.';
    }

    // Cómo vamos: siempre sobre todo el alcance, sin importar el selector del Tablero.
    $('ini-franja').innerHTML = franjaHtml(SEDES, R.interno ? 'Sedes' : 'Sedes de su alcance');
    animarCifras($('ini-franja'));
    $('ini-franja-pie').textContent = R.interno
      ? 'Todas las sedes oficiales, activas y con matrícula (sin Manizales). «Con daño reportado» son los tipos 1 a 4 del censo.'
      : `Las ${SEDES.length} sedes de su alcance. «Con daño reportado» son los tipos 1 a 4 del censo.`;

    $('ini-bitacora-tit').textContent = R.interno ? 'Últimos movimientos' : 'Lo último de sus sedes';
    pintarBitacora($('ini-bitacora'), eventosInicio());
    cargarHallazgosInicio();
  }
