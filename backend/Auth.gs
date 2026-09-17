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
 */
var OTP_MINUTOS = 10;
var SESION_HORAS = 12;
var COOLDOWN_SEGUNDOS = 60;

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

  var guardado = CacheService.getScriptCache().get('otp_' + correo);
  if (!guardado || guardado !== codigo) {
    return { ok: false, error: 'Código inválido o vencido' };
  }
  CacheService.getScriptCache().remove('otp_' + correo);

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
 * alcance, exp} si es válido y no venció, o null si no. */
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
  return payload;
}
