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
 *
 * Tope de envíos (D-49): máximo CODIGOS_MAX códigos SIN USAR por dirección en
 * CODIGOS_VENTANA_SEG. La cuenta de Gmail manda 100 correos al día en total;
 * con solo el límite de 60 s, un programa que pidiera códigos para los correos
 * registrados que son públicos agotaba el cupo en minutos y nadie más podía
 * entrar ese día (auditoría de seguridad del 2026-09-29, hallazgo 5.1). Al
 * llegar al tope no se manda otro y se responde {ok:true} igual que siempre:
 * sigue valiendo el último código enviado. Entrar con un código reinicia la
 * cuenta (quien entra es el dueño del correo; un atacante nunca entra), así que
 * el tope no le estorba a un usuario normal. Si alguien legítimo queda sin poder
 * pedir código, desactivarlo y volverlo a activar en Usuarios le libera el tope
 * (Usuarios.gs::Usuarios_actualizar).
 */
var OTP_MINUTOS = 10;
var SESION_HORAS = 12;
var COOLDOWN_SEGUNDOS = 60;
var MAX_INTENTOS = 5;
var MAIL_REMITENTE = 'Secretaría de Educación de Caldas';
var CODIGOS_MAX = 3;
var CODIGOS_VENTANA_SEG = 6 * 60 * 60; // 6 h: lo máximo que guarda CacheService

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
    // Envíos de las últimas CODIGOS_VENTANA_SEG (ventana móvil: cada envío
    // libera un cupo cuando cumple 6 horas).
    var enviosKey = 'envios_' + correo;
    var ahora = Date.now();
    var envios = JSON.parse(cache.get(enviosKey) || '[]').filter(function (t) {
      return ahora - t < CODIGOS_VENTANA_SEG * 1000;
    });
    if (envios.length >= CODIGOS_MAX) return { ok: true };
    if (MailApp.getRemainingDailyQuota() < 1) {
      return { ok: false, error: 'Hoy ya no se pueden enviar más códigos: se alcanzó el límite diario de correos del sistema. ' +
        'Intente mañana o comuníquese con la Secretaría de Educación.' };
    }

    var codigo = String(Math.floor(100000 + Math.random() * 900000));
    cache.put('otp_' + correo, codigo, OTP_MINUTOS * 60);
    cache.remove('intentos_' + correo); // código nuevo, cuenta de intentos vuelve a cero
    // `name` es el nombre que ve quien recibe (la dirección sigue siendo la de la
    // cuenta que despliega, D-19): sin él, el correo llegaba a nombre de una
    // persona y un alcalde podía tomarlo por fraude o no encontrarlo.
    MailApp.sendEmail(correo,
      'Código de acceso - Reconstrucción de sedes',
      'Su código de acceso es: ' + codigo + '\n\n' +
      'Escríbalo en la página donde lo pidió y pulse «Entrar». Vence en ' + OTP_MINUTOS +
      ' minutos y sirve una sola vez. Si pidió varios, use el último que le llegó.\n\n' +
      'Mientras diligencia, no cierre esa pestaña ni el navegador: si la cierra, tendrá que pedir un código nuevo. ' +
      'Guarde sus respuestas a medida que avanza.\n\n' +
      'No comparta este código. Si usted no lo solicitó, ignore este correo.\n\n' +
      'Secretaría de Educación de Caldas', { name: MAIL_REMITENTE });
    envios.push(ahora);
    cache.put(enviosKey, JSON.stringify(envios), CODIGOS_VENTANA_SEG);
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
  _liberarTopeCodigos(correo); // entró el dueño del correo: la cuenta de envíos vuelve a cero

  var usuario = _buscarUsuario(correo);
  if (!usuario || !usuario.activo) {
    return { ok: false, error: 'Usuario no autorizado' };
  }

  return {
    ok: true,
    token: _crearToken(usuario),
    rol: usuario.rol,
    // D-48: durante la campaña de confirmación, el navegador lleva al alcalde
    // directo a su pantalla. Solo decide qué se muestra: los permisos los
    // vuelve a revisar el servidor en cada acción (Confirmaciones.gs::_confQuien).
    tipo: usuario.tipo,
    nombre: usuario.nombre,
    alcance: usuario.alcance
  };
}

function _liberarTopeCodigos(correo) {
  CacheService.getScriptCache().remove('envios_' + _normalizarCorreo(correo));
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
