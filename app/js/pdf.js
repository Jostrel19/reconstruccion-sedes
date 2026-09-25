/* app/js/pdf.js — PDF del formato oficial.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── PDF del formato oficial (Paso 6, adelantado a pedido) — mismo truco
     sin librerías del sistema anterior: un iframe oculto con el documento
     completo, impreso desde ahí ("Guardar como PDF" lo resuelve el propio
     diálogo de impresión del navegador). Reescrito para el modelo de datos
     nuevo: ya no hay firma-imagen (D-13) porque D-21 la reemplazó por el
     registro de auditoría de la sesión — se imprime el correo y la fecha de
     quien radicó y de quien verificó, no una rúbrica escaneada. Las fotos se
     listan por nombre y fecha (no se incrustan: `listarFotos` nunca trae el
     contenido, solo metadata y un enlace a Drive — ver `fichaFotosActual`). ─── */

  function generarPdfFicha(){
    const s = SEDES && SEDES.find(x => String(x.dane_sede) === String(daneActual));
    if (!s){ avisar('Todavía no llegan los datos de esta sede. Intente en un momento.', 'info'); return; }
    if (!fichaPresupuestoActual){ avisar('El detalle del presupuesto todavía se está cargando. Intente en un momento.', 'info'); return; }
    _imprimirFormatoOficial(s, fichaPresupuestoActual, fichaItemsActual, fichaVerificacionActual, fichaFotosActual);
  }

  function _pdfPesos(n){ return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); }
  function _pdfFecha(iso){
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function _imprimirFormatoOficial(s, p, items, verificacion, fotos){
    const previo = document.getElementById('marcoImpresion');
    if (previo) previo.remove();
    const marco = document.createElement('iframe');
    marco.id = 'marcoImpresion';
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(marco);
    const doc = marco.contentDocument;
    doc.open();
    doc.write(_htmlFormatoOficial(s, p, items, verificacion, fotos || []));
    doc.close();
    const imprimir = () => { marco.contentWindow.focus(); marco.contentWindow.print(); };
    marco.onload = imprimir;
    if (doc.readyState === 'complete') imprimir();
  }

  function _htmlFormatoOficial(s, p, items, verificacion, fotos){
    const filasItems = items.length ? items.map((it, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(it.capitulo ? `${it.capitulo}. ${CAPITULOS[it.capitulo] || ''}` : 'Sin desglose por capítulo')}<br><span class="peq">${esc(it.descripcion || '')}</span></td>
        <td class="c">${esc(it.unidad || '')}</td>
        <td class="d">${formatNum(it.cantidad, 2)}</td>
        <td class="d">${_pdfPesos(it.valor_unitario)}</td>
        <td class="d">${_pdfPesos(it.valor_total)}</td>
      </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:#666">Presupuesto radicado sin desglose por capítulo (carga masiva de Excel) — el detalle está en el Excel original adjunto en Cargas.</td></tr>`;

    const RESULTADO_TXT = { CORRESPONDE: 'Corresponde', CORRESPONDE_PARCIAL: 'Corresponde parcialmente', NO_CORRESPONDE: 'No corresponde' };

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>${esc(p.id_presupuesto)}</title>
<style>
  @page { size: letter; margin: 1.8cm 1.6cm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 10.5pt; color: #111; margin: 0; line-height: 1.35; }
  .enc { text-align: center; border-bottom: 2px solid #12395f; padding-bottom: .4rem; margin-bottom: .9rem; }
  .enc .ent { font-family: Arial, sans-serif; font-size: 9pt; letter-spacing: .06em; color: #12395f; font-weight: bold; }
  h1 { font-size: 13pt; margin: .5rem 0 .15rem; text-transform: uppercase; }
  .sub { font-size: 9.5pt; font-style: italic; color: #444; }
  h2 { font-family: Arial, sans-serif; font-size: 10pt; text-transform: uppercase;
       background: #eef2f6; border-left: 3px solid #12395f; padding: .25rem .5rem;
       margin: 1rem 0 .45rem; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: .5rem; }
  th, td { border: 1px solid #9aa7b3; padding: .22rem .35rem; vertical-align: top; font-size: 9.5pt; }
  th { background: #eef2f6; font-family: Arial, sans-serif; font-size: 8.5pt; text-transform: uppercase; }
  td.c { text-align: center; } td.d { text-align: right; }
  .ident td:nth-child(odd) { background: #f6f8fa; font-family: Arial, sans-serif;
       font-size: 8.5pt; text-transform: uppercase; width: 20%; }
  .peq { font-size: 8.5pt; color: #555; }
  .total { text-align: right; font-weight: bold; font-size: 11pt; margin: .3rem 0 .8rem;
           border-top: 2px solid #12395f; padding-top: .25rem; }
  .firmas { display: flex; gap: 2.5rem; margin-top: 1.4rem; page-break-inside: avoid; }
  .firmas > div { flex: 1; border-top: 1px solid #111; padding-top: .2rem; font-size: 9pt; }
  .pie { margin-top: 1.2rem; border-top: 1px solid #ccc; padding-top: .3rem;
         font-family: Arial, sans-serif; font-size: 8pt; color: #666; }
  .radicado { float: right; font-family: Arial, sans-serif; font-size: 8.5pt;
              border: 1px solid #12395f; padding: .15rem .45rem; color: #12395f; }
  section { page-break-inside: avoid; }
</style></head><body>

<div class="enc">
  <div class="radicado">${esc(p.id_presupuesto)}</div>
  <div class="ent">GOBERNACIÓN DE CALDAS · SECRETARÍA DE EDUCACIÓN</div>
  <div class="ent" style="font-weight:normal">Dirección de Planeación — Infraestructura Educativa</div>
  <h1>Informe técnico-presupuestal</h1>
  <div class="sub">Reparación de infraestructura educativa afectada por el sismo del 10 de agosto de 2026</div>
</div>

<section>
<h2>1. Datos de identificación</h2>
<table class="ident">
  <tr><td>Municipio</td><td>${esc(s.municipio)}</td>
      <td>Institución</td><td>${esc(s.institucion || '—')}</td></tr>
  <tr><td>Sede educativa</td><td colspan="3">${esc(s.sede)}</td></tr>
  <tr><td>Código DANE</td><td>${esc(s.dane_sede)}</td>
      <td>Zona / Matrícula</td><td>${esc(s.zona || '—')} · ${formatNum(s.matricula, 0)} estudiantes</td></tr>
  <tr><td>Radicado por</td><td>${esc(p.creado_por)}</td>
      <td>Fecha de radicación</td><td>${_pdfFecha(p.fecha_creacion)}</td></tr>
  <tr><td>Origen</td><td>${p.origen === 'CARGA' ? 'Carga masiva de Excel' : 'Diligenciamiento manual'}</td>
      <td>Versión</td><td>v${esc(p.version)}</td></tr>
</table>
</section>

<section>
<h2>2. Necesidad y grado de afectación</h2>
<table>
  <tr><td style="width:26%;background:#f6f8fa"><b>Clasificación del censo</b></td>
      <td>${esc(s.tipo_censo || '—')}</td></tr>
  <tr><td style="background:#f6f8fa"><b>Declaración del municipio</b></td>
      <td>${p.declara_sin_afectacion
            ? 'La sede <b>NO</b> presenta afectación que requiera inversión.'
            : 'La sede <b>SÍ</b> presenta afectación que requiere inversión.'}</td></tr>
</table>
<p><b>${p.declara_sin_afectacion ? 'Justificación de la discrepancia con el censo' : 'Descripción de la afectación'}:</b></p>
<p style="text-align:justify">${esc(p.declara_sin_afectacion ? p.justificacion_discrepancia : p.descripcion_afectacion)}</p>
</section>

${!p.declara_sin_afectacion ? `
<section>
<h2>3. Presupuesto detallado y discriminado</h2>
<table>
  <thead><tr>
    <th style="width:4%">Ítem</th><th>Capítulo y trabajo a ejecutar</th>
    <th style="width:9%">Unidad</th><th style="width:11%">Cantidad</th>
    <th style="width:15%">Valor unitario</th><th style="width:16%">Valor total</th>
  </tr></thead>
  <tbody>${filasItems}</tbody>
</table>
</section>

<section>
<h2>3.1 Resumen económico</h2>
<table>
  <tr><td style="width:60%">Costo directo</td><td class="d">${_pdfPesos(p.costo_directo)}</td></tr>
  <tr><td>Administración (${formatNum(p.pct_admin, 0)} %)</td><td class="d">${_pdfPesos(p.valor_admin)}</td></tr>
  <tr><td>Utilidad (${formatNum(p.pct_utilidad, 0)} %)</td><td class="d">${_pdfPesos(p.valor_utilidad)}</td></tr>
  <tr><td>IVA 19 % sobre la utilidad <span class="peq">(Decreto 1372 de 1992, art. 3)</span></td>
      <td class="d">${_pdfPesos(p.valor_iva)}</td></tr>
  <tr><td><b>TOTAL PRESUPUESTO</b></td><td class="d"><b>${_pdfPesos(p.total_presupuesto)}</b></td></tr>
</table>
<p class="peq">No se incluyen imprevistos. AIU sin tope legal — práctica de mercado, no umbral obligatorio.</p>
</section>

<section>
<h2>4. Plazo de ejecución</h2>
<p><b>Plazo total estimado de ejecución:</b> ${p.plazo_dias ? formatNum(p.plazo_dias, 0) + ' días calendario' : 'sin especificar'}.</p>
</section>
` : ''}

<section>
<h2>5. Observaciones de verificación</h2>
<table>
  <tr><td style="width:40%;background:#f6f8fa"><b>Resultado</b></td><td><b>Observaciones</b></td></tr>
  <tr>
    <td>${verificacion ? esc(RESULTADO_TXT[verificacion.resultado] || verificacion.resultado) : 'Pendiente de verificación'}</td>
    <td>${verificacion ? esc(verificacion.observaciones || '(sin observaciones)') : '—'}</td>
  </tr>
</table>

<div class="firmas">
  <div>
    <b>Radicado por</b><br>${esc(p.creado_por)}<br>
    <span class="peq">${_pdfFecha(p.fecha_creacion)} — registro de sesión, sin firma escaneada</span>
  </div>
  <div>
    <b>Verificado por</b><br>${verificacion ? esc(verificacion.verificador_correo) : '(sin verificar todavía)'}<br>
    <span class="peq">${verificacion ? _pdfFecha(verificacion.fecha_verificacion) + ' — registro de sesión, sin firma escaneada' : ''}</span>
  </div>
</div>
</section>

<section>
<h2>6. Registro fotográfico</h2>
${fotos && fotos.length ? `
<table>
  <thead><tr><th>Archivo</th><th style="width:20%">Fecha</th></tr></thead>
  <tbody>${fotos.map(f => `
      <tr><td>${esc(f.nombre)}</td><td>${_pdfFecha(f.fecha)}</td></tr>`).join('')}
  </tbody>
</table>
<p class="peq">${fotos.length} foto${fotos.length === 1 ? '' : 's'} adjunta${fotos.length === 1 ? '' : 's'}, con su contenido en Drive — se consultan desde la Ficha, no se incrustan en este documento.</p>
` : '<p class="peq">Sin fotografías adjuntas todavía.</p>'}
</section>

<div class="pie">
  Radicado ${esc(p.id_presupuesto)} · versión ${esc(p.version)} · generado el ${_pdfFecha(new Date().toISOString())} ·
  Secretaría de Educación de Caldas — Dirección de Planeación.
</div>

</body></html>`;
  }

