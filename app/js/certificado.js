/* app/js/certificado.js — Certificación de intervenciones que firma el alcalde (D-48, D-50).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Dos salidas con el mismo texto (D-50, 2026-10-01):
     · Word (.docx), la única que ofrece la pantalla: cada alcaldía pasa el
       contenido a su formato oficial, lo firma, lo escanea y lo carga en PDF.
     · Impresión con el formato de la aplicación, sin botón: la usa un navegador
       que todavía tenga en caché el confirmacion.js anterior, y la pantalla nueva
       si el certificado.js en caché es el anterior. Mismo mecanismo que pdf.js
       (no hay librería de PDF): un iframe oculto que se imprime.
     El texto es el aprobado por la jefatura
     (docs/PROPUESTA para jefatura - Certificado de alcaldes y ajustes al oficio v2.docx);
     D-50 solo cambió la nota final. textosCertificado es la única fuente del texto:
     las dos salidas lo toman de ahí para que no se separen. ─── */

  /* Sin logo ni membrete de la Secretaría (2026-09-30, decisión del usuario): el
     documento lo firma el alcalde y no puede llevar el membrete de otra entidad.
     precargarLogoCertificado queda vacía a propósito: un navegador con el
     confirmacion.js anterior en caché todavía la llama, y sin ella la pantalla
     del alcalde fallaría. */
  function precargarLogoCertificado(){ return Promise.resolve(null); }

  const CERT_COLUMNAS = ['N.º', 'Código DANE sede', 'Institución educativa', 'Sede', 'Nivel de afectación',
    '¿Intervención?', 'Quién interviene', 'Nombre de quién interviene', 'Estado'];
  const CERT_ANCHOS = [3.5, 9.5, 18, 17.5, 13.5, 9, 10.5, 11, 7.5]; // % del ancho de la tabla
  const CERT_CENTRADAS = [0, 5];                                     // N.º y ¿Intervención?

  function textosCertificado(cert, sedes, m){
    const muni = cert.municipio;
    const n = sedes.length;
    const pe = (m && m.por_estado_obra) || {};
    const con = m ? m.con_intervencion : sedes.filter(s => s.respuesta && s.respuesta.tiene_intervencion === CONF_SI).length;
    const guion = v => v ? String(v) : '—';
    return {
      titulo: 'CERTIFICACIÓN DE INTERVENCIONES EN SEDES EDUCATIVAS OFICIALES',
      municipio: `Municipio de ${muni} — Departamento de Caldas`,
      parrafos: [
        `El suscrito Alcalde Municipal de ${muni} certifica que la información relacionada en este documento, registrada ` +
        `en la aplicación de la Secretaría de Educación Departamental de Caldas en atención a su oficio del ` +
        `${CONFIRMACION_FECHA_OFICIO}, corresponde a la situación actual de las ${n} sedes educativas oficiales del ` +
        `municipio en cuanto a las intervenciones terminadas o en proceso para atender los daños causados por el sismo del ` +
        `10 de agosto de 2026.`,
        'El nivel de afectación de cada sede es el registrado por la Unidad de Planeación de la Secretaría y se incluye ' +
        'como referencia; no hace parte de lo que se certifica.',
      ],
      resumen: `Resumen: ${n} sedes · ${con} con intervención (Planeación ${pe['Planeación'] || 0} · Contratación ` +
        `${pe['Contratación'] || 0} · Ejecución ${pe['Ejecución'] || 0} · Terminada ${pe['Terminada'] || 0}) · ${n - con} sin intervención.`,
      // Va como fila de encabezado de la tabla, no como pie de página: se repite en
      // cada página y, en el Word, viaja con la tabla al formato de la alcaldía.
      encabezadoTabla: `Municipio de ${muni} · Código de verificación ${cert.codigo_verificacion}`,
      filas: sedes.map((s, i) => {
        const r = s.respuesta || {};
        const si = r.tiene_intervencion === CONF_SI;
        return [String(i + 1), s.dane_sede, s.institucion, s.sede, nivelTexto(s), guion(r.tiene_intervencion),
          si ? guion(r.quien_interviene) : '—', si ? guion(r.nombre_quien_interviene) : '—', si ? guion(r.estado_obra) : '—'];
      }),
      firma: { linea: '______________________________________', nombre: cert.alcalde,
        resto: ['C.C. ______________________', `Alcalde Municipal de ${muni}`, 'Fecha de firma: ____ / ____ / ________'] },
      nota: 'Este documento lo genera la aplicación con la información registrada. Puede trasladarse al formato oficial ' +
        'de la alcaldía sin modificar su contenido, conservando la tabla completa y el código de verificación. Debe ' +
        'firmarse y cargarse en la aplicación como un solo PDF con todas sus páginas. Si después de generarlo se modifica ' +
        'cualquier dato, este documento deja de ser válido: el código de verificación cambia y se debe generar y cargar uno nuevo.',
      codigo: cert.codigo_verificacion,
      generado: new Date(cert.fecha).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }),
    };
  }

  /* ─── Word ─── */

  const nombreArchivoWord = cert => `Certificación de sedes ${cert.municipio} ${cert.codigo_verificacion}.docx`;

  function descargarCertificadoWord(cert, sedes, m){
    const url = URL.createObjectURL(new Blob([docxCertificado(cert, sedes, m)],
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    const a = document.createElement('a');
    a.href = url; a.download = nombreArchivoWord(cert);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* Un .docx es un ZIP con XML (Office Open XML). Se arma a mano, sin librería
     (regla del proyecto: sin dependencias). Lleva lo mínimo que Word, LibreOffice
     y Google Docs necesitan para abrirlo: tipos, relaciones, estilos y documento.
     Sin pie de página: no viaja al copiar el contenido a otro documento; el código
     va en la fila de encabezado de la tabla, que Word repite en cada página. */
  function docxCertificado(cert, sedes, m){
    const t = textosCertificado(cert, sedes, m);
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const R = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    // Carta horizontal con las márgenes de la impresión (1,1 cm arriba, 1,4 cm el resto), en veinteavos de punto.
    const ANCHO_UTIL = 15840 - 2 * 794;

    const body = [
      wParrafo(t.titulo, { centro: true, negrita: true, tam: 12, despues: 0 }),
      wParrafo(t.municipio, { centro: true, tam: 10, despues: 10 }),
      ...t.parrafos.map(p => wParrafo(p, { justificado: true })),
      wParrafo(t.resumen, { justificado: true, negrita: true, tam: 9 }),
      wTablaCertificado(t, ANCHO_UTIL),
      wParrafo(t.firma.linea, { antes: 40, despues: 0, conSiguiente: true }),
      wParrafo(t.firma.nombre, { negrita: true, despues: 0, conSiguiente: true }),
      ...t.firma.resto.map((l, i, a) => wParrafo(l, { despues: 0, conSiguiente: i < a.length - 1 })),
      wParrafo(t.nota, { justificado: true, cursiva: true, tam: 8, antes: 12 }),
      wParrafo([['Código de verificación: '], [t.codigo, { negrita: true }], [' · Generado por la aplicación el ' + t.generado]],
        { tam: 8, color: '555555' }),
    ].join('');

    const documento = `${XML}<w:document xmlns:w="${W}"><w:body>${body}<w:sectPr>` +
      '<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>' +
      '<w:pgMar w:top="624" w:right="794" w:bottom="794" w:left="794" w:header="397" w:footer="397" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
    // Arial 9,5 y español de Colombia por defecto. La tabla lleva su tamaño en cada
    // celda, así que no crece si al pegarla el formato de la alcaldía usa otra letra.
    const estilos = `${XML}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>` +
      '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="19"/><w:szCs w:val="19"/>' +
      '<w:lang w:val="es-CO" w:eastAsia="es-CO" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr>' +
      '<w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
      '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
    const tipos = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>';
    const relaciones = `${XML}<Relationships xmlns="${R}"><Relationship Id="rId1" ` +
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const relacionesDoc = `${XML}<Relationships xmlns="${R}"><Relationship Id="rId1" ` +
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

    const utf8 = new TextEncoder();
    return zipSinComprimir([
      ['[Content_Types].xml', tipos], ['_rels/.rels', relaciones],
      ['word/document.xml', documento], ['word/_rels/document.xml.rels', relacionesDoc], ['word/styles.xml', estilos],
    ].map(([nombre, xml]) => ({ nombre, datos: utf8.encode(xml) })));
  }

  // Texto para XML: escapa y quita los caracteres de control que XML no admite.
  const xmlTexto = v => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* Un párrafo de Word. contenido: texto, o lista de tramos [texto, {negrita}].
     o: centro, justificado, negrita, cursiva, tam (pt), color, antes y despues
     (pt; despues por defecto 6) y conSiguiente (no separarlo del que sigue). */
  function wParrafo(contenido, o = {}){
    const tramos = Array.isArray(contenido) ? contenido : [[contenido]];
    const ppr = (o.conSiguiente ? '<w:keepNext/>' : '') +
      `<w:spacing w:before="${(o.antes || 0) * 20}" w:after="${(o.despues === undefined ? 6 : o.despues) * 20}"/>` +
      (o.centro ? '<w:jc w:val="center"/>' : (o.justificado ? '<w:jc w:val="both"/>' : ''));
    return `<w:p><w:pPr>${ppr}</w:pPr>${tramos.map(([texto, ot]) => wTramo(texto, Object.assign({}, o, ot))).join('')}</w:p>`;
  }

  function wTramo(texto, o){
    const mp = o.tam ? Math.round(o.tam * 2) : 0; // Word mide la letra en medios puntos
    const rpr = (o.negrita ? '<w:b/>' : '') + (o.cursiva ? '<w:i/>' : '') + (o.color ? `<w:color w:val="${o.color}"/>` : '') +
      (mp ? `<w:sz w:val="${mp}"/><w:szCs w:val="${mp}"/>` : '');
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlTexto(texto)}</w:t></w:r>`;
  }

  /* La tabla mide el 100 % del ancho útil y cada columna un porcentaje: al pegarla
     en el formato de la alcaldía se ajusta a sus márgenes y orientación. Las dos
     primeras filas (código y títulos) se repiten en cada página y ninguna fila se
     parte entre dos páginas. */
  function wTablaCertificado(t, anchoUtil){
    const borde = l => `<w:${l} w:val="single" w:sz="4" w:space="0" w:color="8A9396"/>`;
    const celda = (texto, o) => `<w:tc><w:tcPr><w:tcW w:w="${Math.round(o.pct * 50)}" w:type="pct"/>` +
      (o.span ? `<w:gridSpan w:val="${o.span}"/>` : '') +
      (o.sinBordes ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:right w:val="nil"/></w:tcBorders>' : '') +
      (o.fondo ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fondo}"/>` : '') +
      `</w:tcPr>${wParrafo(texto, { tam: 7.5, despues: 0, negrita: o.negrita, centro: o.centro, color: o.color })}</w:tc>`;
    const fila = (celdas, encabezado) => `<w:tr><w:trPr><w:cantSplit/>${encabezado ? '<w:tblHeader/>' : ''}</w:trPr>${celdas}</w:tr>`;

    const filaCodigo = fila(celda(t.encabezadoTabla, { pct: 100, span: CERT_COLUMNAS.length, sinBordes: true, color: '444444' }), true);
    const filaTitulos = fila(CERT_COLUMNAS.map((c, i) => celda(c, { pct: CERT_ANCHOS[i], negrita: true, fondo: 'E8ECEA' })).join(''), true);
    const filas = t.filas.map(f => fila(f.map((v, i) => celda(v, { pct: CERT_ANCHOS[i], centro: CERT_CENTRADAS.includes(i) })).join(''), false));

    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borde).join('') + '</w:tblBorders>' +
      '<w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar>' +
      '<w:tblLook w:val="04A0"/></w:tblPr>' +
      `<w:tblGrid>${CERT_ANCHOS.map(p => `<w:gridCol w:w="${Math.round(anchoUtil * p / 100)}"/>`).join('')}</w:tblGrid>` +
      filaCodigo + filaTitulos + filas.join('') + '</w:tbl>' +
      wParrafo('', { despues: 0 }); // Word exige un párrafo entre la tabla y lo que sigue
  }

  /* ZIP sin compresión (método «stored»): Word lo abre igual y no hace falta
     ninguna librería. archivos: [{nombre, datos: Uint8Array}]. */
  const CRC32_TABLA = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC32_TABLA[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  function zipSinComprimir(archivos){
    const ahora = new Date();
    const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
    const utf8 = new TextEncoder();
    const locales = [], central = [];
    let desplazamiento = 0;
    archivos.forEach(a => {
      const nombre = utf8.encode(a.nombre), crc = crc32(a.datos), n = a.datos.length;
      const loc = new DataView(new ArrayBuffer(30));
      loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true);
      loc.setUint16(10, hora, true); loc.setUint16(12, fecha, true); loc.setUint32(14, crc, true);
      loc.setUint32(18, n, true); loc.setUint32(22, n, true); loc.setUint16(26, nombre.length, true);
      locales.push(new Uint8Array(loc.buffer), nombre, a.datos);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true);
      cen.setUint16(12, hora, true); cen.setUint16(14, fecha, true); cen.setUint32(16, crc, true);
      cen.setUint32(20, n, true); cen.setUint32(24, n, true); cen.setUint16(28, nombre.length, true);
      cen.setUint32(42, desplazamiento, true);
      central.push(new Uint8Array(cen.buffer), nombre);
      desplazamiento += 30 + nombre.length + n;
    });
    const tamCentral = central.reduce((s, p) => s + p.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplazamiento, true);
    const partes = locales.concat(central, [new Uint8Array(fin.buffer)]);
    const salida = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
    let o = 0;
    partes.forEach(p => { salida.set(p, o); o += p.length; });
    return salida;
  }

  /* ─── Impresión con el formato de la aplicación ─── */

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
    const t = textosCertificado(cert, sedes, m);
    const cssTexto = x => '"' + String(x).replace(/["\\]/g, '\\$&') + '"';
    const clase = i => CERT_CENTRADAS.includes(i) ? ' class="c"' : (i === 1 ? ' class="mono"' : '');
    const filas = t.filas.map(f => `<tr>${f.map((v, i) => `<td${clase(i)}>${esc(v)}</td>`).join('')}</tr>`).join('\n');

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

<h1>${esc(t.titulo)}</h1>
<div class="muni">${esc(t.municipio)}</div>

${t.parrafos.map(p => `<p>${esc(p)}</p>`).join('\n')}
<p class="res">${esc(t.resumen)}</p>

<table>
  <colgroup>${CERT_ANCHOS.map(p => `<col style="width:${p}%">`).join('')}</colgroup>
  <thead>
    <tr class="cod"><th colspan="${CERT_COLUMNAS.length}">${esc(t.encabezadoTabla)}</th></tr>
    <tr>${CERT_COLUMNAS.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
  </thead>
  <tbody>${filas}</tbody>
</table>

<div class="firma">
  <div class="linea">${esc(t.firma.linea)}</div>
  <div><b>${esc(t.firma.nombre)}</b></div>
  ${t.firma.resto.map(l => `<div>${esc(l)}</div>`).join('\n  ')}
</div>

<p class="nota">${esc(t.nota)}</p>
<p class="cod">Código de verificación: <b>${esc(t.codigo)}</b> · Generado por la aplicación el ${esc(t.generado)}</p>

</body></html>`;
  }
