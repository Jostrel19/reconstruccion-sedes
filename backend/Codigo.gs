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
    cerrarLote: Lotes_cerrar
  };

  var accion = String(body.accion || '');
  var manejador = manejadores[accion];
  if (!manejador) {
    return _json({ ok: false, accion: accion, error: 'Acción desconocida: ' + accion });
  }

  var resultado;
  try {
    resultado = manejador(body);
  } catch (err) {
    resultado = { ok: false, error: String(err) };
  }
  resultado.accion = accion;
  return _json(resultado);
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
