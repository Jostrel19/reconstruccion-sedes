/**
 * Lectura de sedes, filtrada del lado del servidor según el rol y alcance de
 * la sesión — nunca del lado del navegador (docs/PLAN_DESARROLLO.md §2):
 *
 *   ADMINISTRADOR / VERIFICADOR / CONSULTA -> todo el departamento (D-25 para
 *     Verificador; Administrador y Consulta lo mismo por definición de rol).
 *   RESPONSABLE_SEDE (alcalde) -> alcance == municipio de la sede (D-24).
 *   RESPONSABLE_SEDE (rector)  -> dane_sede está en su lista de alcance (D-24).
 *
 * D-43: el sistema solo lleva lo que se registra en él. `valor_referencia` (la
 * estimación del censo) ya no se envía a NINGÚN rol; en su lugar, cada sede
 * viaja con el resumen de su presupuesto vigente (`presupuesto`, o null si no
 * tiene), para que Tablero, Sedes y Municipio muestren el estado real en vez
 * de un texto fijo. La respuesta trae además `actividad`: los últimos
 * movimientos registrados (radicaciones, borradores, cargas, conceptos) dentro
 * del alcance de la sesión — es la bitácora del Tablero.
 *
 * D-44: cada sede viaja también con `lote` ({id_lote, nombre, activo} o null)
 * y la respuesta trae `lotes` (todos, activos y cerrados), para que Tablero,
 * Sedes y Municipio filtren por lote sin otra petición (Lotes.gs).
 */
var ACTIVIDAD_MAX = 20;

function Sedes_listar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Sedes');
  var datos = hoja.getDataRange().getValues();
  var encabezados = datos[0];
  var idxMunicipio = encabezados.indexOf('municipio');
  var idxDaneSede = encabezados.indexOf('dane_sede');

  var conceptos = _ultimoConceptoPorPresupuesto(ss);
  var vigentes = _resumenVigentesPorDane(ss, conceptos);
  var lotes = _loteDeCadaSede(ss);

  var sedes = [];
  var enAlcance = {};
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var municipio = fila[idxMunicipio];
    var daneSede = String(fila[idxDaneSede]);

    if (!_enAlcance(sesion, municipio, daneSede)) continue;

    var sede = {};
    encabezados.forEach(function (col, j) { sede[col] = fila[j]; });
    delete sede.valor_referencia; // D-43
    sede.presupuesto = vigentes[daneSede] || null;
    sede.lote = lotes.porDane[daneSede] || null;
    sedes.push(sede);
    enAlcance[daneSede] = true;
  }

  // Responsable de sede no tiene Tablero (ni bitácora): no se arma para él.
  var actividad = sesion.rol === 'RESPONSABLE_SEDE' ? [] : _actividadReciente(ss, enAlcance);

  return { ok: true, sedes: sedes, actividad: actividad, lotes: lotes.lotes };
}

function _enAlcance(sesion, municipio, daneSede) {
  if (sesion.rol === 'ADMINISTRADOR' || sesion.rol === 'VERIFICADOR' ||
      sesion.rol === 'CONSULTA') {
    return true;
  }
  // RESPONSABLE_SEDE: alcance es el municipio (alcalde) o una lista
  // "dane1 | dane2 | ..." (rector) — ver tools/exportar_backend.py.
  var alcance = String(sesion.alcance || '');
  if (alcance === municipio) return true;
  var lista = alcance.split('|').map(function (s) { return s.trim(); });
  return lista.indexOf(daneSede) !== -1;
}

// id_presupuesto -> el concepto más reciente emitido sobre esa versión.
function _ultimoConceptoPorPresupuesto(ss) {
  var datos = ss.getSheetByName('Verificaciones').getDataRange().getValues();
  var enc = datos[0];
  var idxId = enc.indexOf('id_presupuesto');
  var idxRes = enc.indexOf('resultado');
  var idxFecha = enc.indexOf('fecha_verificacion');
  var idxQuien = enc.indexOf('verificador_correo');
  var porId = {};
  for (var i = 1; i < datos.length; i++) {
    var id = String(datos[i][idxId]);
    var previo = porId[id];
    if (!previo || new Date(datos[i][idxFecha]) > new Date(previo.fecha)) {
      porId[id] = { resultado: datos[i][idxRes], fecha: datos[i][idxFecha], por: datos[i][idxQuien] };
    }
  }
  return porId;
}

// dane_sede -> resumen de su versión vigente de Presupuestos (solo lectura;
// el versionado real lo sigue decidiendo _presupuestoVigente, D-37).
function _resumenVigentesPorDane(ss, conceptos) {
  var datos = ss.getSheetByName('Presupuestos').getDataRange().getValues();
  var enc = datos[0];
  var col = function (c) { return enc.indexOf(c); };
  var porDane = {};
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    if (f[col('vigente')] !== true) continue;
    var id = String(f[col('id_presupuesto')]);
    var concepto = conceptos[id] || null;
    porDane[String(f[col('dane_sede')])] = {
      id_presupuesto: id,
      version: f[col('version')],
      estado: f[col('estado')],
      origen: f[col('origen')],
      // Cargas lo usa para no ofrecer de nuevo lo ya volcado desde el mismo archivo.
      archivo_origen: f[col('archivo_origen')] || '',
      costo_directo: f[col('costo_directo')],
      total_presupuesto: f[col('total_presupuesto')],
      declara_sin_afectacion: f[col('declara_sin_afectacion')] === true,
      creado_por: f[col('creado_por')],
      fecha_creacion: f[col('fecha_creacion')],
      concepto_resultado: concepto ? concepto.resultado : '',
      fecha_concepto: concepto ? concepto.fecha : ''
    };
  }
  return porDane;
}

// Los últimos movimientos dentro del alcance, más reciente primero. Cada fila
// de Presupuestos es un evento de creación (nunca se sobrescribe, D-37): su
// `estado` actual puede haber cambiado después por un concepto (D-39), así
// que el tipo del evento se deduce de si nació como borrador o no, no del
// estado que tenga hoy.
function _actividadReciente(ss, enAlcance) {
  var eventos = [];

  var datosP = ss.getSheetByName('Presupuestos').getDataRange().getValues();
  var encP = datosP[0];
  var cP = function (c) { return encP.indexOf(c); };
  for (var i = 1; i < datosP.length; i++) {
    var f = datosP[i];
    var dane = String(f[cP('dane_sede')]);
    if (!enAlcance[dane]) continue;
    var tipo = f[cP('estado')] === 'BORRADOR' ? 'BORRADOR'
      : (f[cP('origen')] === 'CARGA' ? 'CARGA' : 'RADICADO');
    eventos.push({
      tipo: tipo, dane_sede: dane, version: f[cP('version')],
      total_presupuesto: f[cP('total_presupuesto')],
      por: f[cP('creado_por')], fecha: f[cP('fecha_creacion')]
    });
  }

  var datosV = ss.getSheetByName('Verificaciones').getDataRange().getValues();
  var encV = datosV[0];
  var cV = function (c) { return encV.indexOf(c); };
  for (var k = 1; k < datosV.length; k++) {
    var v = datosV[k];
    var idP = String(v[cV('id_presupuesto')]);
    var daneV = idP.split('-v')[0]; // id_presupuesto = <dane>-v<version>
    if (!enAlcance[daneV]) continue;
    eventos.push({
      tipo: 'CONCEPTO', dane_sede: daneV, version: idP.split('-v')[1] || '',
      resultado: v[cV('resultado')],
      por: v[cV('verificador_correo')], fecha: v[cV('fecha_verificacion')]
    });
  }

  eventos.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  return eventos.slice(0, ACTIVIDAD_MAX);
}
