/**
 * Respaldo automático del Sheet completo (base de datos del sistema). Google
 * guarda historial de versiones nativo, pero eso vive dentro del mismo
 * archivo — si el archivo se corrompe, se borra por error o la cuenta pierde
 * acceso, el historial se va con él. Esto copia el archivo entero, aparte,
 * con regularidad.
 *
 * Configuración (una sola vez): correr `configurarRespaldoAutomatico` desde
 * el editor. Crea un disparador de tiempo que llama a `respaldarSheet` todos
 * los días. Es seguro volver a correrla: borra el disparador anterior antes
 * de crear uno nuevo, así no se duplican.
 */
var CARPETA_RESPALDOS = 'Respaldos - Reconstruccion de sedes';
var DIAS_RETENCION = 30;

function configurarRespaldoAutomatico() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'respaldarSheet') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('respaldarSheet')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  Logger.log('Respaldo automático configurado: todos los días, alrededor de las 2 a. m.');
}

function respaldarSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var archivo = DriveApp.getFileById(ss.getId());
  var carpeta = _carpetaRespaldos();

  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
  archivo.makeCopy('Respaldo ' + fecha + ' - ' + ss.getName(), carpeta);

  _limpiarRespaldosViejos(carpeta);
  Logger.log('Respaldo creado: ' + fecha);
}

function _carpetaRespaldos() {
  var carpetas = DriveApp.getFoldersByName(CARPETA_RESPALDOS);
  if (carpetas.hasNext()) return carpetas.next();
  return DriveApp.createFolder(CARPETA_RESPALDOS);
}

function _limpiarRespaldosViejos(carpeta) {
  var limite = new Date(Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000);
  var archivos = carpeta.getFiles();
  while (archivos.hasNext()) {
    var f = archivos.next();
    if (f.getDateCreated() < limite) f.setTrashed(true);
  }
}
