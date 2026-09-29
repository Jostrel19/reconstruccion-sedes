/**
 * Confirmación de sedes por los alcaldes (D-48, 2026-09-28).
 *
 * Cada alcalde responde, por cada sede oficial de su municipio, si la sede
 * tiene una intervención terminada o en proceso y, si la tiene, quién
 * interviene, su nombre (cuando aplica) y el estado de la obra. Con todas las
 * sedes respondidas genera la certificación (la imprime el navegador), la
 * firma, la escanea y la carga aquí como un solo PDF. Los campos son
 * EXACTAMENTE los del oficio de la jefatura: no se agrega ninguno.
 *
 * Dos pestañas, mismo criterio de no sobrescribir de D-37:
 *   Confirmaciones  — dane_sede · municipio · tiene_intervencion · quien_interviene ·
 *                     nombre_quien_interviene · estado_obra · registrado_por ·
 *                     fecha_registro · vigente
 *     Corregir una sede agrega una fila y apaga `vigente` de la anterior
 *     (escritura dirigida a una celda); guardar lo mismo no agrega nada.
 *   Certificaciones — id_certificacion · municipio · evento · codigo_verificacion ·
 *                     n_sedes · correo · fecha · archivo_id · archivo_nombre ·
 *                     tamano_bytes · sha256
 *     Solo se agregan filas: GENERADO al generar (una por código distinto) y
 *     CARGADO al subir el PDF firmado. Nunca se toca una fila existente.
 *
 * Quién: solo los usuarios RESPONSABLE_SEDE con tipo «alcalde» escriben (su
 * municipio es su alcance). Administrador, Verificador y Consulta ven el
 * avance de los 26 y descargan los PDF. Los rectores no entran.
 *
 * Código de verificación: huella SHA-256 de las respuestas vigentes del
 * municipio. Se imprime en el certificado; si después cambia una respuesta,
 * cambia el código y la certificación cargada queda desactualizada. El nivel
 * de afectación del censo no entra: se muestra como referencia, no se certifica.
 */
var CONF_SI = 'Sí';
var CONF_NO = 'No';
var CONF_QUIEN = ['Alcaldía', 'IE con recursos de gratuidad', 'Ministerio de Educación (MEN)', 'FFIE', 'UNGRD',
  'Póliza / aseguradora', 'Donante', 'Cofinanciación (varias entidades)', 'Cooperación / sector privado'];
// Con estas tres el nombre es obligatorio; con las demás no se pide (y no se guarda).
var CONF_QUIEN_CON_NOMBRE = ['Donante', 'Cofinanciación (varias entidades)', 'Cooperación / sector privado'];
var CONF_ESTADOS_OBRA = ['Planeación', 'Contratación', 'Ejecución', 'Terminada'];
var CONF_NOMBRE_MAX = 200;
var CONF_MAX_POR_PEDIDO = 150; // Riosucio, el municipio más grande, tiene 92 sedes

var CERT_MAX_BYTES = 10 * 1024 * 1024;
// Nombres de PDF que traen contenido activo o que impiden revisar el archivo.
// /JavaScript cubre también las acciones /JS: una acción de JavaScript se
// declara siempre con /S /JavaScript. /OpenAction, /AA y /URI se permiten
// (enlaces y acciones de navegación que traen los PDF de escáner).
var CERT_NOMBRES_PROHIBIDOS = {
  JavaScript: 'trae JavaScript', Launch: 'trae una orden para abrir programas',
  EmbeddedFile: 'trae archivos adjuntos', EmbeddedFiles: 'trae archivos adjuntos',
  RichMedia: 'trae contenido multimedia', XFA: 'es un formulario XFA',
  SubmitForm: 'trae un formulario que envía datos', ImportData: 'trae una orden para importar datos',
  GoToE: 'trae enlaces a documentos incrustados', Encrypt: 'está protegido o cifrado'
};

/* ─── acciones ─── */

function Confirmaciones_listar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  var quien = _confQuien(sesion);
  if (quien.error) return { ok: false, error: quien.error };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasConfirmacionListas(ss)) return { ok: false, error: _CONF_FALTAN_HOJAS };

  var datos = _confDatos(ss, quien.alcalde ? quien.municipio : null);
  var respuesta = { ok: true, sedes: datos.sedes, municipios: datos.municipios };
  if (quien.alcalde) {
    respuesta.alcalde = { nombre: quien.usuario.nombre, municipio: quien.municipio };
  } else {
    var alcaldes = _alcaldesPorMunicipio(ss);
    respuesta.municipios.forEach(function (m) { m.alcaldes = alcaldes[m.municipio] || []; });
  }
  return respuesta;
}

function Confirmaciones_guardar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  var quien = _confQuien(sesion);
  if (quien.error) return { ok: false, error: quien.error };
  if (!quien.alcalde) return { ok: false, error: 'Solo el alcalde registra las respuestas de su municipio' };

  var lista = Array.isArray(body.respuestas) ? body.respuestas : [];
  if (!lista.length) return { ok: false, error: 'No llegó ninguna respuesta para guardar' };
  if (lista.length > CONF_MAX_POR_PEDIDO) return { ok: false, error: 'Máximo ' + CONF_MAX_POR_PEDIDO + ' sedes por pedido' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasConfirmacionListas(ss)) return { ok: false, error: _CONF_FALTAN_HOJAS };

  // Se valida todo antes de tomar el candado. Nunca se confía en lo que manda
  // el navegador: municipio, opciones y reglas se revisan sede por sede.
  var delMunicipio = {};
  _confSedes(ss, quien.municipio).forEach(function (s) { delMunicipio[s.dane_sede] = true; });
  var resultados = [];
  var porDane = {};
  lista.forEach(function (r) {
    var dane = String((r && r.dane_sede) || '').trim();
    if (!delMunicipio[dane]) { resultados.push({ dane_sede: dane, ok: false, error: 'La sede no es de su municipio' }); return; }
    var v = _confValidar(r);
    if (v.error) { resultados.push({ dane_sede: dane, ok: false, error: v.error }); return; }
    porDane[dane] = v; // si la misma sede llega dos veces, vale la última
  });

  var guardadas = 0, sinCambios = 0;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'El sistema está ocupado — intente de nuevo en un momento' };
  try {
    var hoja = ss.getSheetByName('Confirmaciones');
    var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    var cVig = enc.indexOf('vigente') + 1;
    var vigentes = _confVigentes(ss);
    var ahora = new Date();
    var nuevas = [];
    Object.keys(porDane).forEach(function (dane) {
      var v = porDane[dane];
      var actual = vigentes[dane];
      if (actual && _confIgual(actual.datos, v)) {
        sinCambios++;
        resultados.push({ dane_sede: dane, ok: true, sin_cambios: true });
        return;
      }
      // Única escritura sobre filas existentes: apagar `vigente` (D-37).
      if (actual) actual.filas.forEach(function (f) { hoja.getRange(f, cVig).setValue(false); });
      var valores = {
        dane_sede: dane, municipio: quien.municipio, tiene_intervencion: v.tiene_intervencion,
        quien_interviene: v.quien_interviene, nombre_quien_interviene: _confTextoSeguro(v.nombre_quien_interviene),
        estado_obra: v.estado_obra, registrado_por: sesion.correo, fecha_registro: ahora, vigente: true
      };
      nuevas.push(enc.map(function (c) { return valores[c] === undefined ? '' : valores[c]; }));
      resultados.push({ dane_sede: dane, ok: true });
    });
    if (nuevas.length) hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, enc.length).setValues(nuevas);
    guardadas = nuevas.length;
  } finally {
    lock.releaseLock();
  }

  // El estado se recalcula leyendo la hoja, igual que en listar: así el código
  // que ve el navegador es el mismo que verán generar y cargar.
  var datos = _confDatos(ss, quien.municipio);
  return {
    ok: true, guardadas: guardadas, sin_cambios: sinCambios,
    con_error: resultados.filter(function (x) { return !x.ok; }).length,
    resultados: resultados, sedes: datos.sedes, municipios: datos.municipios
  };
}

function Confirmaciones_generarCertificado(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  var quien = _confQuien(sesion);
  if (quien.error) return { ok: false, error: quien.error };
  if (!quien.alcalde) return { ok: false, error: 'Solo el alcalde genera la certificación de su municipio' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasConfirmacionListas(ss)) return { ok: false, error: _CONF_FALTAN_HOJAS };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'El sistema está ocupado — intente de nuevo en un momento' };
  var generado;
  try {
    var m = _confDatos(ss, quien.municipio).municipios[0];
    if (!m) return { ok: false, error: 'No hay sedes registradas para ' + quien.municipio + '. Avise a la Secretaría de Educación.' };
    if (!m.codigo_actual) {
      var faltan = m.n_sedes - m.respondidas;
      return { ok: false, error: 'Faltan ' + faltan + ' sede' + (faltan === 1 ? '' : 's') + ' por responder: la certificación se genera con todas respondidas' };
    }
    // Generar otra vez con las mismas respuestas no crea fila: se reimprime la
    // misma certificación, con su fecha original.
    generado = m.generado;
    if (!generado) {
      var hoja = ss.getSheetByName('Certificaciones');
      var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
      var valores = {
        id_certificacion: _certNuevoId(ss), municipio: quien.municipio, evento: 'GENERADO',
        codigo_verificacion: m.codigo_actual, n_sedes: m.n_sedes, correo: sesion.correo, fecha: new Date()
      };
      hoja.appendRow(enc.map(function (c) { return valores[c] === undefined ? '' : valores[c]; }));
      generado = _certPublica(valores);
    }
  } finally {
    lock.releaseLock();
  }

  var datos = _confDatos(ss, quien.municipio);
  return {
    ok: true,
    certificado: {
      id_certificacion: generado.id_certificacion, codigo_verificacion: generado.codigo_verificacion,
      fecha: generado.fecha, municipio: quien.municipio, alcalde: quien.usuario.nombre, n_sedes: generado.n_sedes
    },
    sedes: datos.sedes, municipios: datos.municipios
  };
}

function Confirmaciones_subirCertificado(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  var quien = _confQuien(sesion);
  if (quien.error) return { ok: false, error: quien.error };
  if (!quien.alcalde) return { ok: false, error: 'Solo el alcalde carga la certificación de su municipio' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasConfirmacionListas(ss)) return { ok: false, error: _CONF_FALTAN_HOJAS };

  var b64 = String(body.contenido_base64 || '').replace(/^data:[^,]*,/, '');
  if (!b64) return { ok: false, error: 'No llegó el archivo' };
  var bytes;
  try {
    bytes = Utilities.base64Decode(b64);
  } catch (e) {
    return { ok: false, error: 'El archivo llegó dañado. Intente cargarlo de nuevo.' };
  }
  var revision = _certValidarPdf(bytes);
  if (revision.error) return { ok: false, error: revision.error };
  var sha = _hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));

  // Primero se revisa el estado sin candado, para no escribir en Drive algo
  // que después se va a rechazar.
  var m0 = _confDatos(ss, quien.municipio).municipios[0];
  var previo = _confPuedeCargar(m0, sha);
  if (previo.error) return { ok: false, error: previo.error };
  if (previo.repetido) return _confRespuestaCargue(ss, quien.municipio, previo.repetido, true);

  // Drive fuera del candado: subir 10 MB puede tardar, y el candado es de todo
  // el script (detendría a los demás alcaldes mientras tanto).
  var marca = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyyMMdd_HHmmss');
  var codigo = m0.codigo_actual;
  var nombreArchivo = 'Certificacion_' + _confSinTildes(quien.municipio) + '_' + codigo + '_' + marca + '.pdf';
  var archivo = _carpetaCertificados(quien.municipio).createFile(Utilities.newBlob(bytes, 'application/pdf', nombreArchivo));

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    archivo.setTrashed(true);
    return { ok: false, error: 'El sistema está ocupado — intente de nuevo en un momento' };
  }
  var fila;
  try {
    // Se revisa otra vez dentro del candado: una respuesta pudo cambiar mientras subía.
    var m = _confDatos(ss, quien.municipio).municipios[0];
    var ahora = _confPuedeCargar(m, sha);
    if (ahora.error || ahora.repetido || m.codigo_actual !== codigo) {
      archivo.setTrashed(true);
      if (ahora.repetido) return _confRespuestaCargue(ss, quien.municipio, ahora.repetido, true);
      return { ok: false, error: ahora.error || 'Una respuesta cambió mientras se cargaba el archivo. Genere la certificación de nuevo.' };
    }
    var hoja = ss.getSheetByName('Certificaciones');
    var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    fila = {
      id_certificacion: _certNuevoId(ss), municipio: quien.municipio, evento: 'CARGADO',
      codigo_verificacion: codigo, n_sedes: m.n_sedes, correo: sesion.correo, fecha: new Date(),
      archivo_id: archivo.getId(), archivo_nombre: nombreArchivo, tamano_bytes: bytes.length, sha256: sha
    };
    hoja.appendRow(enc.map(function (c) { return fila[c] === undefined ? '' : fila[c]; }));
  } finally {
    lock.releaseLock();
  }
  return _confRespuestaCargue(ss, quien.municipio, _certPublica(fila), false);
}

function Confirmaciones_descargarCertificado(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  var quien = _confQuien(sesion);
  if (quien.error) return { ok: false, error: quien.error };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_hojasConfirmacionListas(ss)) return { ok: false, error: _CONF_FALTAN_HOJAS };

  var id = String(body.id_certificacion || '');
  var fila = null;
  _certFilas(ss).forEach(function (c) { if (c.id_certificacion === id && c.evento === 'CARGADO') fila = c; });
  if (!fila) return { ok: false, error: 'No existe esa certificación cargada' };
  if (quien.alcalde && fila.municipio !== quien.municipio) return { ok: false, error: 'Esa certificación no es de su municipio' };

  var archivo;
  try {
    archivo = DriveApp.getFileById(String(fila.archivo_id));
  } catch (e) {
    return { ok: false, error: 'No se encontró el archivo en Drive. Avise al administrador del sistema.' };
  }
  var bytes = archivo.getBlob().getBytes();
  return {
    ok: true, id_certificacion: id, nombre: String(fila.archivo_nombre), tamano_bytes: bytes.length,
    contenido_base64: Utilities.base64Encode(bytes)
  };
}

/* ─── quién pregunta ─── */

var _CONF_FALTAN_HOJAS = 'Faltan las hojas Confirmaciones y Certificaciones: corra crearHojas() en el editor de Apps Script';

function _hojasConfirmacionListas(ss) {
  return !!ss.getSheetByName('Confirmaciones') && !!ss.getSheetByName('Certificaciones');
}

// {interno:true} para la Secretaría; {alcalde:true, municipio, usuario} para
// un alcalde; {error} para cualquier otro (rectores incluidos). El tipo se lee
// de Usuarios en cada pedido: el token no lo trae.
function _confQuien(sesion) {
  if (sesion.rol === 'ADMINISTRADOR' || sesion.rol === 'VERIFICADOR' || sesion.rol === 'CONSULTA') return { interno: true };
  if (sesion.rol !== 'RESPONSABLE_SEDE') return { error: 'Su rol no tiene acceso a la confirmación de sedes' };
  var usuario = _buscarUsuario(_normalizarCorreo(sesion.correo));
  if (!usuario || String(usuario.tipo) !== 'alcalde') return { error: 'La confirmación de sedes es solo para los alcaldes' };
  return { alcalde: true, municipio: String(usuario.alcance || ''), usuario: usuario };
}

/* ─── lectura ─── */

// Sedes del catálogo (todas las del municipio, o las 975), ordenadas como
// salen en la pantalla y en el certificado: municipio, institución, sede.
function _confSedes(ss, municipio) {
  var datos = ss.getSheetByName('Sedes').getDataRange().getValues();
  var enc = datos[0];
  var c = function (n) { return enc.indexOf(n); };
  var sedes = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var muni = String(f[c('municipio')]);
    if (municipio && muni !== municipio) continue;
    sedes.push({
      dane_sede: String(f[c('dane_sede')]), municipio: muni, institucion: String(f[c('institucion')] || ''),
      sede: String(f[c('sede')] || ''), tipo_censo: String(f[c('tipo_censo')] || '')
    });
  }
  sedes.sort(function (a, b) {
    return a.municipio.localeCompare(b.municipio, 'es') || a.institucion.localeCompare(b.institucion, 'es') ||
      a.sede.localeCompare(b.sede, 'es') || a.dane_sede.localeCompare(b.dane_sede);
  });
  return sedes;
}

// dane_sede -> { filas: [filas reales con vigente=TRUE], datos: la más reciente }.
function _confVigentes(ss) {
  var datos = ss.getSheetByName('Confirmaciones').getDataRange().getValues();
  var enc = datos[0];
  var cDane = enc.indexOf('dane_sede'), cVig = enc.indexOf('vigente');
  var porDane = {};
  for (var i = 1; i < datos.length; i++) {
    if (!_verdadero(datos[i][cVig])) continue;
    var obj = {};
    enc.forEach(function (col, j) { obj[col] = datos[i][j]; });
    var dane = String(datos[i][cDane]);
    if (!porDane[dane]) porDane[dane] = { filas: [], datos: null };
    porDane[dane].filas.push(i + 1);
    porDane[dane].datos = obj;
  }
  return porDane;
}

function _certFilas(ss) {
  var datos = ss.getSheetByName('Certificaciones').getDataRange().getValues();
  var enc = datos[0];
  var filas = [];
  for (var i = 1; i < datos.length; i++) {
    var obj = {};
    enc.forEach(function (col, j) { obj[col] = datos[i][j]; });
    obj.id_certificacion = String(obj.id_certificacion);
    obj.municipio = String(obj.municipio);
    obj.evento = String(obj.evento);
    obj.codigo_verificacion = String(obj.codigo_verificacion);
    filas.push(obj);
  }
  return filas; // en orden de la hoja = orden en que ocurrieron
}

// Lo que viaja al navegador de una fila de Certificaciones (sin el id de Drive).
function _certPublica(c) {
  return {
    id_certificacion: String(c.id_certificacion), evento: String(c.evento),
    codigo_verificacion: String(c.codigo_verificacion), n_sedes: Number(c.n_sedes) || 0,
    correo: String(c.correo || ''), fecha: c.fecha, archivo_nombre: String(c.archivo_nombre || ''),
    tamano_bytes: Number(c.tamano_bytes) || 0, sha256: String(c.sha256 || '')
  };
}

function _confPublica(d) {
  return {
    tiene_intervencion: String(d.tiene_intervencion || ''), quien_interviene: String(d.quien_interviene || ''),
    nombre_quien_interviene: String(d.nombre_quien_interviene || ''), estado_obra: String(d.estado_obra || ''),
    registrado_por: String(d.registrado_por || ''), fecha_registro: d.fecha_registro
  };
}

// Sedes con su respuesta vigente y el estado de cada municipio, leyendo las
// tres hojas una vez. `municipio` null = los 26.
function _confDatos(ss, municipio) {
  var sedes = _confSedes(ss, municipio);
  var vigentes = _confVigentes(ss);
  var certs = _certFilas(ss);
  var porMuni = {};
  var orden = [];
  sedes.forEach(function (s) {
    var v = vigentes[s.dane_sede];
    s.respuesta = v ? _confPublica(v.datos) : null;
    if (!porMuni[s.municipio]) { porMuni[s.municipio] = []; orden.push(s.municipio); }
    porMuni[s.municipio].push(s);
  });
  var certsPorMuni = {};
  certs.forEach(function (c) { (certsPorMuni[c.municipio] = certsPorMuni[c.municipio] || []).push(c); });
  return {
    sedes: sedes,
    municipios: orden.map(function (m) { return _confEstadoMunicipio(m, porMuni[m], certsPorMuni[m] || []); })
  };
}

// Estado de un municipio. Lo calcula solo el servidor, para que la pantalla
// del alcalde y el panel de la Secretaría digan siempre lo mismo.
function _confEstadoMunicipio(municipio, sedes, certs) {
  var n = sedes.length;
  var respondidas = 0, con = 0, sin = 0;
  var porEstado = {};
  CONF_ESTADOS_OBRA.forEach(function (e) { porEstado[e] = 0; });
  sedes.forEach(function (s) {
    if (!s.respuesta) return;
    respondidas++;
    if (s.respuesta.tiene_intervencion === CONF_SI) {
      con++;
      if (porEstado[s.respuesta.estado_obra] !== undefined) porEstado[s.respuesta.estado_obra]++;
    } else {
      sin++;
    }
  });
  var codigo = n > 0 && respondidas === n ? _confCodigo(municipio, sedes) : null;
  var generado = null, cargado = null, ultimoCargado = null;
  certs.forEach(function (c) {
    if (c.evento === 'CARGADO') ultimoCargado = c;
    if (!codigo || c.codigo_verificacion !== codigo) return;
    if (c.evento === 'GENERADO' && !generado) generado = c; // la primera: su fecha es la de la certificación
    if (c.evento === 'CARGADO') cargado = c; // la más reciente
  });
  var estado = cargado ? 'CARGADA' : (generado ? 'GENERADA' : (ultimoCargado ? 'DESACTUALIZADA'
    : (codigo ? 'POR_GENERAR' : (respondidas ? 'EN_DILIGENCIAMIENTO' : 'SIN_EMPEZAR'))));
  return {
    municipio: municipio, n_sedes: n, respondidas: respondidas, con_intervencion: con, sin_intervencion: sin,
    por_estado_obra: porEstado, codigo_actual: codigo, estado: estado,
    generado: generado ? _certPublica(generado) : null,
    cargado: cargado ? _certPublica(cargado) : null,
    // Hubo una certificación cargada que ya no corresponde a las respuestas actuales.
    cargada_desactualizada: !!ultimoCargado && !cargado,
    certificaciones: certs.slice().reverse().map(_certPublica) // la más reciente primero
  };
}

// municipio -> [{nombre, correo, activo}] de los usuarios alcalde, para el panel.
function _alcaldesPorMunicipio(ss) {
  var datos = ss.getSheetByName('Usuarios').getDataRange().getValues();
  var enc = datos[0];
  var c = function (n) { return enc.indexOf(n); };
  var porMuni = {};
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    if (String(f[c('tipo')]) !== 'alcalde') continue;
    var muni = String(f[c('alcance')] || '');
    (porMuni[muni] = porMuni[muni] || []).push({
      nombre: String(f[c('nombre')] || ''), correo: _normalizarCorreo(f[c('correo')]), activo: _verdadero(f[c('activo')])
    });
  }
  return porMuni;
}

/* ─── reglas ─── */

// Normaliza y valida una respuesta. Devuelve {error} o los cuatro campos listos
// para guardar. Con «No», quién, nombre y estado quedan vacíos aunque lleguen.
function _confValidar(r) {
  var tiene = String((r && r.tiene_intervencion) || '').trim();
  if (tiene !== CONF_SI && tiene !== CONF_NO) return { error: 'Responda Sí o No a la pregunta de intervención' };
  if (tiene === CONF_NO) return { tiene_intervencion: CONF_NO, quien_interviene: '', nombre_quien_interviene: '', estado_obra: '' };

  var quien = String(r.quien_interviene || '').trim();
  if (CONF_QUIEN.indexOf(quien) === -1) return { error: 'Elija quién interviene' };
  var estado = String(r.estado_obra || '').trim();
  if (CONF_ESTADOS_OBRA.indexOf(estado) === -1) return { error: 'Elija el estado de la obra' };
  var nombre = '';
  if (CONF_QUIEN_CON_NOMBRE.indexOf(quien) !== -1) {
    nombre = String(r.nombre_quien_interviene || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!nombre) return { error: 'Escriba el nombre de quién interviene (obligatorio con ' + quien + ')' };
    if (nombre.length > CONF_NOMBRE_MAX) return { error: 'El nombre admite máximo ' + CONF_NOMBRE_MAX + ' caracteres' };
  }
  return { tiene_intervencion: CONF_SI, quien_interviene: quien, nombre_quien_interviene: nombre, estado_obra: estado };
}

function _confIgual(guardado, v) {
  return String(guardado.tiene_intervencion || '') === v.tiene_intervencion &&
    String(guardado.quien_interviene || '') === v.quien_interviene &&
    String(guardado.nombre_quien_interviene || '') === v.nombre_quien_interviene &&
    String(guardado.estado_obra || '') === v.estado_obra;
}

// Un texto que empieza por = + - @ lo interpretaría la hoja como fórmula. El
// apóstrofo inicial lo guarda como texto y la hoja no lo devuelve al leer.
function _confTextoSeguro(t) {
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

// Huella de las respuestas: municipio y, por cada sede ordenada por DANE, las
// cuatro respuestas. XXXX-XXXX-XXXX (12 caracteres hexadecimales).
function _confCodigo(municipio, sedes) {
  var lineas = sedes.map(function (s) {
    var r = s.respuesta;
    return [s.dane_sede, r.tiene_intervencion, r.quien_interviene, r.nombre_quien_interviene, r.estado_obra].join('|');
  }).sort();
  var hex = _hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, municipio + '\n' + lineas.join('\n'),
    Utilities.Charset.UTF_8)).toUpperCase();
  return hex.slice(0, 4) + '-' + hex.slice(4, 8) + '-' + hex.slice(8, 12);
}

function _hex(bytes) {
  return bytes.map(function (b) { return ((b & 0xFF) + 0x100).toString(16).slice(1); }).join('');
}

// Si se puede cargar un PDF con estas respuestas: {error}, {repetido: fila} si
// ese mismo archivo ya se cargó con el código actual, o {} si se puede.
function _confPuedeCargar(m, sha) {
  if (!m || !m.codigo_actual) return { error: 'Faltan sedes por responder: responda todas, genere la certificación y después cárguela' };
  if (!m.generado) {
    var huboGenerada = m.certificaciones.some(function (c) { return c.evento === 'GENERADO'; });
    return { error: huboGenerada
      ? 'Sus respuestas cambiaron después de generar la certificación. Genere una nueva, fírmela y cárguela.'
      : 'Primero genere la certificación, imprímala y fírmela; después cárguela.' };
  }
  var repetido = null;
  m.certificaciones.forEach(function (c) {
    if (!repetido && c.evento === 'CARGADO' && c.sha256 === sha && c.codigo_verificacion === m.codigo_actual) repetido = c;
  });
  return repetido ? { repetido: repetido } : {};
}

function _confRespuestaCargue(ss, municipio, fila, yaEstaba) {
  var datos = _confDatos(ss, municipio);
  return { ok: true, ya_estaba: yaEstaba, certificado: fila, sedes: datos.sedes, municipios: datos.municipios };
}

function _certNuevoId(ss) {
  var mayor = 0;
  _certFilas(ss).forEach(function (c) {
    var n = Number(String(c.id_certificacion).replace(/^C-/, ''));
    if (n > mayor) mayor = n;
  });
  return 'C-' + (mayor + 1);
}

/* ─── el PDF ─── */

// Revisión propia del PDF firmado (D-48: sin antivirus, aceptado por el
// usuario). Lo que viaja comprimido dentro del PDF no se inspecciona.
function _certValidarPdf(bytes) {
  if (bytes.length > CERT_MAX_BYTES) {
    return { error: 'El archivo supera el máximo de 10 MB (pesa ' + (bytes.length / 1048576).toFixed(1).replace('.', ',') +
      ' MB). Escanéelo en blanco y negro o en escala de grises, a 150 o 200 ppp.' };
  }
  if (bytes.length < 64) return { error: 'El archivo está vacío o incompleto' };
  var cabecera = '';
  for (var i = 0; i < 5; i++) cabecera += String.fromCharCode(bytes[i] & 0xFF);
  if (cabecera !== '%PDF-') return { error: 'El archivo no es un PDF. Escanee la certificación firmada como PDF.' };

  var texto = Utilities.newBlob(bytes).getDataAsString('ISO-8859-1');
  if (texto.slice(-1024).indexOf('%%EOF') === -1) {
    return { error: 'El PDF está incompleto: no termina como un PDF. Vuelva a escanearlo o a guardarlo.' };
  }
  // Cada nombre de PDF (/Nombre), también escrito con #xx (/J#61vaScript).
  var re = /\/([^\s\/<>\[\]\(\)\{\}%]+)/g;
  var m;
  while ((m = re.exec(texto)) !== null) {
    var nombre = m[1].indexOf('#') === -1 ? m[1]
      : m[1].replace(/#([0-9A-Fa-f]{2})/g, function (x, h) { return String.fromCharCode(parseInt(h, 16)); });
    if (Object.prototype.hasOwnProperty.call(CERT_NOMBRES_PROHIBIDOS, nombre)) {
      return { error: 'El PDF ' + CERT_NOMBRES_PROHIBIDOS[nombre] + ' y no se admite. Escanee el documento firmado ' +
        'directamente a PDF, sin contraseña, formularios ni archivos adjuntos.' };
    }
  }
  return {};
}

// Carpeta raíz propia, SIN compartir (a diferencia de las fotos, D-42): los
// PDF firmados solo los descarga la Secretaría desde la aplicación. Una
// subcarpeta por municipio.
function _carpetaCertificados(municipio) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CERT_CARPETA_RAIZ_ID');
  var raiz = null;
  if (id) {
    try { raiz = DriveApp.getFolderById(id); } catch (e) { raiz = null; }
  }
  if (!raiz) {
    raiz = DriveApp.createFolder('Reconstrucción de sedes — Certificaciones de alcaldes');
    props.setProperty('CERT_CARPETA_RAIZ_ID', raiz.getId());
  }
  var existentes = raiz.getFoldersByName(municipio);
  return existentes.hasNext() ? existentes.next() : raiz.createFolder(municipio);
}

function _confSinTildes(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');
}
