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
  // D-42: antes solo se confiaba en `tipo_mime`, un campo que manda el propio
  // navegador y que cualquiera con sesión válida puede falsear — permitiría
  // guardar cualquier archivo disfrazado de foto en el Drive del sistema. Se
  // revisan los primeros bytes reales contra las firmas de JPEG y PNG, los
  // dos formatos que produce `accept="image/*"` en cámaras y capturas de
  // pantalla comunes.
  if (!_esImagenValida(bytes)) {
    return { ok: false, error: 'El archivo no es una imagen JPEG o PNG válida' };
  }

  var marca = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyyMMdd_HHmmss');
  var blob = Utilities.newBlob(bytes, mime, marca + '_' + nombre);
  var carpeta = _carpetaFotosDeSede(daneSede, true);
  var archivo = carpeta.createFile(blob);
  // D-42: 'cualquiera con el enlace, solo lectura' para poder mostrarla en la
  // Ficha. Se hace una sola vez, al crearla (antes se hacía en cada listado).
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    ok: true,
    id: archivo.getId(),
    nombre: archivo.getName(),
    tamano: archivo.getSize(),
    fecha: new Date(),
    subido_por: sesion.correo
  };
}

// Compara los primeros bytes reales del archivo contra las firmas conocidas
// de JPEG (FF D8 FF) y PNG (89 50 4E 47) — Apps Script entrega los bytes como
// enteros con signo (Java), por eso se normalizan con `& 0xFF` antes de comparar.
function _esImagenValida(bytes) {
  if (bytes.length < 4) return false;
  var b = [];
  for (var i = 0; i < 4; i++) b.push(bytes[i] & 0xFF);
  var esJpeg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  var esPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  return esJpeg || esPng;
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
    // Las fotos se comparten al subirlas (Fotos_subir). Acá solo se corrige
    // la que todavía no lo esté (subidas antes del 2026-09-24): cambiar
    // permisos es una escritura en Drive, y hacerla en cada apertura de Ficha
    // era buena parte de su demora. Viajan `url` (ver completa) y
    // `miniatura` (galería), nunca el contenido.
    if (f.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    fotos.push({
      id: f.getId(), nombre: f.getName(), tamano: f.getSize(),
      fecha: f.getDateCreated(), url: f.getUrl(),
      miniatura: 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w300'
    });
  }
  fotos.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  return { ok: true, fotos: fotos };
}
