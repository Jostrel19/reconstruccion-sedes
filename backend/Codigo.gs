/**
 * Punto de entrada del Web App (D-19). doGet responde un ping simple para
 * confirmar que el despliegue sigue vivo (mismo formato que la prueba de
 * docs/PRUEBA_DESPLIEGUE_APPS_SCRIPT.md). Toda la escritura real pasa por
 * doPost, con la acción en el cuerpo JSON: {"accion": "...", ...}.
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

  // Registro de acciones: cada módulo agrega las suyas acá a medida que se
  // construye (Paso 1 ya trae login; Presupuestos/Verificaciones/Hallazgos
  // se suman en los pasos siguientes del plan).
  var manejadores = {
    solicitarCodigo: Auth_solicitarCodigo,
    validarCodigo: Auth_validarCodigo,
    listarSedes: Sedes_listar,
    obtenerPresupuesto: Presupuestos_obtener,
    guardarPresupuesto: Presupuestos_guardar
  };

  var manejador = manejadores[body.accion];
  if (!manejador) {
    return _json({ ok: false, error: 'Acción desconocida: ' + body.accion });
  }

  try {
    return _json(manejador(body));
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
