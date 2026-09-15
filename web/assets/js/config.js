/**
 * CONFIGURACIÓN DEL APLICATIVO PRESUPUESTAL
 * Secretaría de Educación de Caldas — sismo del 10 de agosto de 2026
 *
 * Los parámetros de negocio (umbrales de alerta, IVA) viven aquí para poder
 * ajustarlos sin tocar la lógica.
 */

const APP_CONFIG = {
  VERSION: '0.9.2',
  VIGENCIA: '2026',
  CIERRE_RECOLECCION: '2026-09-11',
  MODO_PRUEBA: true,

  /* --- BACKEND -------------------------------------------------------------
   * 'local'   localStorage. Funciona sin backend, para construir y probar.
   * 'http'    POST a ENDPOINT_URL. Sirve para Azure Logic Apps, Power Automate
   *           Premium o una función intermedia: los tres reciben el mismo JSON.
   * 'archivo' Descarga un paquete .json que el alcalde sube por un enlace de
   *           solicitud de archivos de OneDrive/SharePoint. Un flujo gratuito de
   *           Power Automate lo recoge y escribe en las listas.
   */
  BACKEND: 'archivo',
  ENDPOINT_URL: '',

  /* Biblioteca de SharePoint donde cada alcaldía sube sus paquetes. El
   * aplicativo le agrega /<MUNICIPIO> y abre la carpeta correcta, para que el
   * alcalde no tenga que buscarla entre sus correos.
   * OJO: debe ser el VÍNCULO DE USO COMPARTIDO (el que produce «Copiar
   * vínculo», de la forma /:f:/g/personal/...), no la dirección /my?id=... que
   * ve el dueño en su propio OneDrive: esa última no le abre a un invitado. */
  URL_CARPETA_ENTREGA: 'https://sedcaldas1-my.sharepoint.com/my?id=%2Fpersonal%2Fdata%5Fsedcaldas%5Fedu%5Fco%2FDocuments%2F0%20UNIDAD%20DE%20PLANEACION%2FEntrega%20Presupuesto%20Sismo%202026',

  /* --- ACCESO ---------------------------------------------------------------
   * El enlace lleva municipio y token: index.html?m=RIOSUCIO&t=<token>
   * En js/tokens.js van solo los HASH de los tokens, nunca los tokens: el
   * archivo es público y cualquiera puede leerlo.
   *
   * Alcance real de este control: evita que un municipio diligencie por otro y
   * deja trazabilidad. NO es autenticación. La barrera de verdad es la carpeta
   * de SharePoint, compartida individualmente con cada alcaldía.
   */
  EXIGIR_TOKEN: true,

  /* --- PARÁMETROS DE CÁLCULO (sección 3.1) ---------------------------------
   * D-5: A y U por separado, sin Imprevistos, más IVA sobre la utilidad.
   * Decreto 1372 de 1992 art. 3: en contratos de construcción de bien inmueble
   * el IVA se genera sobre la utilidad del constructor.
   */
  IVA_SOBRE_UTILIDAD_PCT: 19,

  /* No existe tope legal de AIU en Colombia (Colombia Compra Eficiente: cada
   * entidad es autónoma). Estos umbrales son de ALERTA, no de bloqueo, y toman
   * como referencia la práctica de mercado A 10 % / U 5 %.
   * PENDIENTE Q-3: aval de la Dirección de Planeación. */
  ALERTA_ADMIN_PCT: 12,
  ALERTA_UTILIDAD_PCT: 8,

  /* --- ADJUNTOS (D-7) --------------------------------------------------- */
  FOTOS_MIN: 1,
  FOTOS_MAX: 6,
  FOTO_MAX_MB: 5,
  FOTO_LADO_MAX_PX: 1600,
  FOTO_TIPOS: ['image/jpeg', 'image/png', 'image/webp'],

  /* --- VALIDACIONES ------------------------------------------------------- */
  DESCRIPCION_MIN: 60,
  DESCRIPCION_MAX: 1500,
  JUSTIFICACION_MIN: 40,

  /* --- CATÁLOGOS CERRADOS -------------------------------------------------
   * En texto libre llegan «mt2», «M2» y «metro cuadrado», y consolidar 975
   * sedes se vuelve trabajo manual de días.
   */
  UNIDADES: [
    { id: 'M2', label: 'm² — metro cuadrado' },
    { id: 'M3', label: 'm³ — metro cúbico' },
    { id: 'ML', label: 'ml — metro lineal' },
    { id: 'UN', label: 'un — unidad' },
    { id: 'GL', label: 'gl — global' },
    { id: 'KG', label: 'kg — kilogramo' },
    { id: 'TON', label: 'ton — tonelada' },
    { id: 'VJE', label: 'vje — viaje' },
    { id: 'DIA', label: 'día' },
    { id: 'MES', label: 'mes' },
    { id: 'HR', label: 'hora' }
  ],

  /* Los 11 ítems del modelo paramétrico. Clasificar cada fila por capítulo es
   * lo que permite comparar peso a peso lo presupuestado contra lo estimado. */
  CAPITULOS: [
    { id: 1, nombre: '1. Estructural' },
    { id: 2, nombre: '2. Mampostería y muros' },
    { id: 3, nombre: '3. Cubierta' },
    { id: 4, nombre: '4. Cimentación y terreno' },
    { id: 5, nombre: '5. Elementos no estructurales' },
    { id: 6, nombre: '6. Acabados' },
    { id: 7, nombre: '7. Instalaciones' },
    { id: 8, nombre: '8. Unidades sanitarias' },
    { id: 9, nombre: '9. Cocina y restaurante escolar' },
    { id: 10, nombre: '10. Elementos exteriores' },
    { id: 11, nombre: '11. Deficiencia constructiva' }
  ],

  /* --- ESTADOS DE LA SEDE ------------------------------------------------- */
  ESTADOS: {
    PENDIENTE:       { label: 'Pendiente',        clase: 'e-pendiente' },
    SIN_AFECTACION:  { label: 'Sin afectación',   clase: 'e-sin' },
    BORRADOR:        { label: 'En diligenciamiento', clase: 'e-borrador' },
    RADICADO:        { label: 'Radicado',         clase: 'e-radicado' },
    EN_VERIFICACION: { label: 'En verificación',  clase: 'e-verif' },
    REQUIERE_AJUSTE: { label: 'Requiere ajuste',  clase: 'e-ajuste' },
    APROBADO:        { label: 'Aprobado',         clase: 'e-aprobado' }
  },

  /* --- CLAVES DE ALMACENAMIENTO LOCAL ------------------------------------- */
  KEYS: {
    REGISTROS: 'sed_presup_registros',
    BORRADOR: 'sed_presup_borrador',
    SESION: 'sed_presup_sesion'
  }
};

/* Tipo de afectación del censo -> cómo llega la sede al tablero (D-4). */
function clasificarSede(sede) {
  const t = (sede.tipo_censo || '').trim();
  if (t.startsWith('5.')) return 'PREMARCADA_SIN';   // 271 sedes, solo confirmar
  if (t.startsWith('6.') || t.startsWith('7.')) return 'DECLARACION';  // 150 en blanco
  return 'ABIERTA';                                   // 554 tipo 1-4
}
