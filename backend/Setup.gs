/**
 * Paso 0 del plan (docs/PLAN_DESARROLLO.md): crea las pestañas del backend con
 * las columnas exactas de CLAUDE.md §6 (6 originales + Lotes y LotesSedes, D-44). Se corre UNA vez, a mano, desde el editor
 * de Apps Script (seleccionar crearHojas en el desplegable de funciones > Ejecutar).
 * Es seguro volver a correrla: no borra pestañas que ya tengan datos, solo asegura
 * que existan con el encabezado correcto.
 */
function crearHojas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var esquema = {
    Sedes: ['dane_sede', 'municipio', 'dane_ie', 'institucion', 'sede', 'zona',
            'matricula', 'estado_sede', 'tipo_censo', 'priorizada', 'capitulos_dano',
            'valor_referencia', 'estado_prestacion', 'concepto_tecnico',
            'observaciones_censo'],
    Presupuestos: ['id_presupuesto', 'dane_sede', 'version', 'origen', 'archivo_origen',
            'costo_directo', 'pct_admin', 'pct_utilidad', 'valor_admin', 'valor_utilidad',
            'valor_iva', 'total_presupuesto', 'plazo_dias', 'descripcion_afectacion',
            'declara_sin_afectacion', 'justificacion_discrepancia', 'estado',
            'creado_por', 'fecha_creacion', 'vigente'],
    Items: ['id_presupuesto', 'n_item', 'capitulo', 'descripcion', 'unidad',
            'cantidad', 'valor_unitario', 'valor_total'],
    Verificaciones: ['id_presupuesto', 'resultado', 'observaciones',
            'verificador_correo', 'fecha_verificacion'],
    Usuarios: ['correo', 'nombre', 'rol', 'tipo', 'alcance', 'activo'],
    Hallazgos: ['id_hallazgo', 'dane_sede', 'origen', 'severidad', 'motivo',
            'referencia', 'estado', 'resuelto_por', 'fecha_resolucion'],
    // D-44 (2026-09-24): lotes creados por el Administrador (Lotes.gs)
    Lotes: ['id_lote', 'nombre', 'descripcion', 'creado_por', 'fecha_creacion', 'activo'],
    LotesSedes: ['id_lote', 'dane_sede', 'agregado_por', 'fecha', 'vigente']
  };

  var nombres = Object.keys(esquema);
  nombres.forEach(function (nombre) {
    var hoja = ss.getSheetByName(nombre);
    if (!hoja) hoja = ss.insertSheet(nombre);
    var encabezados = esquema[nombre];
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    hoja.setFrozenRows(1);
  });

  // La hoja "Hoja 1" / "Sheet1" que Google crea por defecto ya no hace falta.
  ['Hoja 1', 'Sheet1'].forEach(function (nombreDefault) {
    var hoja = ss.getSheetByName(nombreDefault);
    if (hoja && ss.getSheets().length > nombres.length) ss.deleteSheet(hoja);
  });

  Logger.log('Pestañas listas: ' + nombres.join(', '));
  Logger.log('Siguiente paso: Archivo > Importar > Subir, elegir backend_sedes.csv, ' +
             '"Reemplazar datos en la hoja actual" con la hoja Sedes seleccionada. ' +
             'Repetir con backend_usuarios.csv sobre Usuarios.');
}
