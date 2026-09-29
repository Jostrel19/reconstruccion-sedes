/**
 * Punto de entrada del Web App (D-19). doGet responde un ping simple para
 * confirmar que el despliegue sigue vivo (mismo formato que la prueba de
 * docs/PRUEBA_DESPLIEGUE_APPS_SCRIPT.md). Toda la escritura real pasa por
 * doPost, con la acción en el cuerpo JSON: {"accion": "...", ...}.
 *
 * Cada respuesta de doPost devuelve `accion` (la que se pidió). Medido el
 * 2026-09-24: con pedidos simultáneos, Apps Script a veces responde a un POST
 * con lo de doGet — la acción no se ejecutó, pero llegaba {ok:true}. Con
 * `accion` en la respuesta, el navegador comprueba que lo que recibió es la
 * respuesta de SU pedido y, si no, reintenta (mockup_v6.html, backend()).
 */
function doGet(e) {
  return _json({
    ok: true,
    mensaje: 'Backend reconstruccion de sedes',
    hora: new Date().toISOString()
  });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return _json({ ok: false, error: 'Cuerpo no es JSON válido' });
  }

  // Registro de acciones: cada módulo agrega las suyas acá.
  var manejadores = {
    solicitarCodigo: Auth_solicitarCodigo,
    validarCodigo: Auth_validarCodigo,
    listarSedes: Sedes_listar,
    obtenerPresupuesto: Presupuestos_obtener,
    guardarPresupuesto: Presupuestos_guardar,
    volcarCarga: Presupuestos_volcarCarga,
    obtenerBandejaVerificacion: Verificaciones_bandeja,
    emitirConcepto: Verificaciones_emitir,
    subirFoto: Fotos_subir,
    listarFotos: Fotos_listar,
    listarHallazgos: Hallazgos_listar,
    resolverHallazgo: Hallazgos_resolver,
    listarUsuarios: Usuarios_listar,
    crearUsuario: Usuarios_crear,
    actualizarUsuario: Usuarios_actualizar,
    // D-44: lotes creados por el Administrador
    listarLotes: Lotes_listar,
    crearLote: Lotes_crear,
    agregarSedesLote: Lotes_agregarSedes,
    quitarSedeLote: Lotes_quitarSede,
    cerrarLote: Lotes_cerrar,
    // D-48: confirmación de sedes por los alcaldes (Confirmaciones.gs)
    listarConfirmaciones: Confirmaciones_listar,
    guardarConfirmaciones: Confirmaciones_guardar,
    generarCertificado: Confirmaciones_generarCertificado,
    subirCertificado: Confirmaciones_subirCertificado,
    descargarCertificado: Confirmaciones_descargarCertificado
  };

  var accion = String(body.accion || '');
  var manejador = manejadores[accion];
  if (!manejador) {
    return _json({ ok: false, accion: accion, error: 'Acción desconocida: ' + accion });
  }

  var bloqueo = _bloqueoCampana(accion, body);
  if (bloqueo) return _json({ ok: false, accion: accion, error: bloqueo });

  var resultado;
  try {
    resultado = manejador(body);
  } catch (err) {
    resultado = { ok: false, error: String(err) };
  }
  resultado.accion = accion;
  return _json(resultado);
}

/**
 * Campaña de confirmación de sedes (D-48, D-49): mientras dure, un Responsable
 * de sede (alcalde o rector) solo puede usar la confirmación, aunque llame a la
 * API a mano desde la consola del navegador. Antes la regla era solo de la
 * pantalla (nucleo.js::CAMPANA_CONFIRMACION) y en el servidor el alcalde
 * conservaba los permisos de D-24: podía radicar presupuestos o subir fotos de
 * su municipio (auditoría de seguridad del 2026-09-29, hallazgo 3.3).
 *
 * Se apaga sin volver a desplegar: propiedad del script CAMPANA_CONFIRMACION =
 * false (Configuración del proyecto > Propiedades del script). Si la propiedad
 * no existe, la campaña cuenta como encendida: es el lado seguro.
 */
var ACCIONES_SIN_SESION = { solicitarCodigo: true, validarCodigo: true };
var ACCIONES_CAMPANA = { listarConfirmaciones: true, guardarConfirmaciones: true, generarCertificado: true,
  subirCertificado: true, descargarCertificado: true };

function _campanaActiva() {
  var v = PropertiesService.getScriptProperties().getProperty('CAMPANA_CONFIRMACION');
  return String(v == null ? 'true' : v).trim().toLowerCase() !== 'false';
}

// Mensaje de rechazo, o '' si la acción sigue su curso normal. Sin sesión válida
// no se bloquea aquí: el manejador responde «Sesión inválida o vencida».
function _bloqueoCampana(accion, body) {
  if (ACCIONES_SIN_SESION[accion] || ACCIONES_CAMPANA[accion]) return '';
  var sesion;
  try { sesion = verificarToken(body.token); } catch (e) { return ''; }
  if (!sesion || sesion.rol !== 'RESPONSABLE_SEDE' || !_campanaActiva()) return '';
  return 'Durante la confirmación de sedes solo está disponible la pantalla de confirmación.';
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
