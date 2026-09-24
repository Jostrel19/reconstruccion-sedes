/**
 * Discrepancias entre fuentes que no se resuelven por cuenta propia
 * (`CLAUDE.md` de la práctica, §7; `docs/CONFLICTOS_Y_HALLAZGOS.md`). Hasta
 * ahora la pantalla Hallazgos era 100% decorativa: 8 de los 19 hallazgos
 * reales escritos a mano en el HTML, sin backend, con el botón "Marcar
 * resuelto" sin ninguna función detrás. Visible para ADMINISTRADOR y
 * VERIFICADOR (CLAUDE.md §6, nota del módulo Hallazgos) — son quienes pueden
 * confirmar un dato real con el municipio o con Infraestructura.
 */

// D-42: mismos umbrales que el navegador usa solo para pintar un borde rojo
// en el formulario (mockup_v6.html, ALERTA_ADMIN_PCT/ALERTA_UTILIDAD_PCT) —
// se duplican acá porque el backend no puede leer una constante de JS del
// navegador, y la detección tiene que valer también para lo que entra por
// Cargas, que nunca pasa por ese formulario.
var ALERTA_ADMIN_PCT = 12;
var ALERTA_UTILIDAD_PCT = 8;

// Detección automática de discrepancias al radicar (D-42): lo único que se
// automatiza es CREAR la fila abierta, nunca resolverla — eso sigue
// exigiendo que un humano confirme el dato real (Hallazgos_resolver). Vive
// en el mismo lugar que el resto de la lógica de Hallazgos, aunque quien la
// llama es Presupuestos_guardar, para no repartir en dos archivos qué cuenta
// como hallazgo y qué no.
function _detectarHallazgosAutomaticos(sede, daneSede, valoresP, body) {
  var idPresupuesto = valoresP.id_presupuesto;
  var municipio = sede ? sede.municipio : '';

  if (valoresP.pct_admin > ALERTA_ADMIN_PCT || valoresP.pct_utilidad > ALERTA_UTILIDAD_PCT) {
    _agregarHallazgoAuto(idPresupuesto + '-AIU', daneSede, municipio, 'ADVERTENCIA',
      'AIU por encima del umbral de alerta: Administración ' + valoresP.pct_admin + ' % (umbral ' +
      ALERTA_ADMIN_PCT + ' %), Utilidad ' + valoresP.pct_utilidad + ' % (umbral ' + ALERTA_UTILIDAD_PCT +
      ' %). No hay tope legal para el AIU, pero un valor por encima del umbral requiere sustentación del municipio.', idPresupuesto);
  }

  var items = Array.isArray(body.items) ? body.items : [];
  if (valoresP.costo_directo === 0 && items.length > 0) {
    _agregarHallazgoAuto(idPresupuesto + '-COSTO0', daneSede, municipio, 'ADVERTENCIA',
      'Presupuesto radicado con costo directo en $0 (' + items.length + ' ítem(s) con cantidad o valor unitario en cero).',
      idPresupuesto);
  }

  if (valoresP.declara_sin_afectacion && sede && /^[12]\./.test(sede.tipo_censo)) {
    _agregarHallazgoAuto(idPresupuesto + '-CENSO', daneSede, municipio, 'ERROR',
      'Se declaró "sin afectación" sobre una sede que el censo de daños marca como "' +
      sede.tipo_censo + '". Requiere que el municipio confirme la discrepancia.',
      idPresupuesto);
  }

  if (body.origen === 'CARGA' && body.origen_dane === 'propuesto') {
    _agregarHallazgoAuto(idPresupuesto + '-DANEPROP', daneSede, municipio, 'ADVERTENCIA',
      'El DANE de esta sede no venía en el archivo de origen — el lector lo propuso por nombre y quedó ' +
      'confirmado a mano al cargar. Verificar que la sede elegida es la correcta.',
      idPresupuesto);
  }
}

// Una fila por hallazgo detectado — mismo criterio de armar por nombre de
// columna que sembrarHallazgosIniciales(), para no depender del orden de
// columnas de Setup.gs. Segura de re-ejecutar: si ya existe una fila con ese
// mismo id_hallazgo (p. ej. una función que corrió dos veces por un reintento
// de red) no la duplica.
function _agregarHallazgoAuto(idHallazgo, daneSede, origen, severidad, motivo, referencia) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hallazgos');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxId = enc.indexOf('id_hallazgo');
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxId]) === idHallazgo) return;
  }
  var valores = {
    id_hallazgo: idHallazgo, dane_sede: daneSede, origen: origen, severidad: severidad,
    motivo: motivo, referencia: referencia, estado: 'ABIERTO', resuelto_por: '', fecha_resolucion: ''
  };
  hoja.appendRow(enc.map(function (c) { return valores[c]; }));
}

function Hallazgos_listar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR' && sesion.rol !== 'VERIFICADOR') {
    return { ok: false, error: 'Su rol no tiene acceso a Hallazgos' };
  }

  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hallazgos');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var hallazgos = [];
  for (var i = 1; i < datos.length; i++) {
    var obj = {};
    enc.forEach(function (c, j) { obj[c] = datos[i][j]; });
    hallazgos.push(obj);
  }
  return { ok: true, hallazgos: hallazgos };
}

function Hallazgos_resolver(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR' && sesion.rol !== 'VERIFICADOR') {
    return { ok: false, error: 'Su rol no puede marcar hallazgos como resueltos' };
  }

  var idHallazgo = String(body.id_hallazgo || '');
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hallazgos');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxId = enc.indexOf('id_hallazgo');
  var idxEstado = enc.indexOf('estado');
  var idxResueltoPor = enc.indexOf('resuelto_por');
  var idxFechaResolucion = enc.indexOf('fecha_resolucion');

  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxId]) !== idHallazgo) continue;
    var fila = i + 1;
    // Tres celdas dirigidas de la misma fila — mismo patrón que
    // Verificaciones_emitir usa para `estado` en Presupuestos (D-39): nunca
    // se reescribe la fila completa, solo lo que cambia con la resolución.
    hoja.getRange(fila, idxEstado + 1).setValue('RESUELTO');
    hoja.getRange(fila, idxResueltoPor + 1).setValue(sesion.correo);
    hoja.getRange(fila, idxFechaResolucion + 1).setValue(new Date());
    return { ok: true, id_hallazgo: idHallazgo };
  }
  return { ok: false, error: 'No existe ese hallazgo' };
}

/**
 * Semilla de datos real, se corre UNA vez a mano desde el editor de Apps
 * Script (seleccionar sembrarHallazgosIniciales > Ejecutar) — mismo patrón
 * que `crearHojas()` en Setup.gs. Carga los 19 hallazgos reales documentados
 * en `docs/CONFLICTOS_Y_HALLAZGOS.md` (H-1 a H-19, 2026-09-15) en la pestaña
 * `Hallazgos`, que existe desde el Paso 0 pero nunca se llenó.
 *
 * Severidad: ERROR cuando el propio texto del hallazgo dice que bloquea un
 * cruce automático o exige que alguien externo (el municipio, Infraestructura)
 * confirme un dato antes de poder avanzar; ADVERTENCIA cuando es informativo
 * o el hallazgo no impide seguir. Es segura de re-ejecutar: si `Hallazgos` ya
 * tiene filas con estos mismos `id_hallazgo`, no las duplica.
 */
function sembrarHallazgosIniciales() {
  var HALLAZGOS = [
    ['H-1', '', 'AGUADAS', 'ADVERTENCIA',
      'El encabezado del archivo de Aguadas dice "ALCALDÍA MUNICIPAL DE SALAMINA, CALDAS" — plantilla reciclada sin actualizar. No afecta la lectura de los datos.',
      'data/entregas_excel/AGUADAS/PPTO INFRAESTRUCTURA EDUCATIVA...xlsx, hoja MEJORAMIENTO IE, celda B2'],
    ['H-2', '', 'SAN JOSE Y VICTORIA', 'ERROR',
      'San José y Victoria enviaron presupuesto de infraestructura educativa, pero ninguno de los dos aparece en las 37 sedes priorizadas. No se sabe si entran en un lote posterior.',
      'data/insumos/PrimerasPriorizadas.xlsx vs. entregas de SAN JOSE y VICTORIA'],
    ['H-3', '', 'BELALCAZAR', 'ADVERTENCIA',
      'La hoja índice de sedes de Belalcázar no trae código DANE (columna "RUD" vacía en 12 filas). El cruce contra el catálogo tiene que hacerse por nombre de sede, revisado uno por uno.',
      'data/entregas_excel/BELALCAZAR/.../SEDES EDUCATIVAS'],
    ['H-4', '217662002631', 'SAMANA', 'ERROR',
      'ESCUELA BERNARDO OCAMPO HERRERA trae DANE de 14 dígitos (21766200280204) en el archivo de Samaná; según PrimerasPriorizadas.xlsx (orden 33) el DANE correcto es 217662002631. Es una de las 37 priorizadas — bloquea su cruce automático.',
      'data/entregas_excel/SAMANA/PRESUPUESTO ESTIMADO I.E.xlsx F.xlsx, hoja I.E PIO XII, fila 4'],
    ['H-5', '', 'SAMANA', 'ADVERTENCIA',
      'Otros 5 DANE de la misma hoja de Samaná tienen entre 5 y 14 dígitos en vez de 12. Ninguno corresponde a una de las 37 priorizadas, así que no bloquean el lote actual.',
      'Mismo archivo, hoja I.E PIO XII, filas 3, 6, 8, 9, 11'],
    ['H-6', '', 'SAMANA', 'ADVERTENCIA',
      'En vez de un código DANE, la columna trae texto ("fuera de servisio por falta de estudiantes", "NO ES", "NO EST"). Parecen sedes cerradas o inactivas — se dejan fuera del volcado sin interpretar por cuenta propia.',
      'Mismo archivo, hojas I.E FELIX NARANJO (filas 5, 13) y I.E RANCHO LARGO (filas 11, 19)'],
    ['H-7', '', 'AGUADAS', 'ADVERTENCIA',
      'El 24% de las celdas de la hoja "MEJORAMIENTO IE" trae errores de fórmula (#N/A, #REF!) y ninguna de sus 14 sedes tiene total calculable. La hoja buena del mismo libro es "MEJORAMIENTOS".',
      'AGUADAS/PPTO INFRAESTRUCTURA...xlsx, hoja MEJORAMIENTO IE'],
    ['H-8', '', 'ARANZAZU', 'ERROR',
      '5 de las 9 sedes presupuestadas por Aranzazu no existen en fctMaestra con ese nombre (CAMELIA PEQUEÑA, CAMELIA ALTA, LA MESETA, BUENAVISTA, SAN RAFAEL), por $24,7 M. Requiere que Aranzazu identifique el DANE de cada una.',
      'ARANZASU/...JUAN CRISOSTOMO OSORIO.xlsx, hoja PRESUPUESTO'],
    ['H-9', '', 'AGUADAS Y ARANZAZU', 'ADVERTENCIA',
      'Administración al 30% del costo directo (Aguadas también 25% en su hoja rota), muy por encima del umbral de alerta del instrumento (12%) y del doble de la referencia de mercado (10%). No hay tope legal, pero requiere sustentación.',
      'Ambos municipios'],
    ['H-10', '', 'AGUADAS Y ARANZAZU', 'ERROR',
      'Los presupuestos casi no cubren el lote priorizado: Aranzazu presupuestó 9 sedes y solo 1 de sus 4 priorizadas; Aguadas presupuestó 20 y solo 1 de sus 5. Bloquea el lote 1.',
      'Ambos vs. PrimerasPriorizadas.xlsx'],
    ['H-11', '', 'AGUADAS', 'ADVERTENCIA',
      '15 de las 20 sedes de Aguadas tienen presupuesto en $0 (ítems con cantidad cero). Solo 5 sedes traen valores reales, por $44,9 M.',
      'AGUADAS, hoja MEJORAMIENTOS'],
    ['H-12', '217013001145', 'AGUADAS', 'ADVERTENCIA',
      '"SEDE SIETE CUEROS" aparece dos veces, bajo I.E. Encimadas y bajo I.E. El Edén. Ambas cruzan al mismo DANE.',
      'AGUADAS, hoja MEJORAMIENTOS, filas 130 y 147'],
    ['H-13', '', 'AGUADAS', 'ERROR',
      'Dos problemas de nomenclatura: el catálogo escribe "RIOARRIBA" en una palabra y las alcaldías "RIO ARRIBA" (el lector ya lo tolera); y la I.E. Víboral tiene dos sedes que el catálogo deja como principal (217013001111 y 217013000017) — una fila que dice solo "SEDE PRINCIPAL" exige decisión humana.',
      'fctMaestra / catálogo, municipio Aguadas'],
    ['H-14', '', 'AGUADAS Y ARANZAZU', 'ADVERTENCIA',
      'Ningún presupuesto incluye IVA sobre la utilidad. El "COSTO TOTAL DE LA OBRA" de Aranzazu es costo directo + A + I + U, sin IVA — D-5 lo exige (Decreto 1372/1992 art. 3).',
      'Ambos municipios'],
    ['H-15', '', 'BELALCAZAR', 'ERROR',
      'Los nombres de 3 sedes (LA TURQUEZA, VERDUM, GAVIOTAS) no existen en el catálogo de Belalcázar bajo ninguna institución. VERDUM es probablemente "ESCUELA NUEVA VERDUN" pero no se cruza automático sin confirmación oficial.',
      '10 INST - AFECTACION INTERMEDIA/...xlsx, hojas 4. LA TURQUEZA, 5. VERDUM, 8. GAVIOTAS'],
    ['H-16', '', 'BELALCAZAR', 'ERROR',
      '"ESCUELA SAN ISIDRO" es ambiguo: el catálogo tiene dos sedes de la I.E. San Isidro que califican como principal (217088000080 y 217088000535). Requiere decisión humana.',
      'Mismo archivo, hoja 3. ESCUELA SAN ISIDRO'],
    ['H-17', '', 'BELALCAZAR', 'ERROR',
      '"Aulas móviles" no es una sede física con DANE — es mobiliario itinerante. Con presupuesto pero sin sede que lo reciba, no se puede volcar hasta decidir si se excluye o se asigna a una sede anfitriona.',
      'Mismo archivo, hoja 10. AULAS MOVILES'],
    ['H-18', '', 'BELALCAZAR', 'ERROR',
      'Los presupuestos de afectación grave son por INSTITUCIÓN, no por sede (El Águila, El Madroño, San Isidro, Manuela Beltrán). El lector propone la sede principal de cada institución, pero es una inferencia — requiere que Infraestructura confirme el alcance.',
      '4 INST- AFECTACION GRAVE/PPTOS COLEGIOS...xlsm, hoja Presupuesto'],
    ['H-19', '', 'BELALCAZAR', 'ADVERTENCIA',
      'El archivo llama "INSTITUCIÓN EDUCATIVA MANUELA BELTRÁN" a lo que en fctMaestra es una sede (CENTRO DOCENTE MANUELA BELTRAN) de la I.E. Cristo Rey. Cruza igual por nombre de sede — informativo, no bloquea el cruce.',
      'presupuesto cubierta manuela beltran.xlsx, hoja Table 1']
  ];

  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hallazgos');
  var datosExistentes = hoja.getDataRange().getValues();
  var enc = datosExistentes[0];
  var yaExisten = {};
  for (var i = 1; i < datosExistentes.length; i++) yaExisten[String(datosExistentes[i][0])] = true;

  // Se arma por nombre de columna, no por posición — mismo criterio que
  // Presupuestos_guardar y Verificaciones_emitir, para no depender de que el
  // orden de columnas de Setup.gs nunca cambie.
  var filasNuevas = HALLAZGOS
    .filter(function (h) { return !yaExisten[h[0]]; })
    .map(function (h) {
      var valores = {
        id_hallazgo: h[0], dane_sede: h[1], origen: h[2], severidad: h[3],
        motivo: h[4], referencia: h[5], estado: 'ABIERTO', resuelto_por: '', fecha_resolucion: ''
      };
      return enc.map(function (c) { return valores[c]; });
    });

  if (filasNuevas.length === 0) {
    Logger.log('Nada que sembrar — los 19 hallazgos ya están en la hoja.');
    return;
  }
  hoja.getRange(hoja.getLastRow() + 1, 1, filasNuevas.length, filasNuevas[0].length).setValues(filasNuevas);
  Logger.log('Sembrados ' + filasNuevas.length + ' hallazgos nuevos.');
}
