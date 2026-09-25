/* app/js/ficha.js — Ficha de sede.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Ficha de sede ───
     pintarFichaReal() pinta de inmediato lo que ya está en memoria (identidad
     y censo desde SEDES) y deja todo lo del presupuesto en estado vacío;
     cargarPresupuestoDeFicha() y cargarFotosDeFicha() lo llenan cuando llega
     la respuesta del backend. Nada de esta pantalla viene escrito en el HTML. */
  /* ─── Memoria y precarga del detalle (hito 0, punto 5) ───
     El detalle de una sede (obtenerPresupuesto y listarFotos) tarda varios
     segundos en Apps Script. Se guarda en memoria por DANE, y se pide por
     adelantado cuando el cursor se detiene sobre una sede o el foco llega a
     ella, para que la Ficha abra con todo ya cargado.
     - La memoria del presupuesto vale mientras no cambie el resumen que trae
       listarSedes (versión vigente, estado, concepto): si otra persona radica
       o emite un concepto, la próxima carga de sedes la invalida sola.
     - Además vence a los FICHA_MEMORIA_MS, y se borra al escribir desde esta
       sesión (guardar, subir foto, concepto, volcado), con «Actualizar» y al
       salir.
     - Solo se precarga lo que tiene presupuesto: una sede vacía no tiene
       detalle que traer. Como máximo PRECARGA_MAX pedidos de precarga a la
       vez, para no saturar Apps Script (que con muchos pedidos simultáneos
       deja de ejecutar algunos, ver transporte.js); si ya hay ese número en
       curso, la precarga se omite y la Ficha carga normal al abrirse. */
  const FICHA_MEMORIA_MS = 5 * 60 * 1000;
  const PRECARGA_MAX = 2;
  const PRECARGA_ESPERA_MS = 250;
  const ACCIONES_FICHA = ['obtenerPresupuesto', 'listarFotos'];
  let memoriaFicha = new Map(); // `${accion}|${dane}` -> { firma, en, promesa }
  let precargasEnCurso = 0;

  function firmaResumenSede(dane){
    const s = SEDES && SEDES.find(x => String(x.dane_sede) === String(dane));
    const p = s && s.presupuesto;
    return p ? [p.id_presupuesto, p.estado, p.fecha_concepto || ''].join('|') : '';
  }
  function memoriaVigente(accion, dane){
    const m = memoriaFicha.get(accion + '|' + dane);
    return !!m && Date.now() - m.en < FICHA_MEMORIA_MS &&
      (accion !== 'obtenerPresupuesto' || m.firma === firmaResumenSede(dane));
  }
  // Devuelve la respuesta en memoria o la pide; una respuesta con error no se guarda.
  function pedirDetalleFicha(accion, dane){
    const clave = accion + '|' + dane;
    if (memoriaVigente(accion, dane)) return memoriaFicha.get(clave).promesa;
    const promesa = backend(accion, { token: sesion.token, dane_sede: dane }).then(r => {
      if (!r.ok) memoriaFicha.delete(clave);
      return r;
    }, err => { memoriaFicha.delete(clave); throw err; });
    memoriaFicha.set(clave, { firma: firmaResumenSede(dane), en: Date.now(), promesa });
    return promesa;
  }
  // Sin DANE, borra todo.
  function olvidarFicha(dane){
    if (dane == null) { memoriaFicha.clear(); return; }
    ACCIONES_FICHA.forEach(a => memoriaFicha.delete(a + '|' + dane));
  }
  function precargarFicha(dane){
    if (!sesion || !SEDES || !dane) return;
    const s = SEDES.find(x => String(x.dane_sede) === String(dane));
    if (!s || !s.presupuesto) return;
    const faltan = ACCIONES_FICHA.filter(a => !memoriaVigente(a, dane));
    if (!faltan.length || precargasEnCurso + faltan.length > PRECARGA_MAX) return;
    faltan.forEach(a => {
      precargasEnCurso++;
      pedirDetalleFicha(a, dane).catch(() => {}).finally(() => { precargasEnCurso--; });
    });
  }

  const RESULTADO_TXT = { CORRESPONDE: 'Corresponde', CORRESPONDE_PARCIAL: 'Corresponde parcialmente', NO_CORRESPONDE: 'No corresponde' };

  // Resumen del presupuesto vigente. Sirve tanto con el resumen que ya trae
  // listarSedes (se pinta al instante) como con el detalle de obtenerPresupuesto.
  function htmlResumenPresupuesto(p){
    const [cls, txt] = ESTADOS_PRESUPUESTO[p.estado] || ['e-pend', p.estado];
    const fechaP = p.fecha_creacion ? new Date(p.fecha_creacion).toLocaleString('es-CO') : '—';
    return `<dl class="kv">
        <dt>Estado</dt><dd><span class="est ${cls}">${esc(txt)}</span>${p.estado === 'RADICADO' ? ' ' + chipEspera(p.fecha_creacion, 'esperando concepto') : ''}</dd>
        <dt>Versión vigente</dt><dd>v${esc(p.version)}</dd>
        <dt>Total del presupuesto</dt><dd class="n"><b>${esc(cop(p.total_presupuesto))}</b></dd>
        <dt>Costo directo</dt><dd class="n">${esc(cop(p.costo_directo))}</dd>
        <dt>Declaración</dt><dd>${p.declara_sin_afectacion ? 'La sede <b>no</b> presenta afectación' : 'Presenta afectación'}</dd>
        <dt>Origen</dt><dd>${p.origen === 'CARGA' ? `<span class="orig xls">XLS</span> Carga de Excel${p.archivo_origen ? ' · ' + esc(p.archivo_origen) : ''}` : '<span class="orig man">MAN</span> Diligenciado a mano'}</dd>
        <dt>Registrado por</dt><dd>${esc(p.creado_por || '—')}</dd>
        <dt>Fecha</dt><dd>${esc(fechaP)}</dd>
      </dl>`;
  }

  function pintarFichaReal(){
    const $ = id => document.getElementById(id);
    const R = ROLES[rol];
    const secundarios = ['ficha-resumen', 'ficha-historial', 'ficha-caps', 'ficha-detalle', 'ficha-formato'];
    fichaPresupuestoActual = null; fichaItemsActual = []; fichaVerificacionActual = null;
    fichaFotosActual = []; fichaHistorialActual = [];
    // Se ocultan acá, síncrono, antes de que la carga async decida si los
    // vuelve a mostrar — si no, al pasar de una sede con concepto/fotos a otra
    // sin ellos, quedarían pegados los de la sede anterior.
    ['ficha-concepto', 'ficha-fotos', 'ficha-linea', 'ficha-btn-verificar', 'ficha-btn-pdf'].forEach(id => $(id).classList.add('oculto'));

    if (!SEDES){
      $('ficha-nombre').textContent = 'Cargando…';
      $('ficha-kv').innerHTML = esqueletoLineas(4);
      secundarios.forEach(id => $(id).classList.add('oculto'));
      return;
    }
    const s = SEDES.find(x => String(x.dane_sede) === String(daneActual));
    if (!s){
      $('ficha-nombre').textContent = 'Sede no encontrada';
      $('ficha-badge').className = 'est e-pend'; $('ficha-badge').textContent = '—';
      $('ficha-kv').innerHTML = '<dt>Motivo</dt><dd>No está en su alcance, o el DANE no existe en el catálogo.</dd>';
      $('ficha-btn-editar').classList.add('oculto');
      secundarios.forEach(id => $(id).classList.add('oculto'));
      return;
    }
    secundarios.forEach(id => $(id).classList.remove('oculto'));

    $('ficha-nombre').textContent = nombreSedeCorto(s);
    $('ficha-badge').outerHTML = estadoBadge(s).replace('<span class="est', '<span id="ficha-badge" class="est');
    $('ficha-btn-editar').textContent = s.presupuesto ? 'Editar presupuesto' : 'Registrar presupuesto';

    const filaLote = R.interno
      ? `<dt>Lote</dt><dd>${s.lote ? esc(s.lote.nombre) + (s.lote.activo ? '' : ' <span class="ctr">cerrado</span>') : '<span class="ctr">sin lote</span>'}</dd>`
      : '';
    $('ficha-kv').innerHTML =
      `<dt>DANE sede</dt><dd class="dane">${esc(s.dane_sede)}</dd>` +
      `<dt>Municipio</dt><dd>${esc(s.municipio)}${s.zona ? ' · zona ' + esc(String(s.zona).toLowerCase()) : ''}</dd>` +
      `<dt>Matrícula</dt><dd class="n">${formatNum(s.matricula, 0)} estudiantes</dd>` +
      `<dt>Tipo de afectación</dt><dd>${tipoCensoHtml(s)}</dd>` + filaLote +
      `<dt>Estado de prestación</dt><dd>${esc(s.estado_prestacion || '—')}</dd>` +
      `<dt>Concepto técnico</dt><dd>${esc(s.concepto_tecnico || '—')}</dd>` +
      `<dt>Observaciones del censo</dt><dd>${esc(s.observaciones_censo || 'Sin observaciones')}</dd>`;

    // Lo que ya trae listarSedes se muestra de una vez; ítems, historial y
    // concepto llegan después con obtenerPresupuesto.
    if (s.presupuesto){
      $('ficha-resumen-cuerpo').innerHTML = htmlResumenPresupuesto(s.presupuesto);
      $('ficha-btn-verificar').classList.toggle('oculto', !(R.verifica && s.presupuesto.estado === 'RADICADO'));
      $('ficha-historial-tbody').innerHTML = filasEsqueleto(5, 2);
      $('ficha-historial-pie').textContent = 'Cargando el historial de versiones…';
      $('ficha-detalle-eyebrow').textContent = 'Cargando…';
      $('ficha-detalle-items').innerHTML = `<div style="padding:1rem 1.1rem">${esqueletoLineas(3)}</div>`;
      pintarCapitulosFicha(s, null, s.presupuesto);
    } else {
      $('ficha-resumen-cuerpo').innerHTML = '<p class="vacio-tx">Esta sede todavía no tiene presupuesto registrado.</p>';
      $('ficha-historial-tbody').innerHTML =
        '<tr><td colspan="5" style="color:var(--tx-sec);text-align:center;padding:1rem">Sin versiones registradas</td></tr>';
      $('ficha-historial-pie').textContent = 'Cada vez que se guarda o se corrige, entra una versión nueva; ninguna anterior se borra.';
      $('ficha-detalle-eyebrow').textContent = 'Sin ítems';
      $('ficha-detalle-items').innerHTML = '<div class="vacio"><h3>Sin ítems</h3><p>Esta sede no tiene presupuesto registrado.</p></div>';
      pintarCapitulosFicha(s, [], null);
    }
    $('ficha-detalle-totales').classList.add('oculto');

    const TEXTO_PENDIENTE = ['Completa', 'Sin diligenciar', 'Sin diligenciar', 'Sin adjuntar', 'Pendiente'];
    document.querySelectorAll('#ficha-formato .paso-sec').forEach((paso, i) => {
      paso.classList.toggle('done', i === 0);
      const est = paso.querySelector('.est');
      est.className = i === 0 ? 'est e-apr' : 'est e-pend';
      est.textContent = TEXTO_PENDIENTE[i];
    });
    actualizarContadorFormatoOficial();

    if (s.presupuesto) cargarPresupuestoDeFicha(daneActual);
    cargarFotosDeFicha(daneActual);
  }

  // Cruce por capítulo (D-34): daño del censo contra el capítulo de cada ítem
  // realmente registrado. Un ítem con capítulo vacío (carga masiva sin
  // desglose, D-36) no marca ningún capítulo — nunca se infiere de texto libre.
  // items === null: el detalle todavía no llega.
  function pintarCapitulosFicha(s, items, p){
    const cuerpo = document.getElementById('ficha-caps-cuerpo');
    const pie = document.getElementById('ficha-caps-pie');
    const cd = capitulosDeSede(s);
    if (cd.corrupto){
      cuerpo.innerHTML = `<div class="aviso-foto"><b>Dato de capítulo no legible</b>El campo capitulos_dano llegó como el número ${esc(cd.crudo)} en vez de una lista de texto. Repórtelo como hallazgo.</div>`;
      pie.classList.add('oculto');
      return;
    }
    const lista = items || [];
    const capsConPresupuesto = new Set(lista.map(it => String(it.capitulo || '')).filter(Boolean));
    let html = '';
    for (let n = 1; n <= 11; n++){
      const dano = cd.lista.includes(String(n));
      const pres = capsConPresupuesto.has(String(n));
      const marca = dano && lista.length
        ? (pres ? '<span class="flex"></span><span class="cok">✓ $</span>' : '<span class="flex"></span><span class="cer">sin $</span>')
        : '';
      html += `<div class="cap${dano ? ' dano' : ''}${pres ? ' pres' : ''}"><span class="cn">${n}</span>${esc(CAPITULOS[n])}${marca}</div>`;
    }
    for (let n = 12; n <= 14; n++){
      const pres = capsConPresupuesto.has(String(n));
      html += `<div class="cap trans${pres ? ' pres' : ''}"><span class="cn">${n}</span>${esc(CAPITULOS[n])}<span class="flex"></span><span class="ctr">transversal</span></div>`;
    }
    cuerpo.innerHTML = `<div class="caps">${html}</div>`;
    pie.classList.remove('oculto');
    const caps = `${cd.lista.length} capítulo(s) (${cd.lista.join(', ')})`;
    const sinItemizar = lista.length > 0 && capsConPresupuesto.size === 0;
    const sinPresupuestar = cd.lista.filter(n => !capsConPresupuesto.has(n));
    pie.innerHTML = !cd.lista.length
      ? 'El censo no marca ningún capítulo con daño para esta sede.'
      : (p && p.declara_sin_afectacion)
        ? `<b>Se declaró que la sede no presenta afectación</b>, pero el censo marca daño en ${caps}. Es una discrepancia: queda como hallazgo para que el municipio la confirme.`
        : items === null
          ? `El censo marca daño en ${caps}. Cargando el presupuesto para cruzarlo…`
          : !lista.length
            ? `El censo marca daño en ${caps}. Todavía no hay ítems registrados para cruzar contra ellos.`
            : sinItemizar
              ? 'El presupuesto llegó <b>sin desglose por capítulo</b> (carga de Excel sin itemización) — no se puede cruzar automáticamente. El arquitecto revisa el archivo original al verificar.'
              : sinPresupuestar.length
                ? `El censo marca daño en ${caps}. <b>Quedan sin presupuestar: ${sinPresupuestar.join(', ')}.</b>`
                : `El censo marca daño en ${caps} y los <b>${cd.lista.length} están cubiertos</b> por el presupuesto.`;
  }

  async function cargarPresupuestoDeFicha(dane){
    const $ = id => document.getElementById(id);
    let r;
    try {
      r = await pedirDetalleFicha('obtenerPresupuesto', dane);
    } catch (err) {
      r = { ok: false, error: 'No se pudo contactar el servidor.' };
    }
    if (String(dane) !== String(daneActual) || vista !== 'ficha') return; // ya se navegó a otro lado
    if (!r.ok || !r.presupuesto){
      const msg = !r.ok ? (r.error || 'No se pudo cargar el detalle.') : 'El servidor no devolvió el detalle de este presupuesto.';
      $('ficha-historial-tbody').innerHTML = `<tr><td colspan="5" class="err-tx" style="padding:1rem">${esc(msg)}</td></tr>`;
      $('ficha-historial-pie').textContent = 'Use «Actualizar» para intentarlo de nuevo.';
      $('ficha-detalle-eyebrow').textContent = '—';
      $('ficha-detalle-items').innerHTML = `<p class="err-tx" style="padding:1rem 1.1rem;margin:0">${esc(msg)}</p>`;
      return;
    }

    const p = r.presupuesto;
    const items = r.items || [];
    fichaPresupuestoActual = p; fichaItemsActual = items; fichaVerificacionActual = r.verificacion || null;
    const historial = (r.historial && r.historial.length) ? r.historial : [p];
    fichaHistorialActual = historial;
    const s = SEDES && SEDES.find(x => String(x.dane_sede) === String(dane));
    const [cls, txt] = ESTADOS_PRESUPUESTO[p.estado] || ['e-pend', p.estado];
    const R = ROLES[rol];

    const badge = $('ficha-badge');
    badge.className = 'est ' + cls; badge.textContent = txt;
    const borrador = r.borrador || null;
    $('ficha-btn-editar').textContent = borrador ? `Retomar borrador v${borrador.version}` : 'Editar presupuesto';
    $('ficha-btn-pdf').classList.remove('oculto');
    $('ficha-btn-verificar').classList.toggle('oculto', !(R.verifica && p.estado === 'RADICADO'));
    $('ficha-resumen-cuerpo').innerHTML = htmlResumenPresupuesto(p);

    $('ficha-historial-tbody').innerHTML = historial.map(v => {
      const [vcls, vtxt] = ESTADOS_PRESUPUESTO[v.estado] || ['e-pend', v.estado];
      const origen = v.origen === 'CARGA' ? ['xls', 'XLS'] : ['man', 'MAN'];
      const fechaV = v.fecha_creacion ? new Date(v.fecha_creacion).toLocaleDateString('es-CO') : '';
      const marca = String(v.version) === String(p.version) ? ' <span class="hace">· vigente</span>'
        : borrador && String(v.version) === String(borrador.version) ? ' <span class="hace">· en espera</span>' : '';
      return `<tr><td><strong>v${esc(v.version)}</strong>${marca}</td><td><span class="est ${vcls}">${esc(vtxt)}</span></td>` +
        `<td><span class="orig ${origen[0]}">${origen[1]}</span></td><td class="n">${esc(cop(v.total_presupuesto))}</td>` +
        `<td class="hace">${esc(fechaV)}</td></tr>`;
    }).join('');
    $('ficha-historial-pie').textContent = borrador
      ? `Hay un borrador v${borrador.version} en espera: no reemplaza a la v${p.version}, que sigue vigente hasta que el borrador se radique. Ninguna versión se borró.`
      : historial.length > 1
      ? `${historial.length} versiones guardadas — la vigente es v${p.version}. Ninguna versión anterior se borró.`
      : `Si se corrige, entra como v${Number(p.version) + 1} y queda vigente — esta v${p.version} no se borra.`;

    if (s) pintarCapitulosFicha(s, items, p);

    $('ficha-detalle-eyebrow').textContent = `${items.length} ítem${items.length === 1 ? '' : 's'}`;
    $('ficha-detalle-items').innerHTML = !items.length
      ? `<div class="vacio"><h3>Sin ítems</h3><p>${p.declara_sin_afectacion ? 'Se declaró que esta sede no presenta afectación.' : 'Presupuesto registrado sin desglose por capítulo.'}</p></div>`
      : `<div class="scroll"><table>
        <thead><tr><th>#</th><th>Capítulo</th><th>Trabajo a ejecutar</th><th>Un.</th>
          <th class="n">Cant.</th><th class="n">Vr. unitario</th><th class="n">Valor total</th></tr></thead>
        <tbody>${items.map((it, i) => `<tr><td class="n">${i + 1}</td>` +
          `<td>${it.capitulo ? `<span class="dane">${esc(it.capitulo)}</span> ${esc(CAPITULOS[it.capitulo] || '')}` : 'Sin desglose'}</td>` +
          `<td>${esc(it.descripcion || '')}</td><td class="dane">${esc(it.unidad || '')}</td>` +
          `<td class="n">${formatNum(it.cantidad, 2)}</td><td class="n">${esc(cop(it.valor_unitario))}</td>` +
          `<td class="n"><b>${esc(cop(it.valor_total))}</b></td></tr>`).join('')}</tbody>
      </table></div>`;
    const totales = $('ficha-detalle-totales');
    totales.classList.remove('oculto');
    totales.innerHTML = `<dl class="tot">
        <dt>Costo directo</dt><dd class="n">${esc(cop(p.costo_directo))}</dd>
        <dt>Administración <span class="pct">${formatNum(p.pct_admin, 0)} %</span></dt><dd class="n">${esc(cop(p.valor_admin))}</dd>
        <dt>Utilidad <span class="pct">${formatNum(p.pct_utilidad, 0)} %</span></dt><dd class="n">${esc(cop(p.valor_utilidad))}</dd>
        <dt>IVA 19 % sobre la utilidad</dt><dd class="n">${esc(cop(p.valor_iva))}</dd>
        <dt class="gt">Total del presupuesto</dt><dd class="n gt">${esc(cop(p.total_presupuesto))}</dd>
        <dt>Plazo de ejecución</dt><dd class="n">${p.plazo_dias ? formatNum(p.plazo_dias, 0) + ' días' : '—'}</dd>
      </dl>`;

    // Formato oficial: cada sección se marca completa según el dato real
    // (mismo criterio de longitud mínima que exige Presupuestos_guardar).
    const pasos = document.querySelectorAll('#ficha-formato .paso-sec');
    const marcar = (i, ok, txtOk, txtNo, clsNo) => {
      pasos[i].classList.toggle('done', ok);
      const est = pasos[i].querySelector('.est');
      est.className = ok ? 'est e-apr' : 'est ' + (clsNo || 'e-pend');
      est.textContent = ok ? txtOk : txtNo;
    };
    const step2 = p.declara_sin_afectacion
      ? (p.justificacion_discrepancia || '').trim().length >= 40
      : (p.descripcion_afectacion || '').trim().length >= 60;
    marcar(1, step2, 'Completa', 'Sin diligenciar');
    marcar(2, items.length > 0 || !!p.declara_sin_afectacion, 'Completa', 'Sin ítems');

    const panelConcepto = $('ficha-concepto');
    if (r.verificacion){
      const rtxt = RESULTADO_TXT[r.verificacion.resultado] || r.verificacion.resultado;
      const ok = r.verificacion.resultado === 'CORRESPONDE';
      pasos[4].classList.add('done');
      const est5 = pasos[4].querySelector('.est');
      est5.className = ok ? 'est e-apr' : 'est e-rad'; est5.textContent = rtxt;
      panelConcepto.classList.remove('oculto');
      const b = $('ficha-concepto-badge');
      b.className = est5.className; b.textContent = rtxt;
      $('ficha-concepto-quien').textContent = r.verificacion.verificador_correo || '—';
      $('ficha-concepto-fecha').textContent = r.verificacion.fecha_verificacion
        ? new Date(r.verificacion.fecha_verificacion).toLocaleString('es-CO') : '—';
      $('ficha-concepto-obs').textContent = r.verificacion.observaciones || '(sin observaciones — el resultado fue "corresponde")';
    } else {
      marcar(4, false, '', p.estado === 'BORRADOR' ? 'Aún no radicado' : 'Pendiente');
      panelConcepto.classList.add('oculto');
    }
    actualizarContadorFormatoOficial();
    pintarLineaTiempo();
  }

  // Recuenta sobre el DOM en vez de sumar a mano: presupuesto y fotos llegan
  // por llamadas independientes que pueden resolver en cualquier orden.
  function actualizarContadorFormatoOficial(){
    const pasos = document.querySelectorAll('#ficha-formato .paso-sec');
    const completos = [...pasos].filter(p => p.classList.contains('done')).length;
    document.getElementById('ficha-formato-eyebrow').textContent = `${completos} de ${pasos.length} secciones`;
  }

  async function cargarFotosDeFicha(dane){
    let r;
    try { r = await pedirDetalleFicha('listarFotos', dane); }
    catch (err) { return; }
    if (String(dane) !== String(daneActual) || vista !== 'ficha') return;
    const fotos = (r.ok && r.fotos) ? r.fotos : [];
    const n = fotos.length;
    const paso4 = document.querySelectorAll('#ficha-formato .paso-sec')[3];
    paso4.classList.toggle('done', n > 0);
    const est4 = paso4.querySelector('.est');
    est4.className = n > 0 ? 'est e-apr' : 'est e-pend';
    est4.textContent = n > 0 ? `${n} adjunta${n === 1 ? '' : 's'}` : 'Sin adjuntar';
    actualizarContadorFormatoOficial();

    fichaFotosActual = fotos;
    const panelFotos = document.getElementById('ficha-fotos');
    panelFotos.classList.toggle('oculto', n === 0);
    if (n > 0) {
      document.getElementById('ficha-fotos-eyebrow').textContent = `${n} foto${n === 1 ? '' : 's'}`;
      // La miniatura es una <img>: si Drive no la entrega (error, o una imagen
      // de 1×1 px), se retira y queda visible la extensión del archivo.
      document.getElementById('ficha-fotos-lista').innerHTML = fotos.map(f => {
        const ext = esc(String(f.nombre || '').split('.').pop().slice(0, 4).toUpperCase() || 'IMG');
        return `<a class="foto" href="${esc(f.url || '#')}" target="_blank" rel="noopener" title="Ver «${esc(f.nombre)}» en Drive">
          <div class="ph"><span>${ext}</span>${f.miniatura ? `<img src="${esc(f.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer"
            onload="if(this.naturalWidth<=1)this.remove()" onerror="this.remove()">` : ''}</div>
          <b title="${esc(f.nombre)}">${esc(String(f.nombre || '').replace(/^\d{8}_\d{6}_/, ''))}</b>
          <small>${new Date(f.fecha).toLocaleDateString('es-CO')}</small>
        </a>`;
      }).join('');
    }
    pintarLineaTiempo();
  }

  // Línea de tiempo de la sede: versiones, concepto y fotos, más reciente
  // primero. Solo con lo que devuelve el backend; no se infiere nada.
  function pintarLineaTiempo(){
    const panel = document.getElementById('ficha-linea');
    const eventos = [];
    fichaHistorialActual.forEach(v => {
      // El estado de una versión puede cambiar después por un concepto (D-39);
      // cómo nació se deduce de si fue borrador o de su origen.
      const nacio = v.estado === 'BORRADOR' ? 'borrador' : (v.origen === 'CARGA' ? 'carga' : 'radicado');
      const verbo = { borrador: 'guardada como borrador', carga: 'cargada desde Excel', radicado: 'radicada' }[nacio];
      eventos.push({ fecha: v.fecha_creacion, clase: nacio, titulo: `Versión ${v.version} ${verbo}`,
        detalle: `${cop(v.total_presupuesto)} · ${v.creado_por || ''}` });
    });
    const c = fichaVerificacionActual;
    if (c) eventos.push({ fecha: c.fecha_verificacion, clase: c.resultado === 'CORRESPONDE' ? 'aprobado' : 'ajuste',
      titulo: `Concepto: ${RESULTADO_TXT[c.resultado] || c.resultado}`, detalle: c.verificador_correo || '' });
    const porDia = new Map();
    fichaFotosActual.forEach(f => {
      const d = new Date(f.fecha); if (isNaN(d)) return;
      const k = d.toDateString();
      const prev = porDia.get(k);
      porDia.set(k, { n: (prev ? prev.n : 0) + 1, fecha: prev && new Date(prev.fecha) > d ? prev.fecha : f.fecha });
    });
    porDia.forEach(v => eventos.push({ fecha: v.fecha, clase: 'fotos',
      titulo: `${v.n} fotografía${v.n === 1 ? '' : 's'} subida${v.n === 1 ? '' : 's'}`, detalle: '' }));
    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    panel.classList.toggle('oculto', !eventos.length);
    document.getElementById('ficha-linea-cuerpo').innerHTML = `<ol class="linea">${eventos.map(e => `
      <li class="ev ${e.clase}"><span class="ev-pto" aria-hidden="true"></span>
        <div class="ev-tx"><b>${esc(e.titulo)}</b>${e.detalle ? `<span>${esc(e.detalle)}</span>` : ''}</div>
        <time>${e.fecha ? esc(new Date(e.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''}</time>
      </li>`).join('')}</ol>`;
  }

