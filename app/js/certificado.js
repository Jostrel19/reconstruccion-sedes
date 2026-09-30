/* app/js/certificado.js — Certificación de intervenciones que firma el alcalde (D-48).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Mismo mecanismo que pdf.js (no hay librería de PDF): el documento se
     arma en un iframe oculto y se imprime; «Guardar como PDF» lo hace el propio
     diálogo del navegador. El texto es el aprobado por la jefatura
     (docs/PROPUESTA para jefatura - Certificado de alcaldes y ajustes al oficio v2.docx):
     no se le agrega nada. Carta horizontal, con las páginas que haga falta. ─── */

  /* Sin logo ni membrete de la Secretaría (2026-09-30, decisión del usuario): el
     documento lo firma el alcalde y no puede llevar el membrete de otra entidad.
     precargarLogoCertificado queda vacía a propósito: un navegador con el
     confirmacion.js anterior en caché todavía la llama, y sin ella la pantalla
     del alcalde fallaría. */
  function precargarLogoCertificado(){ return Promise.resolve(null); }

  // Nombre que propone el navegador al «Guardar como PDF» (Chrome y Edge toman
  // el título de la página) y que sale en el encabezado de impresión.
  const nombreArchivoCertificado = cert => `Confirmación de sedes — Reconstrucción de sedes ${cert.municipio}`;

  async function imprimirCertificado(cert, sedes, m){
    const previo = document.getElementById('marcoCertificado');
    if (previo) previo.remove();
    const marco = document.createElement('iframe');
    marco.id = 'marcoCertificado';
    marco.title = 'Certificación para imprimir';
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(marco);
    const doc = marco.contentDocument;
    doc.open();
    doc.write(htmlCertificado(cert, sedes, m));
    doc.close();
    // Se imprime cuando las imágenes del documento están listas (hoy no lleva
    // ninguna); si tarda más de 4 segundos, igual.
    const nombre = nombreArchivoCertificado(cert);
    const tituloAntes = document.title;
    const restaurar = () => { if (document.title === nombre) document.title = tituloAntes; };
    let impreso = false;
    const imprimir = () => {
      if (impreso) return; impreso = true;
      document.title = nombre;
      marco.contentWindow.addEventListener('afterprint', restaurar);
      marco.contentWindow.focus(); marco.contentWindow.print();
      setTimeout(restaurar, 60 * 1000); // por si el navegador no avisa al cerrar el diálogo
    };
    Promise.all([...doc.images].map(img => img.complete ? null : new Promise(res => { img.onload = img.onerror = res; })))
      .then(() => setTimeout(imprimir, 50));
    setTimeout(imprimir, 4000);
  }

  function htmlCertificado(cert, sedes, m){
    const muni = esc(cert.municipio);
    const n = sedes.length;
    const pe = (m && m.por_estado_obra) || {};
    const con = m ? m.con_intervencion : sedes.filter(s => s.respuesta && s.respuesta.tiene_intervencion === CONF_SI).length;
    const sin = n - con;
    const codigo = esc(cert.codigo_verificacion);
    const generado = new Date(cert.fecha).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
    const cssTexto = t => '"' + String(t).replace(/["\\]/g, '\\$&') + '"';
    const guion = v => v ? esc(v) : '—';
    const filas = sedes.map((s, i) => {
      const r = s.respuesta || {};
      const si = r.tiene_intervencion === CONF_SI;
      return `<tr><td class="c">${i + 1}</td><td class="mono">${esc(s.dane_sede)}</td><td>${esc(s.institucion)}</td>
        <td>${esc(s.sede)}</td><td>${esc(nivelTexto(s))}</td><td class="c">${guion(r.tiene_intervencion)}</td>
        <td>${si ? guion(r.quien_interviene) : '—'}</td><td>${si ? guion(r.nombre_quien_interviene) : '—'}</td>
        <td>${si ? guion(r.estado_obra) : '—'}</td></tr>`;
    }).join('');

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>${esc(nombreArchivoCertificado(cert))}</title>
<style>
  @page { size: letter landscape; margin: 1.1cm 1.4cm 1.4cm;
    @bottom-center { content: ${cssTexto('Código de verificación: ' + cert.codigo_verificacion + ' · Municipio de ' + cert.municipio + ' · Página ')} counter(page) " de " counter(pages);
      font-family: Arial, sans-serif; font-size: 8pt; color: #555; } }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; margin: 0; line-height: 1.4; }
  h1 { font-size: 12pt; text-align: center; margin: 0; }
  .muni { text-align: center; font-size: 10pt; margin: .1cm 0 .35cm; }
  p { margin: 0 0 .22cm; text-align: justify; }
  .res { font-size: 9pt; font-weight: bold; }
  table { width: calc(100% - 1px); border-collapse: collapse; table-layout: fixed; margin: .15cm 0 .3cm; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #8a9396; padding: 1.5pt 3pt; font-size: 7.5pt; line-height: 1.25; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
  th { background: #E8ECEA; font-weight: bold; overflow-wrap: normal; }
  thead tr.cod th { background: #fff; border: none; border-bottom: 1px solid #8a9396; font-weight: normal; color: #444; padding: 0 0 2pt; }
  td.c { text-align: center; }
  .mono { font-variant-numeric: tabular-nums; }
  .firma { page-break-inside: avoid; margin-top: .6cm; line-height: 1.5; }
  .firma .linea { margin-top: .9cm; }
  .nota { font-size: 8pt; font-style: italic; margin-top: .4cm; }
  .cod { font-size: 8pt; color: #555; }
</style></head><body>

<h1>CERTIFICACIÓN DE INTERVENCIONES EN SEDES EDUCATIVAS OFICIALES</h1>
<div class="muni">Municipio de ${muni} — Departamento de Caldas</div>

<p>El suscrito Alcalde Municipal de ${muni} certifica que la información relacionada en este documento, registrada
en la aplicación de la Secretaría de Educación Departamental de Caldas en atención a su oficio del
${esc(CONFIRMACION_FECHA_OFICIO)}, corresponde a la situación actual de las ${n} sedes educativas oficiales del
municipio en cuanto a las intervenciones terminadas o en proceso para atender los daños causados por el sismo del
10 de agosto de 2026.</p>
<p>El nivel de afectación de cada sede es el registrado por la Unidad de Planeación de la Secretaría y se incluye
como referencia; no hace parte de lo que se certifica.</p>
<p class="res">Resumen: ${n} sedes · ${con} con intervención (Planeación ${pe['Planeación'] || 0} · Contratación
${pe['Contratación'] || 0} · Ejecución ${pe['Ejecución'] || 0} · Terminada ${pe['Terminada'] || 0}) · ${sin} sin intervención.</p>

<table>
  <colgroup><col style="width:3.5%"><col style="width:9.5%"><col style="width:18%"><col style="width:17.5%"><col style="width:13.5%">
    <col style="width:9%"><col style="width:10.5%"><col style="width:11%"><col style="width:7.5%"></colgroup>
  <thead>
    <tr class="cod"><th colspan="9">Municipio de ${muni} · Código de verificación ${codigo}</th></tr>
    <tr><th>N.º</th><th>Código DANE sede</th><th>Institución educativa</th><th>Sede</th><th>Nivel de afectación</th>
      <th>¿Intervención?</th><th>Quién interviene</th><th>Nombre de quién interviene</th><th>Estado</th></tr>
  </thead>
  <tbody>${filas}</tbody>
</table>

<div class="firma">
  <div class="linea">______________________________________</div>
  <div><b>${esc(cert.alcalde)}</b></div>
  <div>C.C. ______________________</div>
  <div>Alcalde Municipal de ${muni}</div>
  <div>Fecha de firma: ____ / ____ / ________</div>
</div>

<p class="nota">Este documento lo genera la aplicación con la información registrada. Debe firmarse y cargarse en la
aplicación como un solo PDF con todas sus páginas. Si después de generarlo se modifica cualquier dato, este documento
deja de ser válido: el código de verificación cambia y se debe generar y cargar uno nuevo.</p>
<p class="cod">Código de verificación: <b>${codigo}</b> · Generado por la aplicación el ${esc(generado)}</p>

</body></html>`;
  }
