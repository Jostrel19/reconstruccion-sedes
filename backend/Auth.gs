/**
 * Login por código de un solo uso (D-20). Nada de usuario/contraseña ni de
 * Google Sign-In: se escribe el correo institucional, llega un código de 6
 * dígitos por MailApp (SMTP normal — le llega igual a Outlook, confirmado en
 * docs/PRUEBA_DESPLIEGUE_APPS_SCRIPT.md) y se cambia por un token de sesión.
 *
 * Regla dura de D-20: si el correo no está en Usuarios, NO se manda nada —
 * pero se responde {ok:true} de todas formas, para que no se pueda usar esta
 * acción para averiguar quién tiene cuenta.
 *
 * Límite de frecuencia: máximo un código nuevo por correo cada 60 segundos.
 * Se aplica ANTES de mirar si el correo existe, y con la misma respuesta
 * {ok:true} en cualquier caso — si el límite solo se aplicara a correos
 * reales, la respuesta distinta ya delataría cuáles existen.
 *
 * Límite de intentos: máximo 5 intentos fallidos por código. Al llegar al
 * límite, el código vigente se invalida (hay que pedir uno nuevo) — sin esto,
 * nada impedía a un script probar las 999.999 combinaciones dentro de la
 * ventana de 10 minutos.
 */
var OTP_MINUTOS = 10;
var SESION_HORAS = 12;
var COOLDOWN_SEGUNDOS = 60;
var MAX_INTENTOS = 5;

function Auth_solicitarCodigo(body) {
  var correo = _normalizarCorreo(body.correo);
  var cache = CacheService.getScriptCache();

  var cooldownKey = 'cooldown_' + correo;
  if (cache.get(cooldownKey)) {
    return { ok: true }; // ya se mandó uno hace poco; no se manda otro
  }
  cache.put(cooldownKey, '1', COOLDOWN_SEGUNDOS);

  var usuario = _buscarUsuario(correo);
  if (usuario && usuario.activo) {
    var codigo = String(Math.floor(100000 + Math.random() * 900000));
    cache.put('otp_' + correo, codigo, OTP_MINUTOS * 60);
    cache.remove('intentos_' + correo); // código nuevo, cuenta de intentos vuelve a cero
    MailApp.sendEmail(correo,
      'Código de acceso - Reconstrucción de sedes',
      'Su código de acceso es ' + codigo + '.\n\n' +
      'Vence en ' + OTP_MINUTOS + ' minutos y es de un solo uso. ' +
      'Si usted no lo solicitó, ignore este correo.');
  }

  return { ok: true };
}

function Auth_validarCodigo(body) {
  var correo = _normalizarCorreo(body.correo);
  var codigo = String(body.codigo || '').trim();
  var cache = CacheService.getScriptCache();

  var intentosKey = 'intentos_' + correo;
  var intentos = Number(cache.get(intentosKey) || 0);
  if (intentos >= MAX_INTENTOS) {
    cache.remove('otp_' + correo); // se acabaron los intentos: el código ya no sirve
    return { ok: false, error: 'Código inválido o vencido' };
  }

  var guardado = cache.get('otp_' + correo);
  if (!guardado || guardado !== codigo) {
    cache.put(intentosKey, String(intentos + 1), OTP_MINUTOS * 60);
    return { ok: false, error: 'Código inválido o vencido' };
  }

  cache.remove('otp_' + correo);
  cache.remove(intentosKey);

  var usuario = _buscarUsuario(correo);
  if (!usuario || !usuario.activo) {
    return { ok: false, error: 'Usuario no autorizado' };
  }

  return {
    ok: true,
    token: _crearToken(usuario),
    rol: usuario.rol,
    nombre: usuario.nombre,
    alcance: usuario.alcance
  };
}

function _normalizarCorreo(c) {
  return String(c || '').trim().toLowerCase();
}

function _buscarUsuario(correo) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  var datos = hoja.getDataRange().getValues();
  var encabezados = datos[0];
  var colCorreo = encabezados.indexOf('correo');

  for (var i = 1; i < datos.length; i++) {
    if (_normalizarCorreo(datos[i][colCorreo]) === correo) {
      var usuario = {};
      encabezados.forEach(function (col, j) { usuario[col] = datos[i][j]; });
      usuario.activo = (usuario.activo === true ||
        String(usuario.activo).toUpperCase() === 'TRUE');
      return usuario;
    }
  }
  return null;
}

/** Secreto de firma, generado una vez y guardado en las propiedades del
 * proyecto — no viaja en el código ni en el Sheet. */
function _secreto() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('TOKEN_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', s);
  }
  return s;
}

function _crearToken(usuario) {
  var payload = {
    correo: usuario.correo,
    rol: usuario.rol,
    alcance: usuario.alcance,
    exp: Date.now() + SESION_HORAS * 60 * 60 * 1000
  };
  var payloadCod = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var firma = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadCod, _secreto())
  );
  return payloadCod + '.' + firma;
}

/** Usada por cualquier otro módulo (Sedes, Presupuestos, ...) para validar el
 * token que llega en cada petición. Devuelve el payload {correo, rol,
 * alcance, exp} si es válido y no venció, o null si no.
 *
 * Además de la firma y el vencimiento, el usuario tiene que seguir activo y
 * con el mismo rol y alcance que tenía al entrar: desde 2026-09-24 la sesión
 * sobrevive a recargar la página (sessionStorage), así que sin esta
 * comprobación desactivar a alguien no cortaba su sesión hasta 12 h después.
 * El estado de Usuarios se guarda en caché ACTIVOS_CACHE_SEG segundos para no
 * leer la hoja en cada petición; Usuarios_crear/actualizar la invalidan. */
function verificarToken(token) {
  if (!token) return null;
  var partes = String(token).split('.');
  if (partes.length !== 2) return null;

  var esperada = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(partes[0], _secreto())
  );
  if (esperada !== partes[1]) return null;

  var payload = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString()
  );
  if (Date.now() > payload.exp) return null;

  var vigente = _usuariosActivos()[_normalizarCorreo(payload.correo)];
  if (!vigente || vigente !== _firmaPermisos(payload.rol, payload.alcance)) return null;
  return payload;
}

var ACTIVOS_CACHE_SEG = 300;

// correo -> "rol|alcance" de cada usuario activo. Un token cuyo rol o alcance
// ya no coincide con la hoja deja de valer: la persona entra de nuevo y
// recibe los permisos actuales.
function _usuariosActivos() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('usuarios_activos');
  if (guardado) return JSON.parse(guardado);

  var datos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios').getDataRange().getValues();
  var enc = datos[0];
  var cCorreo = enc.indexOf('correo'), cRol = enc.indexOf('rol');
  var cAlcance = enc.indexOf('alcance'), cActivo = enc.indexOf('activo');
  var activos = {};
  for (var i = 1; i < datos.length; i++) {
    var activo = datos[i][cActivo] === true || String(datos[i][cActivo]).toUpperCase() === 'TRUE';
    if (!activo) continue;
    activos[_normalizarCorreo(datos[i][cCorreo])] = _firmaPermisos(datos[i][cRol], datos[i][cAlcance]);
  }
  cache.put('usuarios_activos', JSON.stringify(activos), ACTIVOS_CACHE_SEG);
  return activos;
}

function _firmaPermisos(rol, alcance) {
  return String(rol || '') + '|' + String(alcance || '');
}

function _olvidarUsuariosActivos() {
  CacheService.getScriptCache().remove('usuarios_activos');
}
