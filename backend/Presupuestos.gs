/**
 * Paso 3: registro manual de presupuesto (D-29, D-33). Sirve tanto para
 * "Guardar borrador" como para "Radicar presupuesto" — mismo camino, distinto
 * `estado` en el body. Nunca se sobrescribe una fila existente (D-37): cada
 * guardado agrega una fila NUEVA a `Presupuestos` con `version` + 1 y solo
 * apaga `vigente` en la fila anterior — el histórico completo queda
 * disponible siempre. Los totales (costo directo, A, U, IVA) los calcula el
 * servidor a partir de los ítems que llegan, nunca se toma el total que
 * mande el navegador tal cual.
 */

function Presupuestos_obtener(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };

  var daneSede = String(body.dane_sede || '');
  var sede = _sedeDelCatalogo(daneSede);
  if (!sede) return { ok: false, error: 'DANE no existe en el catálogo' };
  if (!_enAlcance(sesion, sede.municipio, daneSede)) return { ok: false, error: 'Sede fuera de su alcance' };

  var vigente = _presupuestoVigente(daneSede);
  if (!vigente) return { ok: true, presupuesto: null, items: [], historial: [] };

  return {
    ok: true, presupuesto: vigente.datos, items: _itemsDe(vigente.datos.id_presupuesto),
    // Todas las versiones (D-37 solo sirve si el histórico se puede CONSULTAR,
    // no solo guardar) — la Ficha las lista todas, no solo la vigente.
    historial: _historialDe(daneSede),
    // Concepto de verificación de la versión vigente, o null si nadie lo ha
    // emitido todavía — sección 5 de la Ficha en modo lectura (D-30).
    verificacion: _verificacionDe(vigente.datos.id_presupuesto)
  };
}

function Presupuestos_guardar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  var origen = body.origen === 'CARGA' ? 'CARGA' : 'MANUAL';
  // MANUAL: quien diligencia a mano (alcalde/rector) o el Administrador de prueba.
  // CARGA: el arquitecto, subiendo lo que ya leyó tools/ingesta*.py (Paso 5,
  // D-33/D-23) — el Verificador nunca diligencia a mano (tabla de roles),
  // pero sí carga masivamente lo que el municipio ya mandó en Excel.
  var puede = sesion.rol === 'ADMINISTRADOR' ||
    (origen === 'MANUAL' && sesion.rol === 'RESPONSABLE_SEDE') ||
    (origen === 'CARGA' && sesion.rol === 'VERIFICADOR');
  if (!puede) return { ok: false, error: 'Su rol no puede registrar presupuesto por esta vía' };

  var daneSede = String(body.dane_sede || '');
  var sede = _sedeDelCatalogo(daneSede);
  if (!sede) return { ok: false, error: 'DANE no existe en el catálogo' };
  if (!_enAlcance(sesion, sede.municipio, daneSede)) return { ok: false, error: 'Sede fuera de su alcance' };

  var estado = body.estado === 'RADICADO' ? 'RADICADO' : 'BORRADOR';
  var declaraSinAfectacion = !!body.declara_sin_afectacion;
  var items = Array.isArray(body.items) ? body.items : [];
  if (estado === 'RADICADO' && items.length === 0 && !declaraSinAfectacion) {
    return { ok: false, error: 'Un presupuesto radicado necesita al menos un ítem, o declarar sin afectación' };
  }
  // La misma regla de longitud mínima que ya exige el navegador (mockup_v6.html,
  // guardarRegistroPresupuesto) — repetida acá porque cualquiera con un token
  // válido puede llamar esta acción directo, sin pasar por el formulario.
  if (estado === 'RADICADO' && origen === 'MANUAL') {
    var descripcion = String(body.descripcion_afectacion || '');
    var justificacion = String(body.justificacion_discrepancia || '');
    if (declaraSinAfectacion && justificacion.length < 40) {
      return { ok: false, error: 'La justificación de "no presenta afectación" necesita mínimo 40 caracteres' };
    }
    if (!declaraSinAfectacion && descripcion.length < 60) {
      return { ok: false, error: 'La descripción de los daños necesita mínimo 60 caracteres' };
    }
  }

  var costoDirecto = 0;
  items.forEach(function (it) {
    costoDirecto += (Number(it.cantidad) || 0) * (Number(it.valor_unitario) || 0);
  });
  var pctAdmin = Number(body.pct_admin) || 0;
  var pctUtilidad = Number(body.pct_utilidad) || 0;
  var valorAdmin = Math.round(costoDirecto * pctAdmin / 100);
  var valorUtilidad = Math.round(costoDirecto * pctUtilidad / 100);
  var valorIva = Math.round(valorUtilidad * 0.19); // Decreto 1372/1992 art. 3 — IVA sobre la utilidad (D-5)
  var total = costoDirecto + valorAdmin + valorUtilidad + valorIva;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaP = ss.getSheetByName('Presupuestos');
  var encP = hojaP.getRange(1, 1, 1, hojaP.getLastColumn()).getValues()[0];

  var actual = _presupuestoVigente(daneSede);
  var nuevaVersion = actual ? Number(actual.datos.version) + 1 : 1;
  if (actual) {
    // Única escritura sobre una fila existente que este backend hace jamás:
    // apagar `vigente`. El resto de la fila (los datos) no se toca (D-37).
    hojaP.getRange(actual.fila, encP.indexOf('vigente') + 1).setValue(false);
  }

  var idPresupuesto = daneSede + '-v' + nuevaVersion;
  var valoresP = {
    id_presupuesto: idPresupuesto, dane_sede: daneSede, version: nuevaVersion,
    origen: origen, archivo_origen: origen === 'CARGA' ? String(body.archivo_origen || '') : '',
    costo_directo: costoDirecto,
    pct_admin: pctAdmin, pct_utilidad: pctUtilidad, valor_admin: valorAdmin,
    valor_utilidad: valorUtilidad, valor_iva: valorIva, total_presupuesto: total,
    plazo_dias: Number(body.plazo_dias) || 0,
    descripcion_afectacion: body.descripcion_afectacion || '',
    declara_sin_afectacion: declaraSinAfectacion,
    justificacion_discrepancia: body.justificacion_discrepancia || '',
    estado: estado, creado_por: sesion.correo, fecha_creacion: new Date(), vigente: true
  };
  hojaP.appendRow(encP.map(function (c) { return valoresP[c]; }));

  var hojaI = ss.getSheetByName('Items');
  var encI = hojaI.getRange(1, 1, 1, hojaI.getLastColumn()).getValues()[0];
  items.forEach(function (it, i) {
    var valoresI = {
      id_presupuesto: idPresupuesto, n_item: i + 1, capitulo: it.capitulo || '',
      descripcion: it.descripcion || '', unidad: it.unidad || '',
      cantidad: Number(it.cantidad) || 0, valor_unitario: Number(it.valor_unitario) || 0,
      valor_total: (Number(it.cantidad) || 0) * (Number(it.valor_unitario) || 0)
    };
    hojaI.appendRow(encI.map(function (c) { return valoresI[c]; }));
  });

  return {
    ok: true, id_presupuesto: idPresupuesto, version: nuevaVersion, estado: estado,
    costo_directo: costoDirecto, valor_admin: valorAdmin, valor_utilidad: valorUtilidad,
    valor_iva: valorIva, total_presupuesto: total
  };
}

function _sedeDelCatalogo(daneSede) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sedes');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxDane = enc.indexOf('dane_sede');
  var idxMuni = enc.indexOf('municipio');
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxDane]) === daneSede) return { municipio: datos[i][idxMuni] };
  }
  return null;
}

// La fila vigente (la única sin reemplazar) de un DANE, o null. `fila` es el
// número de fila real de la hoja (1-based, cuenta el encabezado) — es lo que
// permite apagar su `vigente` sin releer ni tocar ninguna otra celda.
function _presupuestoVigente(daneSede) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Presupuestos');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxDane = enc.indexOf('dane_sede');
  var idxVigente = enc.indexOf('vigente');
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxDane]) === daneSede && datos[i][idxVigente] === true) {
      var obj = {};
      enc.forEach(function (c, j) { obj[c] = datos[i][j]; });
      return { fila: i + 1, datos: obj };
    }
  }
  return null;
}

// Todas las versiones de un DANE (vigente + históricas), más nueva primero.
// Usada solo para lectura (Presupuestos_obtener) — el versionado real (D-37)
// lo sigue decidiendo _presupuestoVigente, esto no cambia esa lógica.
function _historialDe(daneSede) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Presupuestos');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxDane = enc.indexOf('dane_sede');
  var historial = [];
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxDane]) === daneSede) {
      var obj = {};
      enc.forEach(function (c, j) { obj[c] = datos[i][j]; });
      historial.push(obj);
    }
  }
  historial.sort(function (a, b) { return Number(b.version) - Number(a.version); });
  return historial;
}

function _itemsDe(idPresupuesto) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Items');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxId = enc.indexOf('id_presupuesto');
  var items = [];
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxId]) === String(idPresupuesto)) {
      var obj = {};
      enc.forEach(function (c, j) { obj[c] = datos[i][j]; });
      items.push(obj);
    }
  }
  return items;
}
