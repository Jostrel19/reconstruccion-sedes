/**
 * Registro fotográfico de una sede, en Drive (D-29 sección 4). Cierra el hueco
 * que dejó el sistema viejo: allá el contenido de la foto nunca se guardaba
 * —ni en el navegador ni en ningún backend— por miedo a reventar la cuota de
 * localStorage (CLAUDE.md §3: Riosucio, 58 sedes con 3 fotos, 49 MB, 10
 * borradores perdidos en silencio). Acá el contenido sí se persiste, pero en
 * Drive, nunca en el navegador ni en el Sheet — mismo patrón que
 * "SoportesFotograficos" en el sistema anterior (biblioteca de SharePoint,
 * carpeta por DANE SEDE), con Drive en su lugar (D-19).
 *
 * Una carpeta raíz (creada sola la primera vez, id guardado en las
 * Propiedades del script — mismo mecanismo que el secreto de firma de los
 * tokens) y, dentro, una subcarpeta por DANE SEDE.
 */

function _carpetaFotosRaiz() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOTOS_CARPETA_RAIZ_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* se recrea abajo */ }
  }
  var carpeta = DriveApp.createFolder('Reconstrucción de sedes — Fotos');
  props.setProperty('FOTOS_CARPETA_RAIZ_ID', carpeta.getId());
  return carpeta;
}

function _carpetaFotosDeSede(daneSede, crearSiNoExiste) {
  var raiz = _carpetaFotosRaiz();
  var existentes = raiz.getFoldersByName(String(daneSede));
  if (existentes.hasNext()) return existentes.next();
  if (!crearSiNoExiste) return null;
  return raiz.createFolder(String(daneSede));
}

// Mismo límite de payload que ya cuidan Auth.gs (intentos) y Backup.gs
// (retención): una sola foto por llamada, nunca un lote, para no acercarse al
// límite de tamaño de doPost de Apps Script ni dejar una función colgada
// minutos subiendo varias a la vez. El navegador hace una llamada por foto.
var FOTOS_MAX_BYTES = 8 * 1024 * 1024;

function Fotos_subir(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };
  // Mismo criterio que Presupuestos_guardar con origen MANUAL (D-33): quien
  // diligencia a mano sube sus propias fotos; el Verificador no diligencia,
  // solo carga masivo de Excel (Cargas), así que no sube fotos por esta vía.
  var puede = sesion.rol === 'ADMINISTRADOR' || sesion.rol === 'RESPONSABLE_SEDE';
  if (!puede) return { ok: false, error: 'Su rol no puede adjuntar fotografías' };

  var daneSede = String(body.dane_sede || '');
  var sede = _sedeDelCatalogo(daneSede);
  if (!sede) return { ok: false, error: 'DANE no existe en el catálogo' };
  if (!_enAlcance(sesion, sede.municipio, daneSede)) return { ok: false, error: 'Sede fuera de su alcance' };

  var nombre = String(body.nombre || 'foto.jpg').replace(/[\/\\]/g, '_');
  var mime = String(body.tipo_mime || 'image/jpeg');
  var b64 = String(body.contenido_base64 || '');
  if (!b64) return { ok: false, error: 'Sin contenido de imagen' };

  var bytes;
  try {
    bytes = Utilities.base64Decode(b64);
  } catch (e) {
    return { ok: false, error: 'El contenido no es base64 válido' };
  }
  if (bytes.length > FOTOS_MAX_BYTES) {
    return { ok: false, error: 'La foto supera 8 MB — redúzcala antes de subir' };
  }

  var marca = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyyMMdd_HHmmss');
  var blob = Utilities.newBlob(bytes, mime, marca + '_' + nombre);
  var carpeta = _carpetaFotosDeSede(daneSede, true);
  var archivo = carpeta.createFile(blob);

  return {
    ok: true,
    id: archivo.getId(),
    nombre: archivo.getName(),
    tamano: archivo.getSize(),
    fecha: new Date(),
    subido_por: sesion.correo
  };
}

function Fotos_listar(body) {
  var sesion = verificarToken(body.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o vencida' };

  var daneSede = String(body.dane_sede || '');
  var sede = _sedeDelCatalogo(daneSede);
  if (!sede) return { ok: false, error: 'DANE no existe en el catálogo' };
  if (!_enAlcance(sesion, sede.municipio, daneSede)) return { ok: false, error: 'Sede fuera de su alcance' };

  var carpeta = _carpetaFotosDeSede(daneSede, false);
  if (!carpeta) return { ok: true, fotos: [] };

  var fotos = [];
  var it = carpeta.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    fotos.push({
      id: f.getId(), nombre: f.getName(), tamano: f.getSize(),
      fecha: f.getDateCreated()
    });
  }
  fotos.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  return { ok: true, fotos: fotos };
}
