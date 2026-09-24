/**
 * Paso 3: registro manual de presupuesto (D-29, D-33). Sirve tanto para
 * "Guardar borrador" como para "Radicar presupuesto" — mismo camino, distinto
 * `estado` en el body. Nunca se sobrescribe una fila existente (D-37): cada
 * guardado agrega una fila NUEVA a `Presupuestos` con `version` + 1 y solo
 * apaga `vigente` en la fila anterior — el histórico completo queda
 * disponible siempre. Los totales (costo directo, A, U, IVA) los calcula el
 * servidor a partir de los ítems que llegan, nunca se toma el total que
 * mande el navegador tal cual.
 *
 * Borrador sobre algo ya radicado (2026-09-24): el borrador entra como versión
 * nueva pero con vigente=FALSE, «en espera». La radicada sigue vigente —en la
 * bandeja del arquitecto y en las cifras— hasta que se radique la versión
 * nueva. Antes, guardar un borrador apagaba la radicada y la sacaba de la
 * bandeja sin que nadie lo notara.
 */

function Presupuestos_obtener(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };

  var daneSede = String(body.dane_sede || '');
  var sede = _sedeDelCatalogo(daneSede);
  if (!sede) return { ok: false, error: 'DANE no existe en el catálogo' };
  if (!_enAlcance(sesion, sede.municipio, daneSede)) return { ok: false, error: 'Sede fuera de su alcance' };

  // Una sola lectura de Presupuestos para la vigente y el historial (antes se
  // leía la hoja completa dos veces por cada apertura de Ficha).
  var versiones = _versionesDe(daneSede);
  var vigente = versiones.vigente;
  if (!vigente) return { ok: true, presupuesto: null, items: [], historial: [] };

  // Borrador en espera: el más reciente sin radicar, posterior a la vigente.
  // Registrar lo retoma; la Ficha avisa que existe.
  var borrador = null;
  versiones.historial.forEach(function (v) {
    if (!borrador && v.vigente !== true && v.estado === 'BORRADOR' && Number(v.version) > Number(vigente.version)) borrador = v;
  });

  return {
    ok: true, presupuesto: vigente, items: _itemsDe(vigente.id_presupuesto),
    borrador: borrador, borrador_items: borrador ? _itemsDe(borrador.id_presupuesto) : [],
    // Todas las versiones (D-37 solo sirve si el histórico se puede CONSULTAR,
    // no solo guardar) — la Ficha las lista todas, no solo la vigente.
    historial: versiones.historial,
    // Concepto de verificación de la versión vigente, o null si nadie lo ha
    // emitido todavía — sección 5 de la Ficha en modo lectura (D-30).
    verificacion: _verificacionDe(vigente.id_presupuesto)
  };
}

function Presupuestos_guardar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  return _guardarPresupuesto(sesion, body, true);
}

// Núcleo del guardado, compartido por Presupuestos_guardar (una sede, toma su
// propio candado) y Presupuestos_volcarCarga (varias sedes bajo UN candado que
// ya tomó el llamador, por eso tomarCandado=false).
function _guardarPresupuesto(sesion, body, tomarCandado) {
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

  // D-42: sin candado, dos radicaciones simultáneas sobre la misma sede podrían
  // leer el mismo "vigente" y terminar las dos con vigente=true a la vez —
  // _presupuestoVigente() solo devuelve la primera que encuentra, la otra
  // quedaría invisible pero marcada vigente. El candado serializa todo el
  // tramo leer-decidir-escribir entre ejecuciones concurrentes del script.
  var lock = tomarCandado ? LockService.getScriptLock() : null;
  if (lock && !lock.tryLock(10000)) {
    return { ok: false, error: 'El sistema está ocupado guardando otro presupuesto — intente de nuevo' };
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hojaP = ss.getSheetByName('Presupuestos');
    var encP = hojaP.getRange(1, 1, 1, hojaP.getLastColumn()).getValues()[0];

    var estadoSede = _vigenteYUltimaVersion(daneSede);
    var actual = estadoSede.actual;
    // La versión sale de la última guardada, no de la vigente: puede haber
    // borradores en espera con número mayor que la vigente.
    var nuevaVersion = estadoSede.ultima + 1;
    // Un borrador no reemplaza algo ya radicado: queda en espera (vigente=FALSE).
    // Sí reemplaza a otro borrador, que no es un trámite.
    var enEspera = estado === 'BORRADOR' && !!actual && actual.datos.estado !== 'BORRADOR';
    if (actual && !enEspera) {
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
      estado: estado, creado_por: sesion.correo, fecha_creacion: new Date(), vigente: !enEspera
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

    // D-42: detección automática de discrepancias (Hallazgos.gs) — nunca debe
    // tumbar la radicación si algo sale mal acá adentro; el guardado ya se
    // hizo, lo único que se arriesga es no dejar la advertencia registrada.
    // Solo al radicar: un borrador todavía se está diligenciando y no es un
    // trámite (antes cada borrador dejaba hallazgos abiertos).
    if (estado === 'RADICADO') {
      try {
        _detectarHallazgosAutomaticos(sede, daneSede, valoresP, body);
      } catch (e) {
        Logger.log('No se pudo evaluar hallazgos automáticos para ' + idPresupuesto + ': ' + e);
      }
    }

    // Correo de confirmación con el número de radicado (Paso 6, ítem 21). Solo
    // al radicar a mano: un borrador no es un trámite, y una Carga vuelca
    // decenas de sedes de una vez — serían decenas de correos al arquitecto.
    // Igual que los hallazgos, un fallo del correo nunca deshace el guardado.
    var correoEnviado = false;
    if (estado === 'RADICADO' && origen === 'MANUAL') {
      try {
        correoEnviado = _enviarConfirmacionRadicado(sesion.correo, daneSede, sede.municipio, valoresP);
      } catch (e) {
        Logger.log('No se pudo enviar la confirmación de ' + idPresupuesto + ': ' + e);
      }
    }

    return {
      ok: true, id_presupuesto: idPresupuesto, version: nuevaVersion, estado: estado,
      en_espera: enEspera, version_vigente: enEspera ? Number(actual.datos.version) : nuevaVersion,
      costo_directo: costoDirecto, valor_admin: valorAdmin, valor_utilidad: valorUtilidad,
      valor_iva: valorIva, total_presupuesto: total,
      fecha_creacion: valoresP.fecha_creacion, correo_confirmacion: correoEnviado
    };
  } finally {
    if (lock) lock.releaseLock();
  }
}

/**
 * Cargas (D-23, D-41): vuelca varias sedes de un mismo archivo en UN pedido y
 * bajo UN candado. Antes el navegador mandaba un pedido por sede (~4 s cada
 * uno: 51 sedes de Samaná eran 3-4 minutos) y una respuesta perdida en medio
 * dejaba la fila como «error» aunque se hubiera guardado; reintentarla
 * duplicaba la versión.
 *
 * Idempotente: si la versión vigente de la sede ya es una CARGA del mismo
 * archivo con el mismo costo directo, no se crea otra — se informa ya_estaba.
 * Así reintentar una tanda (o subir dos veces el mismo archivo) no duplica.
 *
 * Un costo directo en $0 o vacío NO se vuelca: el lector lo marca como
 * «probablemente sin afectación, confirmar», y radicarlo como un presupuesto
 * de $0 sería afirmar algo que el municipio no dijo. Se confirma a mano.
 */
var MAX_FILAS_VOLCADO = 15;

function Presupuestos_volcarCarga(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  if (sesion.rol !== 'ADMINISTRADOR' && sesion.rol !== 'VERIFICADOR') {
    return { ok: false, error: 'Su rol no puede cargar presupuestos desde archivo' };
  }
  var filas = Array.isArray(body.filas) ? body.filas : [];
  if (!filas.length) return { ok: false, error: 'No llegó ninguna fila para volcar' };
  if (filas.length > MAX_FILAS_VOLCADO) return { ok: false, error: 'Máximo ' + MAX_FILAS_VOLCADO + ' filas por pedido' };
  // Cada fila puede traer su propio archivo (Belalcázar mandó tres Excel); si
  // no, vale el del pedido. Es lo que queda en `archivo_origen` como rastro.
  var archivoGeneral = String(body.archivo_origen || '').trim();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { ok: false, error: 'El sistema está ocupado guardando otro presupuesto — intente de nuevo' };
  }
  try {
    var resultados = filas.map(function (f) {
      var dane = String(f.dane_sede || '');
      var costo = Number(f.costo_directo);
      var archivo = String(f.archivo_origen || archivoGeneral).trim();
      if (!archivo) return { dane_sede: dane, ok: false, error: 'Falta el nombre del archivo de origen' };
      if (!(costo > 0)) {
        return { dane_sede: dane, ok: false, error: 'Costo directo en $0 o vacío: no se vuelca; si la sede no tiene afectación, se declara a mano en Registrar' };
      }
      var previo = _vigenteYUltimaVersion(dane).actual;
      if (previo && previo.datos.origen === 'CARGA' && String(previo.datos.archivo_origen) === archivo &&
          Number(previo.datos.costo_directo) === costo) {
        return { dane_sede: dane, ok: true, ya_estaba: true, id_presupuesto: previo.datos.id_presupuesto, version: Number(previo.datos.version) };
      }
      try {
        var r = _guardarPresupuesto(sesion, {
          dane_sede: dane, estado: 'RADICADO', origen: 'CARGA', archivo_origen: archivo,
          // D-42: DANE propuesto por nombre y confirmado a mano → hallazgo de advertencia.
          origen_dane: f.origen_dane === 'propuesto' ? 'propuesto' : 'archivo',
          // D-41: sin desglose por capítulo, un ítem único; capítulo vacío = no
          // se infiere a cuál pertenece (D-36).
          items: [{ capitulo: '', descripcion: 'Costo directo según el Excel de la alcaldía, sin desglose por capítulo en el archivo de origen', unidad: 'gl', cantidad: 1, valor_unitario: costo }],
          pct_admin: 0, pct_utilidad: 0, plazo_dias: 0,
          descripcion_afectacion: 'Cargado desde ' + archivo + '. El archivo no separa Administración, Utilidad ni IVA: quedan en 0 hasta que el municipio los declare o el arquitecto los confirme al verificar.'
        }, false);
        r.dane_sede = dane;
        return r;
      } catch (e) {
        return { dane_sede: dane, ok: false, error: 'Error al guardar: ' + e };
      }
    });
    return {
      ok: true, resultados: resultados,
      volcados: resultados.filter(function (x) { return x.ok && !x.ya_estaba; }).length,
      ya_estaban: resultados.filter(function (x) { return x.ya_estaba; }).length,
      con_error: resultados.filter(function (x) { return !x.ok; }).length
    };
  } finally {
    lock.releaseLock();
  }
}

// Municipio y tipo de censo de una sede. Se consulta en CADA petición que toca
// una sede (alcance, hallazgos), así que el catálogo se guarda en caché
// CATALOGO_CACHE_SEG segundos en vez de leer las 975 filas de `Sedes` cada
// vez. Formato compacto (índices a listas de municipios y tipos) para quedar
// muy por debajo del límite de 100 KB por valor de CacheService. Si un DANE no
// está en la caché (catálogo regenerado con sedes nuevas), se relee la hoja.
// Tras regenerar la pestaña Sedes se puede correr olvidarCatalogo() a mano.
var CATALOGO_CACHE_SEG = 6 * 60 * 60;

function _sedeDelCatalogo(daneSede) {
  var cat = _catalogoCompacto(false);
  var fila = cat.d[daneSede];
  if (!fila) {
    cat = _catalogoCompacto(true);
    fila = cat.d[daneSede];
    if (!fila) return null;
  }
  // tipo_censo se agregó para D-42 (_detectarHallazgosAutomaticos, Hallazgos.gs):
  // detectar cuando alguien declara "sin afectación" sobre una sede que el
  // censo marca prioritaria (tipo 1 o 2).
  return { municipio: cat.m[fila[0]], tipo_censo: cat.t[fila[1]] };
}

function _catalogoCompacto(forzarLectura) {
  var cache = CacheService.getScriptCache();
  if (!forzarLectura) {
    var guardado = cache.get('catalogo_sedes');
    if (guardado) return JSON.parse(guardado);
  }
  var datos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sedes').getDataRange().getValues();
  var enc = datos[0];
  var idxDane = enc.indexOf('dane_sede');
  var idxMuni = enc.indexOf('municipio');
  var idxTipoCenso = enc.indexOf('tipo_censo');
  var cat = { m: [], t: [], d: {} };
  for (var i = 1; i < datos.length; i++) {
    var muni = String(datos[i][idxMuni]);
    var tipo = String(datos[i][idxTipoCenso] || '');
    var im = cat.m.indexOf(muni); if (im === -1) { cat.m.push(muni); im = cat.m.length - 1; }
    var it = cat.t.indexOf(tipo); if (it === -1) { cat.t.push(tipo); it = cat.t.length - 1; }
    cat.d[String(datos[i][idxDane])] = [im, it];
  }
  try {
    cache.put('catalogo_sedes', JSON.stringify(cat), CATALOGO_CACHE_SEG);
  } catch (e) {
    Logger.log('El catálogo no cupo en caché; se seguirá leyendo la hoja: ' + e);
  }
  return cat;
}

/** Se corre a mano desde el editor si se regeneró la pestaña Sedes. */
function olvidarCatalogo() {
  CacheService.getScriptCache().remove('catalogo_sedes');
  Logger.log('Caché del catálogo borrada: la siguiente petición relee Sedes.');
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

// La vigente ({fila, datos} o null) y el número de la última versión guardada
// de un DANE, con una sola lectura. Solo para Presupuestos_guardar, dentro del
// candado: la última puede ser un borrador en espera, más nuevo que la vigente.
function _vigenteYUltimaVersion(daneSede) {
  var datos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Presupuestos').getDataRange().getValues();
  var enc = datos[0];
  var idxDane = enc.indexOf('dane_sede');
  var idxVigente = enc.indexOf('vigente');
  var idxVersion = enc.indexOf('version');
  var actual = null, ultima = 0;
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxDane]) !== daneSede) continue;
    ultima = Math.max(ultima, Number(datos[i][idxVersion]) || 0);
    if (datos[i][idxVigente] === true && !actual) {
      var obj = {};
      enc.forEach(function (c, j) { obj[c] = datos[i][j]; });
      actual = { fila: i + 1, datos: obj };
    }
  }
  return { actual: actual, ultima: ultima };
}

// Todas las versiones de un DANE (vigente + históricas, más nueva primero) y
// cuál es la vigente, con una sola lectura de la hoja. Solo lectura
// (Presupuestos_obtener) — el versionado real (D-37) lo sigue decidiendo
// _presupuestoVigente dentro del candado de Presupuestos_guardar.
function _versionesDe(daneSede) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Presupuestos');
  var datos = hoja.getDataRange().getValues();
  var enc = datos[0];
  var idxDane = enc.indexOf('dane_sede');
  var idxVigente = enc.indexOf('vigente');
  var historial = [];
  var vigente = null;
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][idxDane]) !== daneSede) continue;
    var obj = {};
    enc.forEach(function (c, j) { obj[c] = datos[i][j]; });
    historial.push(obj);
    if (datos[i][idxVigente] === true && !vigente) vigente = obj;
  }
  historial.sort(function (a, b) { return Number(b.version) - Number(a.version); });
  return { vigente: vigente, historial: historial };
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

// Nombre legible de la sede, solo para el correo de confirmación (una lectura
// de Sedes por radicación, no por consulta).
function _nombreSede(daneSede) {
  var datos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sedes').getDataRange().getValues();
  var enc = datos[0];
  var iDane = enc.indexOf('dane_sede'), iInst = enc.indexOf('institucion'), iSede = enc.indexOf('sede');
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][iDane]) === daneSede) {
      var inst = String(datos[i][iInst] || ''), sede = String(datos[i][iSede] || '');
      return inst && sede && inst !== sede ? inst + ' — ' + sede : (sede || inst);
    }
  }
  return daneSede;
}

function _pesos(n) {
  return '$ ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Correo de confirmación al que radicó. Texto plano, mismo remitente que el
// código de ingreso (MailApp, D-20). No lleva enlace porque el sistema todavía
// no tiene dirección pública fija; se agrega al publicar.
function _enviarConfirmacionRadicado(correo, daneSede, municipio, p) {
  if (MailApp.getRemainingDailyQuota() < 1) {
    Logger.log('Cupo diario de correo agotado: no se envió la confirmación de ' + p.id_presupuesto);
    return false;
  }
  var fecha = Utilities.formatDate(p.fecha_creacion, 'America/Bogota', 'yyyy-MM-dd HH:mm');
  MailApp.sendEmail(correo,
    'Radicado ' + p.id_presupuesto + ' - Reconstrucción de sedes',
    'Se radicó el presupuesto de la sede:\n\n' +
    '  ' + _nombreSede(daneSede) + '\n' +
    '  DANE ' + daneSede + ' · ' + municipio + '\n\n' +
    'Número de radicado: ' + p.id_presupuesto + '\n' +
    'Fecha: ' + fecha + '\n' +
    'Total del presupuesto: ' + _pesos(p.total_presupuesto) +
    ' (costo directo ' + _pesos(p.costo_directo) + ')\n\n' +
    'Qué sigue: el presupuesto queda en la bandeja de verificación de la Secretaría de Educación. ' +
    'Cuando el arquitecto emita su concepto, lo verá en la ficha de la sede.\n\n' +
    'Si necesita corregirlo, radique una versión nueva desde la ficha: la anterior no se borra.\n\n' +
    'Secretaría de Educación de Caldas — Reconstrucción de sedes');
  return true;
}
