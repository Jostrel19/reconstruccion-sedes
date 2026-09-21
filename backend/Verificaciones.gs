/**
 * Paso 4: verificación técnica (D-21, D-22, D-30). El Verificador (o el
 * Administrador) trabaja por BANDEJA, no sede por sede — ve todo lo radicado
 * en el departamento y emite un concepto. La "firma" es el registro de
 * auditoría de la sesión (D-21): quién, con qué cuenta institucional y
 * cuándo — no una imagen ni una cédula digitada.
 *
 * Reutiliza `_presupuestoVigente`/`_itemsDe` de Presupuestos.gs y
 * `verificarToken` de Auth.gs: Apps Script concatena todos los .gs del
 * proyecto en un solo ámbito global, así que no hace falta importar nada.
 */

var RESULTADOS_VERIFICACION = ['CORRESPONDE', 'CORRESPONDE_PARCIAL', 'NO_CORRESPONDE'];

// D-22 (provisional, mientras Planeación responde Q-7): solo "corresponde"
// aprueba hacia obra; lo demás pide ajuste. El dato crudo de `resultado`
// queda siempre en `Verificaciones` tal como lo marcó el arquitecto — esta
// tabla solo decide a qué `estado` empuja la fila vigente de `Presupuestos`,
// y cambia sola el día que esa regla se confirme distinta.
var ESTADO_SEGUN_RESULTADO = {
  CORRESPONDE: 'APROBADO',
  CORRESPONDE_PARCIAL: 'REQUIERE_AJUSTE',
  NO_CORRESPONDE: 'REQUIERE_AJUSTE'
};

function Verificaciones_bandeja(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'VERIFICADOR' && sesion.rol !== 'ADMINISTRADOR') {
    return { ok: false, error: 'Su rol no tiene acceso a Verificación' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaP = ss.getSheetByName('Presupuestos');
  var datosP = hojaP.getDataRange().getValues();
  var encP = datosP[0];
  var idxVigente = encP.indexOf('vigente');
  var idxEstado = encP.indexOf('estado');

  // Solo las vigentes que ya le tocan al Verificador: recién radicadas
  // (esperan concepto) o ya resueltas por él (para ver su propio trabajo).
  // BORRADOR no aparece — mientras el municipio no radique, no es de él.
  var ESTADOS_BANDEJA = ['RADICADO', 'REQUIERE_AJUSTE', 'APROBADO'];
  var presupuestos = [];
  for (var i = 1; i < datosP.length; i++) {
    if (datosP[i][idxVigente] !== true) continue;
    if (ESTADOS_BANDEJA.indexOf(datosP[i][idxEstado]) === -1) continue;
    var p = {};
    encP.forEach(function (c, j) { p[c] = datosP[i][j]; });
    presupuestos.push(p);
  }

  // Se adjunta la sede (municipio, tipo de afectación, valor de referencia)
  // para que el navegador arme la bandeja sin un segundo viaje — mismo
  // patrón que Sedes_listar: el backend filtra y junta, el navegador pinta.
  var hojaS = ss.getSheetByName('Sedes');
  var datosS = hojaS.getDataRange().getValues();
  var encS = datosS[0];
  var idxDaneS = encS.indexOf('dane_sede');
  var sedesPorDane = {};
  for (var k = 1; k < datosS.length; k++) {
    var obj = {};
    encS.forEach(function (c, j) { obj[c] = datosS[k][j]; });
    sedesPorDane[String(datosS[k][idxDaneS])] = obj;
  }
  // Se adjuntan también los ítems: la bandeja es a lo sumo las 37 sedes del
  // lote 1 (hoy, muchas menos), así que traerlos de una vez evita un segundo
  // viaje por fila cuando el arquitecto abre el panel de "Emitir concepto"
  // (necesita el capítulo de cada ítem para el cruce daño↔presupuesto, D-34).
  presupuestos.forEach(function (p) {
    p.sede_info = sedesPorDane[String(p.dane_sede)] || null;
    p.items = _itemsDe(p.id_presupuesto);
  });

  return { ok: true, presupuestos: presupuestos };
}

function Verificaciones_emitir(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'VERIFICADOR' && sesion.rol !== 'ADMINISTRADOR') {
    return { ok: false, error: 'Su rol no puede emitir concepto de verificación' };
  }

  var resultado = String(body.resultado || '');
  if (RESULTADOS_VERIFICACION.indexOf(resultado) === -1) {
    return { ok: false, error: 'Resultado de verificación no reconocido' };
  }
  var observaciones = String(body.observaciones || '').trim();
  if (resultado !== 'CORRESPONDE' && observaciones.length < 20) {
    return { ok: false, error: 'Las observaciones son obligatorias (mínimo 20 caracteres) cuando el resultado no es "corresponde"' };
  }

  var daneSede = String(body.dane_sede || '');
  var idPresupuesto = String(body.id_presupuesto || '');
  var vigente = _presupuestoVigente(daneSede);
  if (!vigente) return { ok: false, error: 'Esta sede no tiene presupuesto vigente' };
  if (String(vigente.datos.id_presupuesto) !== idPresupuesto) {
    // El municipio radicó una versión nueva mientras esta quedó abierta en
    // pantalla: no se emite concepto sobre una versión que ya dejó de ser
    // la vigente, para no aprobar (o devolver) algo que ya cambió.
    return { ok: false, error: 'Esta versión ya no es la vigente (la actual es ' + vigente.datos.id_presupuesto + ') — recargue la bandeja' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaV = ss.getSheetByName('Verificaciones');
  var encV = hojaV.getRange(1, 1, 1, hojaV.getLastColumn()).getValues()[0];
  var valoresV = {
    id_presupuesto: idPresupuesto, resultado: resultado, observaciones: observaciones,
    verificador_correo: sesion.correo, fecha_verificacion: new Date()
  };
  hojaV.appendRow(encV.map(function (c) { return valoresV[c]; }));

  // Única celda de una fila vigente de Presupuestos que este módulo toca —
  // mismo patrón que D-37 ya autorizó para apagar `vigente`. El concepto
  // completo (quién, cuándo, qué dijo) queda íntegro en `Verificaciones`;
  // esto solo refleja el estado ACTUAL, nunca reemplaza esa auditoría.
  var hojaP = ss.getSheetByName('Presupuestos');
  var encP = hojaP.getRange(1, 1, 1, hojaP.getLastColumn()).getValues()[0];
  var nuevoEstado = ESTADO_SEGUN_RESULTADO[resultado];
  hojaP.getRange(vigente.fila, encP.indexOf('estado') + 1).setValue(nuevoEstado);

  return { ok: true, estado: nuevoEstado, resultado: resultado };
}

// La Ficha (Presupuestos_obtener) la usa para la sección 5 en modo lectura
// (D-30): hasta ahora esa sección nunca leía nada de `Verificaciones` — solo
// el `estado` de Presupuestos llegaba indirecto vía el badge, pero las
// observaciones (lo único que le dice al municipio QUÉ corregir) no viajaban
// a ningún lado. Si el mismo id_presupuesto tiene más de una fila (el
// arquitecto emitió concepto dos veces sobre la misma versión), se devuelve
// la más reciente por fecha.
function _verificacionDe(idPresupuesto) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Verificaciones');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxId = enc.indexOf('id_presupuesto');
  var idxFecha = enc.indexOf('fecha_verificacion');
  var ultima = null;
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxId]) !== String(idPresupuesto)) continue;
    if (!ultima || new Date(datos[i][idxFecha]) > new Date(ultima[idxFecha])) ultima = datos[i];
  }
  if (!ultima) return null;
  var obj = {};
  enc.forEach(function (c, j) { obj[c] = ultima[j]; });
  return obj;
}
