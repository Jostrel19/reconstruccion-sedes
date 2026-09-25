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

  // Se adjunta la sede (municipio, tipo de afectación, capítulos con daño)
  // para que el navegador arme la bandeja sin un segundo viaje — mismo
  // patrón que Sedes_listar: el backend filtra y junta, el navegador pinta.
  // D-43: sin `valor_referencia`, igual que Sedes_listar.
  var hojaS = ss.getSheetByName('Sedes');
  var datosS = hojaS.getDataRange().getValues();
  var encS = datosS[0];
  var idxDaneS = encS.indexOf('dane_sede');
  var sedesPorDane = {};
  for (var k = 1; k < datosS.length; k++) {
    var obj = {};
    encS.forEach(function (c, j) { obj[c] = datosS[k][j]; });
    delete obj.valor_referencia;
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

  // D-42: la comprobación de "sigue siendo la vigente" de abajo reduce la
  // ventana de carrera pero no la cierra — dos "Emitir concepto" concurrentes
  // podrían pasar los dos la comprobación antes de que cualquiera escriba. El
  // candado serializa el tramo completo leer-comprobar-escribir.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, error: 'El sistema está ocupado con otro concepto — intente de nuevo' };
  }
  var emitido;
  try {
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
    emitido = { presupuesto: vigente.datos, estado: nuevoEstado, fecha: valoresV.fecha_verificacion };
  } finally {
    lock.releaseLock();
  }

  // Aviso por correo a quien radicó (hito 0, punto 7). Fuera del candado:
  // enviar tarda y no hace falta bloquear a otros arquitectos mientras tanto.
  // Igual que la confirmación de radicado, un fallo del correo nunca deshace
  // el concepto, que ya quedó guardado.
  var correoAviso = false;
  try {
    correoAviso = _avisarConcepto(emitido.presupuesto, daneSede, resultado, emitido.estado,
      observaciones, sesion.correo, emitido.fecha);
  } catch (e) {
    Logger.log('No se pudo avisar el concepto de ' + idPresupuesto + ': ' + e);
  }
  return { ok: true, estado: emitido.estado, resultado: resultado, correo_aviso: correoAviso };
}

var RESULTADO_TEXTO = {
  CORRESPONDE: 'Corresponde', CORRESPONDE_PARCIAL: 'Corresponde parcialmente', NO_CORRESPONDE: 'No corresponde'
};

// Correo a quien radicó el presupuesto, con el concepto y qué tiene que hacer.
// No se envía (devuelve false):
// - si el presupuesto entró por Cargas: lo subió el arquitecto con lo que el
//   municipio mandó en Excel, así que quien lo radicó en el sistema es de la
//   Secretaría, no el municipio;
// - si quien radicó es quien emite el concepto (ya lo sabe);
// - si quien radicó ya no está activo en Usuarios;
// - si no queda cupo diario de correo (100 con cuenta personal, medido el 2026-09-25).
// Texto plano y sin enlace, como la confirmación de radicado: el sistema
// todavía no tiene dirección pública fija.
function _avisarConcepto(p, daneSede, resultado, estado, observaciones, correoVerificador, fecha) {
  if (p.origen === 'CARGA') return false;
  var destino = _normalizarCorreo(p.creado_por);
  if (!destino || destino === _normalizarCorreo(correoVerificador)) return false;
  var usuario = _buscarUsuario(destino);
  if (!usuario || !usuario.activo) return false;
  if (MailApp.getRemainingDailyQuota() < 1) {
    Logger.log('Cupo diario de correo agotado: no se avisó el concepto de ' + p.id_presupuesto);
    return false;
  }
  var sede = _sedeDelCatalogo(daneSede);
  var aprobado = estado === 'APROBADO';
  var cuando = Utilities.formatDate(fecha, 'America/Bogota', 'yyyy-MM-dd HH:mm');
  MailApp.sendEmail(destino,
    (aprobado ? 'Presupuesto aprobado' : 'Presupuesto devuelto para ajuste') + ' - ' + p.id_presupuesto +
      ' - Reconstrucción de sedes',
    'La Secretaría de Educación emitió el concepto de verificación del presupuesto radicado de la sede:\n\n' +
    '  ' + _nombreSede(daneSede) + '\n' +
    '  DANE ' + daneSede + (sede ? ' · ' + sede.municipio : '') + '\n\n' +
    'Número de radicado: ' + p.id_presupuesto + '\n' +
    'Concepto: ' + RESULTADO_TEXTO[resultado] + '\n' +
    'Estado del presupuesto: ' + (aprobado ? 'Aprobado' : 'Requiere ajuste') + '\n' +
    'Emitido por: ' + correoVerificador + ', ' + cuando + '\n\n' +
    (observaciones ? 'Observaciones del arquitecto:\n' + observaciones + '\n\n' : '') +
    (aprobado
      ? 'Qué sigue: el presupuesto quedó aprobado en el sistema. Puede consultarlo en la ficha de la sede.\n\n'
      : 'Qué sigue: corrija lo indicado en las observaciones y radique una versión nueva desde la ficha de la sede. ' +
        'Esta versión no se borra: queda como registro.\n\n') +
    'Secretaría de Educación de Caldas — Reconstrucción de sedes');
  return true;
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
