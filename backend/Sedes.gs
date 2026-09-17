/**
 * Lectura de sedes, filtrada del lado del servidor según el rol y alcance de
 * la sesión — nunca del lado del navegador (docs/PLAN_DESARROLLO.md §2):
 *
 *   ADMINISTRADOR / VERIFICADOR / CONSULTA -> todo el departamento (D-25 para
 *     Verificador; Administrador y Consulta lo mismo por definición de rol).
 *   RESPONSABLE_SEDE (alcalde) -> alcance == municipio de la sede (D-24).
 *   RESPONSABLE_SEDE (rector)  -> dane_sede está en su lista de alcance (D-24).
 *
 * `valor_referencia` se quita de la respuesta para Responsable de sede (D-6):
 * el municipio presupuesta sin ver la cifra de la SED.
 */
function Sedes_listar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };

  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sedes');
  var datos = hoja.getDataRange().getValues();
  var encabezados = datos[0];
  var idxMunicipio = encabezados.indexOf('municipio');
  var idxDaneSede = encabezados.indexOf('dane_sede');

  var sedes = [];
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var municipio = fila[idxMunicipio];
    var daneSede = String(fila[idxDaneSede]);

    if (!_enAlcance(sesion, municipio, daneSede)) continue;

    var sede = {};
    encabezados.forEach(function (col, j) { sede[col] = fila[j]; });
    if (sesion.rol === 'RESPONSABLE_SEDE') delete sede.valor_referencia;
    sedes.push(sede);
  }

  return { ok: true, sedes: sedes };
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
