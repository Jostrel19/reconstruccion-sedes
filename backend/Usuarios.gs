/**
 * Gestión de usuarios (D-20, D-24). Hasta ahora la pantalla Usuarios era 7
 * filas escritas a mano en el HTML — activar a alguien real significaba
 * editar la pestaña `Usuarios` directamente en el Sheet. Solo ADMINISTRADOR
 * puede ver o tocar esta pantalla: es quien decide quién entra al sistema y
 * con qué alcance (CLAUDE.md §6, "Gestionar usuarios" en la tabla de roles).
 *
 * `_buscarUsuario` y `_normalizarCorreo` ya existen en Auth.gs — Apps Script
 * concatena todos los .gs del proyecto en un solo ámbito global.
 */

var ROLES_VALIDOS = ['ADMINISTRADOR', 'VERIFICADOR', 'RESPONSABLE_SEDE', 'CONSULTA'];
var TIPOS_VALIDOS = ['alcalde', 'rector', 'interno'];

function Usuarios_listar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Su rol no tiene acceso a Usuarios' };

  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var usuarios = [];
  for (var i = 1; i < datos.length; i++) {
    var obj = {};
    enc.forEach(function (c, j) { obj[c] = datos[i][j]; });
    usuarios.push(obj);
  }
  return { ok: true, usuarios: usuarios };
}

// Valida que rol/tipo/alcance tengan sentido entre sí (D-24: Responsable de
// sede es alcalde -> alcance es el nombre del municipio, o rector -> alcance
// es una lista "dane1 | dane2 | ..." de 12 dígitos cada uno, mismo formato
// que ya interpreta `_enAlcance` en Sedes.gs). Para los otros tres roles el
// alcance no se valida por sede (Sedes_listar los deja pasar siempre), así
// que se fuerza a 'TODO_EL_DEPARTAMENTO' sin confiar en lo que mande el
// navegador.
function _validarRolTipoAlcance(rol, tipo, alcance) {
  if (ROLES_VALIDOS.indexOf(rol) === -1) return { error: 'Rol no reconocido' };
  if (TIPOS_VALIDOS.indexOf(tipo) === -1) return { error: 'Tipo no reconocido' };

  if (rol !== 'RESPONSABLE_SEDE') {
    if (tipo !== 'interno') return { error: 'Este rol solo admite tipo "interno"' };
    return { alcance: 'TODO_EL_DEPARTAMENTO' };
  }

  if (tipo === 'alcalde') {
    var municipio = String(alcance || '').trim();
    if (!municipio) return { error: 'Un alcalde necesita el nombre de su municipio como alcance' };
    return { alcance: municipio };
  }

  if (tipo === 'rector') {
    var lista = String(alcance || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    if (lista.length === 0) return { error: 'Un rector necesita al menos un DANE de sede en su alcance' };
    for (var i = 0; i < lista.length; i++) {
      if (!/^\d{12}$/.test(lista[i])) return { error: 'DANE de sede inválido en el alcance: ' + lista[i] + ' (deben ser 12 dígitos)' };
    }
    return { alcance: lista.join('|') };
  }

  return { error: 'Responsable de sede necesita tipo "alcalde" o "rector"' };
}

function Usuarios_crear(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Su rol no puede crear usuarios' };

  var correo = _normalizarCorreo(body.correo);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { ok: false, error: 'Correo inválido' };
  if (_buscarUsuario(correo)) return { ok: false, error: 'Ya existe un usuario con ese correo' };

  var nombre = String(body.nombre || '').trim();
  if (!nombre) return { ok: false, error: 'Falta el nombre' };

  var validacion = _validarRolTipoAlcance(String(body.rol || ''), String(body.tipo || ''), body.alcance);
  if (validacion.error) return { ok: false, error: validacion.error };

  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var valores = {
    correo: correo, nombre: nombre, rol: body.rol, tipo: body.tipo,
    alcance: validacion.alcance, activo: true
  };
  hoja.appendRow(enc.map(function (c) { return valores[c]; }));
  _olvidarUsuariosActivos(); // Auth.gs: el cambio vale desde la siguiente petición

  return { ok: true, correo: correo };
}

// Activar/desactivar o cambiar rol/tipo/alcance de un usuario existente — solo
// las celdas que llegan en el body, nunca se reescribe la fila completa.
function Usuarios_actualizar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Su rol no puede modificar usuarios' };

  var correo = _normalizarCorreo(body.correo);
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxCorreo = enc.indexOf('correo');

  var fila = -1;
  for (var i = 1; i < datos.length; i++) {
    if (_normalizarCorreo(datos[i][idxCorreo]) === correo) { fila = i + 1; break; }
  }
  if (fila === -1) return { ok: false, error: 'No existe ese usuario' };

  if (typeof body.activo === 'boolean') {
    hoja.getRange(fila, enc.indexOf('activo') + 1).setValue(body.activo);
  }
  if (body.rol || body.tipo || body.alcance !== undefined) {
    var filaActual = datos[fila - 1];
    var rolNuevo = body.rol || filaActual[enc.indexOf('rol')];
    var tipoNuevo = body.tipo || filaActual[enc.indexOf('tipo')];
    var alcanceNuevo = body.alcance !== undefined ? body.alcance : filaActual[enc.indexOf('alcance')];
    var validacion = _validarRolTipoAlcance(String(rolNuevo), String(tipoNuevo), alcanceNuevo);
    if (validacion.error) return { ok: false, error: validacion.error };
    hoja.getRange(fila, enc.indexOf('rol') + 1).setValue(rolNuevo);
    hoja.getRange(fila, enc.indexOf('tipo') + 1).setValue(tipoNuevo);
    hoja.getRange(fila, enc.indexOf('alcance') + 1).setValue(validacion.alcance);
  }
  // Auth.gs: desactivar o cambiar rol/alcance corta la sesión abierta de esa
  // persona desde la siguiente petición, sin esperar a que venza el token.
  _olvidarUsuariosActivos();

  return { ok: true, correo: correo };
}
