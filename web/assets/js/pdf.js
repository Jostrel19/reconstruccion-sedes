/**
 * GENERACIÓN DEL FORMATO OFICIAL DILIGENCIADO
 *
 * Reproduce «INFORME TÉCNICO PRESUPUESTAL para municipios.docx» con los datos
 * radicados y lo manda a la impresión del navegador, donde se guarda como PDF.
 * Se hace con un iframe y no con window.open porque los bloqueadores de
 * ventanas emergentes impedirían lo segundo sin avisar.
 *
 * Sin librerías externas: el sitio no carga nada de terceros.
 */

const pdf = {

  async generar(reg) {
    // Las imágenes viven en IndexedDB, no en el registro: hay que traerlas
    // antes de componer el documento.
    reg = {
      ...reg,
      fotos: await almacen.leer(reg.dane_sede),
      firma_sed: almacen.firma('sed')
    };
    const previo = document.getElementById('marcoImpresion');
    if (previo) previo.remove();

    const marco = document.createElement('iframe');
    marco.id = 'marcoImpresion';
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(marco);

    const doc = marco.contentDocument;
    doc.open();
    doc.write(this._html(reg));
    doc.close();

    marco.onload = () => {
      marco.contentWindow.focus();
      marco.contentWindow.print();
    };
    // Algunos navegadores ya dispararon load antes de asignar el manejador.
    if (doc.readyState === 'complete') {
      marco.contentWindow.focus();
      marco.contentWindow.print();
    }
  },

  _f(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  },

  _pesos(n) {
    return '$' + Math.round(n || 0).toLocaleString('es-CO');
  },

  _esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  /** Casilla marcada o vacía, como en el formato impreso. */
  _casilla(marcada, texto) {
    return `<span class="casilla">${marcada ? '☒' : '☐'} ${this._esc(texto)}</span>`;
  },

  _html(r) {
    const tipo = (r.tipo_censo || '').charAt(0);
    const items = (r.items || []).map(i => `
      <tr>
        <td class="c">${i.n_item}</td>
        <td>${this._esc(i.capitulo_nombre)}<br><span class="peq">${this._esc(i.descripcion)}</span></td>
        <td class="c">${this._esc(i.unidad)}</td>
        <td class="d">${Number(i.cantidad).toLocaleString('es-CO', { maximumFractionDigits: 2 })}</td>
        <td class="d">${this._pesos(i.valor_unitario)}</td>
        <td class="d">${this._pesos(i.valor_total)}</td>
      </tr>`).join('');

    // Solo las que traen contenido: los registros almacenados guardan el nombre
    // pero no la imagen, y un <img> sin origen sale como icono roto en el PDF.
    const fotos = (r.fotos || []).filter(f => f.datos).map(f =>
      `<img src="${f.datos}" alt="${this._esc(f.nombre)}">`).join('');

    const ver = r.resultado_verificacion;

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>${this._esc(r.id_radicado)}</title>
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
       font-size: 8.5pt; text-transform: uppercase; width: 16%; }
  .peq { font-size: 8.5pt; color: #555; }
  .casilla { display: inline-block; margin-right: 1.1rem; white-space: nowrap; }
  .total { text-align: right; font-weight: bold; font-size: 11pt; margin: .3rem 0 .8rem;
           border-top: 2px solid #12395f; padding-top: .25rem; }
  .fotos { display: flex; flex-wrap: wrap; gap: .3rem; }
  .fotos img { width: 31%; border: 1px solid #9aa7b3; }
  .firmas { display: flex; gap: 2.5rem; margin-top: 1.4rem; page-break-inside: avoid; }
  .firmas > div { flex: 1; border-top: 1px solid #111; padding-top: .2rem; font-size: 9pt; }
  .rubrica { display: block; height: 46px; width: auto; max-width: 190px;
             object-fit: contain; margin-bottom: .15rem; }
  div.rubrica { height: 46px; }
  .pie { margin-top: 1.2rem; border-top: 1px solid #ccc; padding-top: .3rem;
         font-family: Arial, sans-serif; font-size: 8pt; color: #666; }
  .radicado { float: right; font-family: Arial, sans-serif; font-size: 8.5pt;
              border: 1px solid #12395f; padding: .15rem .45rem; color: #12395f; }
  .aviso { border: 1px solid #c9a227; background: #fdf6e6; padding: .3rem .5rem;
           font-size: 9pt; margin-bottom: .5rem; }
  section { page-break-inside: avoid; }
</style></head><body>

<div class="enc">
  <div class="radicado">${this._esc(r.id_radicado)}</div>
  <div class="ent">GOBERNACIÓN DE CALDAS · SECRETARÍA DE EDUCACIÓN</div>
  <div class="ent" style="font-weight:normal">Dirección de Planeación — Infraestructura Educativa</div>
  <h1>Informe técnico-presupuestal</h1>
  <div class="sub">Reparación de infraestructura educativa afectada por el sismo del 10 de agosto de 2026</div>
</div>

${APP_CONFIG.MODO_PRUEBA ? '<div class="aviso"><b>Documento de prueba.</b> Ejercicio de validación del instrumento; no constituye radicación oficial.</div>' : ''}

<section>
<h2>1. Datos de identificación</h2>
<table class="ident">
  <tr><td>Municipio</td><td>${this._esc(r.municipio)}</td>
      <td>Alcalde</td><td>${this._esc(r.alcalde)}</td></tr>
  <tr><td>Institución educativa</td><td colspan="3">${this._esc(r.institucion)}</td></tr>
  <tr><td>Sede educativa</td><td colspan="3">${this._esc(r.sede)}</td></tr>
  <tr><td>Código DANE</td><td>${this._esc(r.dane_sede)}</td>
      <td>Rector(a)</td><td>${this._esc(r.rector)}</td></tr>
  <tr><td>Zona / Matrícula</td><td>${this._esc(r.zona)} · ${r.matricula} estudiantes</td>
      <td>Contacto</td><td>${this._esc(r.correo)} · ${this._esc(r.celular)}</td></tr>
  <tr><td>Fecha de emisión</td><td>${this._f(r.fecha_radicacion)}</td>
      <td>Versión</td><td>${r.version || 1}</td></tr>
</table>
</section>

<section>
<h2>2. Necesidad y grado de afectación</h2>
<table>
  <tr><td style="width:26%;background:#f6f8fa"><b>Grado de afectación<br><span class="peq">Censo del 27 de agosto de 2026</span></b></td>
      <td>
        ${this._casilla(tipo === '4', 'Afectación menor')}
        ${this._casilla(tipo === '3', 'Afectación estructural / funcional parcial')}<br>
        ${this._casilla(tipo === '2', 'Riesgo inminente de colapso')}
        ${this._casilla(tipo === '1', 'Colapso total / parcial de infraestructura')}
        ${r.nivel_censo ? `<br><span class="peq">Nivel registrado: ${this._esc(r.nivel_censo)}</span>` : ''}
      </td></tr>
  <tr><td style="background:#f6f8fa"><b>Declaración del municipio</b></td>
      <td>${r.declara_afectacion
            ? 'La sede <b>SÍ</b> presenta afectación que requiere inversión.'
            : 'La sede <b>NO</b> presenta afectación que requiera inversión.'}
        ${r.hay_discrepancia ? `<br><span class="peq"><b>Difiere de la clasificación del censo.</b> Justificación: ${this._esc(r.justificacion_discrepancia)}</span>` : ''}
      </td></tr>
</table>

${r.declara_afectacion ? `
<p><b>Descripción de la afectación y necesidad de inversión:</b></p>
<p style="text-align:justify">${this._esc(r.descripcion_afectacion)}</p>
${fotos ? `<p><b>Registro fotográfico:</b></p><div class="fotos">${fotos}</div>` : ''}
` : ''}
</section>

${r.declara_afectacion ? `
<section>
<h2>3. Presupuesto detallado y discriminado</h2>
<table>
  <thead><tr>
    <th style="width:4%">Ítem</th><th>Actividad / descripción</th>
    <th style="width:9%">Unidad</th><th style="width:11%">Cantidad</th>
    <th style="width:15%">Valor unitario</th><th style="width:16%">Valor total</th>
  </tr></thead>
  <tbody>${items}</tbody>
</table>
<div class="total">Valor total requerido para la sede: ${this._pesos(r.costo_directo)}</div>
</section>

<section>
<h2>3.1 Resumen económico</h2>
<table>
  <tr><td style="width:60%">Costo directo</td><td class="d">${this._pesos(r.costo_directo)}</td></tr>
  <tr><td>Administración (${r.pct_admin} %)</td><td class="d">${this._pesos(r.valor_admin)}</td></tr>
  <tr><td>Utilidad (${r.pct_utilidad} %)</td><td class="d">${this._pesos(r.valor_utilidad)}</td></tr>
  <tr><td>IVA ${APP_CONFIG.IVA_SOBRE_UTILIDAD_PCT} % sobre la utilidad
          <span class="peq">(Decreto 1372 de 1992, art. 3)</span></td>
      <td class="d">${this._pesos(r.valor_iva)}</td></tr>
  <tr><td><b>TOTAL PRESUPUESTO</b></td><td class="d"><b>${this._pesos(r.total_presupuesto)}</b></td></tr>
</table>
<div class="total">Valor total requerido para la obra: ${this._pesos(r.total_presupuesto)}</div>
<p class="peq">No se incluyen imprevistos. El presupuesto no contempla interventoría,
estudios y diseños ni demoliciones especializadas.</p>
</section>

<section>
<h2>4. Plazo de ejecución / cronograma de actividades</h2>
<p><b>Plazo total estimado de ejecución:</b> ${r.plazo_dias} días calendario.</p>
${r.actividades ? `<p><b>Actividades previstas:</b></p>
  <p style="white-space:pre-line;text-align:justify">${this._esc(r.actividades)}</p>` : ''}
</section>
` : ''}

<section>
<h2>5. Observaciones de verificación</h2>
<p class="peq" style="text-align:justify">Los presupuestos presentados serán objeto de verificación
previa por parte de la entidad, con el propósito de analizar la correspondencia entre las
actividades y valores presupuestados y las afectaciones previamente notificadas. Este cuadro es
diligenciado por la Secretaría de Educación.</p>
<table>
  <tr><td style="width:40%;background:#f6f8fa"><b>Resultado de la verificación</b></td>
      <td><b>Observaciones / ajustes requeridos</b></td></tr>
  <tr>
    <td>
      ${this._casilla(ver === 'CORRESPONDE', 'Corresponde')}<br>
      ${this._casilla(ver === 'CORRESPONDE_PARCIAL', 'Corresponde parcialmente')}<br>
      ${this._casilla(ver === 'NO_CORRESPONDE', 'No corresponde')}<br>
      ${this._casilla(ver === 'REQUIERE_ACLARACION', 'Requiere aclaración / ajuste')}
    </td>
    <td>${this._esc(r.observaciones_verificacion || '')}</td>
  </tr>
</table>

<div class="firmas">
  <div>
    ${r.firma_municipio && r.firma_municipio.datos
      ? `<img class="rubrica" src="${r.firma_municipio.datos}" alt="">` : '<div class="rubrica"></div>'}
    <b>Por el municipio</b><br>
    ${this._esc(r.alcalde)}<br>
    Alcalde de ${this._esc(r.municipio)}<br>
    <span class="peq">Radicado el ${this._f(r.fecha_radicacion)}</span>
  </div>
  <div>
    ${r.firma_sed && r.firma_sed.datos
      ? `<img class="rubrica" src="${r.firma_sed.datos}" alt="">` : '<div class="rubrica"></div>'}
    <b>Por la Secretaría de Educación</b><br>
    ${this._esc(r.verificador || '')}<br>
    ${r.cedula_verificador ? 'C.C. ' + this._esc(r.cedula_verificador) + '<br>' : ''}
    ${r.fecha_verificacion
      ? `<span class="peq">Verificado el ${this._f(r.fecha_verificacion)}</span>` : ''}
  </div>
</div>
</section>

<div class="pie">
  Radicado ${this._esc(r.id_radicado)} · versión ${r.version || 1} ·
  generado el ${this._f(new Date().toISOString())} ·
  Secretaría de Educación de Caldas — Dirección de Planeación
</div>

</body></html>`;
  }
};
