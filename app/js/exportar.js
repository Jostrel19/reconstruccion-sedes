/* app/js/exportar.js — Exportar a Excel (CSV con ; y BOM).
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* ─── Exportar a Excel: CSV con ";" y BOM, que Excel en español abre
     directo con tildes y columnas separadas (formato ya probado en el
     sistema anterior). Se descarga en el equipo de quien lo pide. ─── */
  function descargarCSV(nombre, encabezados, filas){
    const celda = v => {
      const t = v == null ? '' : String(v);
      return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    const texto = '\uFEFF' + [encabezados].concat(filas).map(f => f.map(celda).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const fechaCSV = f => { const d = new Date(f); return f && !isNaN(d) ? d.toLocaleString('sv-SE').slice(0, 16) : ''; };
  const hoyArchivo = () => new Date().toLocaleDateString('sv-SE');
  const slug = t => normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lote';

  const ENC_SEDES_CSV = ['DANE sede', 'Municipio', 'Institución', 'Sede', 'Tipo de afectación (censo)', 'Lote',
    'Estado', 'Versión', 'Origen', 'Total presupuesto', 'Costo directo', 'Fecha de registro', 'Registrado por',
    'Concepto', 'Fecha del concepto', 'Días esperando concepto'];
  function filasSedesCSV(sedes){
    return sedes.map(s => {
      const p = s.presupuesto || {};
      return [s.dane_sede, s.municipio, s.institucion, s.sede, s.tipo_censo, s.lote ? s.lote.nombre : '',
        p.estado ? (ESTADOS_PRESUPUESTO[p.estado] || [0, p.estado])[1] : 'Sin presupuesto', p.version || '',
        p.origen === 'CARGA' ? 'Carga de Excel' : (p.origen ? 'Manual' : ''),
        p.total_presupuesto == null ? '' : p.total_presupuesto, p.costo_directo == null ? '' : p.costo_directo,
        fechaCSV(p.fecha_creacion), p.creado_por || '', RESULTADO_TXT[p.concepto_resultado] || '',
        fechaCSV(p.fecha_concepto), p.estado === 'RADICADO' ? diasDesde(p.fecha_creacion) : ''];
    });
  }

  function exportarVista(){
    if (vista === 'verif'){
      const enc = ['Radicado', 'DANE sede', 'Municipio', 'Sede', 'Tipo de afectación (censo)', 'Estado', 'Versión',
        'Origen', 'Total presupuesto', 'Costo directo', 'Registrado por', 'Fecha de registro', 'Días esperando concepto'];
      const filas = (VERIF || []).map(p => { const s = p.sede_info || {}; return [p.id_presupuesto, p.dane_sede, s.municipio || '',
        nombreSedeCorto(s), s.tipo_censo || '', (ESTADOS_PRESUPUESTO[p.estado] || [0, p.estado])[1], p.version,
        p.origen === 'CARGA' ? 'Carga de Excel' : 'Manual', p.total_presupuesto, p.costo_directo, p.creado_por || '',
        fechaCSV(p.fecha_creacion), p.estado === 'RADICADO' ? diasDesde(p.fecha_creacion) : '']; });
      descargarCSV(`bandeja-verificacion_${hoyArchivo()}.csv`, enc, filas);
      return;
    }
    let sedes = universo(), nombre;
    if (vista === 'muni'){ sedes = sedes.filter(s => s.municipio === muniActual).filter(FILTROS_MUNI[muniFiltro][1]); nombre = slug(muniActual); }
    else {
      const l = LOTES.find(x => x.id_lote === universoSel);
      nombre = (!ROLES[rol].interno ? 'mis-sedes' : 'todas') + (universoSel === 'dano' ? '_con-dano' : '');
      if (l && ROLES[rol].interno) nombre = 'lote_' + slug(l.nombre);
    }
    descargarCSV(`sedes_${nombre}_${hoyArchivo()}.csv`, ENC_SEDES_CSV, filasSedesCSV(sedes));
  }

