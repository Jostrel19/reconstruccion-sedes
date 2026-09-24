/**
 * Lotes de trabajo creados por el Administrador (D-44, 2026-09-24).
 *
 * Antes el "lote 1" no lo creaba nadie: se derivaba solo del tipo de
 * afectación del censo (tipo 1-2, D-31). Por decisión del usuario ya no existe
 * ningún lote de antemano: el Administrador los crea, les pone nombre y elige
 * sus sedes, y el sistema se trabaja por lotes (Tablero, Sedes y Municipio
 * filtran por lote).
 *
 * Dos pestañas, mismo criterio de no sobrescribir de D-37:
 *   Lotes      — id_lote · nombre · descripcion · creado_por · fecha_creacion · activo
 *   LotesSedes — id_lote · dane_sede · agregado_por · fecha · vigente
 *
 * Una sede está en un solo lote a la vez. Moverla a otro lote apaga su fila
 * anterior (`vigente` = FALSE, escritura dirigida a una celda) y agrega una
 * nueva: queda el historial de en qué lote estuvo y quién la movió. Cerrar un
 * lote solo apaga su `activo`; sus sedes siguen registradas en él (sirve de
 * historia: qué entró en cada fase), pero dejan de contar como "en seguimiento"
 * por ese lote.
 *
 * Solo ADMINISTRADOR crea, agrega, quita o cierra. Todos los roles con sesión
 * pueden listar (dentro de su alcance).
 */
var LOTE_NOMBRE_MAX = 80;
var LOTE_DESCRIPCION_MAX = 500;
var LOTE_SEDES_MAX = 1000;

function Lotes_listar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasLotesListas(ss)) return { ok: true, lotes: [], hojas_faltantes: true };

  var membresia = _membresiaVigente(ss);
  var lotes = _todosLosLotes(ss).map(function (l) {
    l.danes = [];
    return l;
  });
  var porId = {};
  lotes.forEach(function (l) { porId[l.id_lote] = l; });
  var cat = _catalogoCompacto(false); // una lectura del catálogo, no una por sede
  Object.keys(membresia).forEach(function (dane) {
    var lote = porId[membresia[dane].id_lote];
    var fila = cat.d[dane];
    if (!lote || !fila) return;
    if (!_enAlcance(sesion, cat.m[fila[0]], dane)) return;
    lote.danes.push(dane);
  });
  return { ok: true, lotes: lotes };
}

function Lotes_crear(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Solo el Administrador crea lotes' };

  var nombre = String(body.nombre || '').trim();
  var descripcion = String(body.descripcion || '').trim();
  if (!nombre) return { ok: false, error: 'El lote necesita un nombre' };
  if (nombre.length > LOTE_NOMBRE_MAX) return { ok: false, error: 'El nombre admite máximo ' + LOTE_NOMBRE_MAX + ' caracteres' };
  if (descripcion.length > LOTE_DESCRIPCION_MAX) return { ok: false, error: 'La descripción admite máximo ' + LOTE_DESCRIPCION_MAX + ' caracteres' };
  var danes = _listaDanes(body.danes);
  if (danes.error) return { ok: false, error: danes.error };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasLotesListas(ss)) return { ok: false, error: 'Faltan las hojas Lotes y LotesSedes: corra crearHojas() en el editor de Apps Script' };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'El sistema está ocupado — intente de nuevo' };
  try {
    var existentes = _todosLosLotes(ss);
    var repetido = existentes.some(function (l) {
      return l.activo && l.nombre.toLowerCase() === nombre.toLowerCase();
    });
    if (repetido) return { ok: false, error: 'Ya hay un lote activo con ese nombre' };

    var mayor = 0;
    existentes.forEach(function (l) {
      var n = Number(String(l.id_lote).replace(/^L-/, ''));
      if (n > mayor) mayor = n;
    });
    var idLote = 'L-' + (mayor + 1);

    var hoja = ss.getSheetByName('Lotes');
    var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    var valores = {
      id_lote: idLote, nombre: nombre, descripcion: descripcion,
      creado_por: sesion.correo, fecha_creacion: new Date(), activo: true
    };
    hoja.appendRow(enc.map(function (c) { return valores[c]; }));

    var resultado = _asignarSedes(ss, idLote, danes.lista, sesion.correo);
    resultado.ok = true;
    resultado.id_lote = idLote;
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function Lotes_agregarSedes(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Solo el Administrador modifica lotes' };
  var danes = _listaDanes(body.danes);
  if (danes.error) return { ok: false, error: danes.error };
  if (!danes.lista.length) return { ok: false, error: 'No llegó ninguna sede para agregar' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasLotesListas(ss)) return { ok: false, error: 'Faltan las hojas Lotes y LotesSedes' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'El sistema está ocupado — intente de nuevo' };
  try {
    var lote = _loteActivo(ss, String(body.id_lote || ''));
    if (!lote) return { ok: false, error: 'El lote no existe o está cerrado' };
    var resultado = _asignarSedes(ss, lote.id_lote, danes.lista, sesion.correo);
    resultado.ok = true;
    resultado.id_lote = lote.id_lote;
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function Lotes_quitarSede(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Solo el Administrador modifica lotes' };
  var idLote = String(body.id_lote || '');
  var dane = String(body.dane_sede || '');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasLotesListas(ss)) return { ok: false, error: 'Faltan las hojas Lotes y LotesSedes' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'El sistema está ocupado — intente de nuevo' };
  try {
    var actual = _membresiaVigente(ss)[dane];
    if (!actual || actual.id_lote !== idLote) return { ok: false, error: 'Esa sede no está en ese lote' };
    var hoja = ss.getSheetByName('LotesSedes');
    var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    // Escritura dirigida a una celda, como `vigente` en Presupuestos (D-37):
    // la fila queda como registro de que la sede estuvo en el lote.
    hoja.getRange(actual.fila, enc.indexOf('vigente') + 1).setValue(false);
    return { ok: true, id_lote: idLote, dane_sede: dane };
  } finally {
    lock.releaseLock();
  }
}

function Lotes_cerrar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Solo el Administrador cierra lotes' };
  var idLote = String(body.id_lote || '');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasLotesListas(ss)) return { ok: false, error: 'Faltan las hojas Lotes y LotesSedes' };
  var hoja = ss.getSheetByName('Lotes');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var cId = enc.indexOf('id_lote'), cActivo = enc.indexOf('activo');
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][cId]) !== idLote) continue;
    if (!_verdadero(datos[i][cActivo])) return { ok: false, error: 'El lote ya estaba cerrado' };
    hoja.getRange(i + 1, cActivo + 1).setValue(false);
    return { ok: true, id_lote: idLote };
  }
  return { ok: false, error: 'No existe ese lote' };
}

/* ─── ayudantes ─── */

function _hojasLotesListas(ss) {
  return !!ss.getSheetByName('Lotes') && !!ss.getSheetByName('LotesSedes');
}

function _verdadero(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

// Todos los lotes (activos y cerrados), en orden de creación.
function _todosLosLotes(ss) {
  var datos = ss.getSheetByName('Lotes').getDataRange().getValues();
  var enc = datos[0];
  var lotes = [];
  for (var i = 1; i < datos.length; i++) {
    var l = {};
    enc.forEach(function (c, j) { l[c] = datos[i][j]; });
    l.id_lote = String(l.id_lote);
    l.nombre = String(l.nombre || '');
    l.activo = _verdadero(l.activo);
    lotes.push(l);
  }
  return lotes;
}

function _loteActivo(ss, idLote) {
  var lotes = _todosLosLotes(ss);
  for (var i = 0; i < lotes.length; i++) {
    if (lotes[i].id_lote === idLote && lotes[i].activo) return lotes[i];
  }
  return null;
}

// dane_sede -> { id_lote, fila } de su pertenencia vigente. `fila` es la fila
// real de la hoja (1-based) para poder apagarla sin tocar ninguna otra celda.
function _membresiaVigente(ss) {
  var datos = ss.getSheetByName('LotesSedes').getDataRange().getValues();
  var enc = datos[0];
  var cId = enc.indexOf('id_lote'), cDane = enc.indexOf('dane_sede'), cVig = enc.indexOf('vigente');
  var porDane = {};
  for (var i = 1; i < datos.length; i++) {
    if (!_verdadero(datos[i][cVig])) continue;
    porDane[String(datos[i][cDane])] = { id_lote: String(datos[i][cId]), fila: i + 1 };
  }
  return porDane;
}

// Normaliza y valida la lista de DANE que llega del navegador. Nunca se
// confía en ella: 12 dígitos y presente en el catálogo, uno por uno.
function _listaDanes(entrada) {
  var lista = Array.isArray(entrada) ? entrada : [];
  if (lista.length > LOTE_SEDES_MAX) return { error: 'Máximo ' + LOTE_SEDES_MAX + ' sedes por operación' };
  var vistos = {};
  var limpios = [];
  var cat = _catalogoCompacto(false);
  var releido = false;
  for (var i = 0; i < lista.length; i++) {
    var d = String(lista[i]).trim();
    if (!/^\d{12}$/.test(d)) return { error: 'DANE inválido: ' + d + ' (deben ser 12 dígitos)' };
    if (!cat.d[d] && !releido) { cat = _catalogoCompacto(true); releido = true; }
    if (!cat.d[d]) return { error: 'El DANE ' + d + ' no existe en el catálogo' };
    if (vistos[d]) continue;
    vistos[d] = true;
    limpios.push(d);
  }
  return { lista: limpios };
}

// Pone las sedes en el lote. Las que ya estaban en él se omiten; las que
// estaban en otro lote se mueven (se apaga su fila anterior). Las filas nuevas
// se escriben de una vez con setValues, no una por una.
function _asignarSedes(ss, idLote, danes, correo) {
  var hoja = ss.getSheetByName('LotesSedes');
  var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var cVig = enc.indexOf('vigente') + 1;
  var membresia = _membresiaVigente(ss);
  var ahora = new Date();
  var nuevas = [];
  var movidas = [];
  var yaEstaban = 0;

  danes.forEach(function (dane) {
    var actual = membresia[dane];
    if (actual && actual.id_lote === idLote) { yaEstaban++; return; }
    if (actual) {
      hoja.getRange(actual.fila, cVig).setValue(false);
      movidas.push({ dane_sede: dane, desde: actual.id_lote });
    }
    var valores = { id_lote: idLote, dane_sede: dane, agregado_por: correo, fecha: ahora, vigente: true };
    nuevas.push(enc.map(function (c) { return valores[c]; }));
  });

  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, enc.length).setValues(nuevas);
  }
  return { agregadas: nuevas.length, movidas: movidas, ya_estaban: yaEstaban };
}

// dane_sede -> { id_lote, nombre, activo } para Sedes_listar. Vacío si las
// hojas todavía no existen (antes de correr crearHojas()).
function _loteDeCadaSede(ss) {
  if (!_hojasLotesListas(ss)) return { porDane: {}, lotes: [] };
  var lotes = _todosLosLotes(ss);
  var porId = {};
  lotes.forEach(function (l) { porId[l.id_lote] = l; });
  var membresia = _membresiaVigente(ss);
  var porDane = {};
  Object.keys(membresia).forEach(function (dane) {
    var l = porId[membresia[dane].id_lote];
    if (l) porDane[dane] = { id_lote: l.id_lote, nombre: l.nombre, activo: l.activo };
  });
  return {
    porDane: porDane,
    lotes: lotes.map(function (l) {
      return {
        id_lote: l.id_lote, nombre: l.nombre, descripcion: l.descripcion || '',
        creado_por: l.creado_por, fecha_creacion: l.fecha_creacion, activo: l.activo
      };
    })
  };
}
