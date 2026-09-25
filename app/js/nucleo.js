/* app/js/nucleo.js — Configuración, estado global, formatos y navegación que usan todas las pantallas.
   Script clásico: comparte el ámbito global con los demás; el orden de carga está en
   index.html y las reglas en app/README.md. */

  /* vista -> [módulo del riel, sección, migas]. Las migas de Municipio, Ficha
     y Registrar se arman en pintar() con la sede real en la que se está. */
  const RUTA = {
    login:    [null, null, ''],
    inicio:   ['inicio', 's-inicio', '<span class="hoy">Inicio</span>'],
    tablero:  ['tablero', 's-tablero', '<span>Seguimiento</span><span class="sep">›</span><span class="hoy">Tablero</span>'],
    sedes:    ['sedes', 's-sedes', '<span class="hoy">Caldas</span>'],
    muni:     ['sedes', 's-muni', ''],
    ficha:    ['sedes', 's-ficha', ''],
    registrar:['sedes', 's-registrar', ''],
    verif:    ['verif', 's-verif', '<span>Seguimiento</span><span class="sep">›</span><span class="hoy">Verificación</span>'],
    cargas:   ['cargas', 's-cargas', '<span>Seguimiento</span><span class="sep">›</span><span class="hoy">Cargas</span>'],
    hallazgos:['hallazgos', 's-hallazgos', '<span>Administración</span><span class="sep">›</span><span class="hoy">Hallazgos</span>'],
    usuarios: ['usuarios', 's-usuarios', '<span>Administración</span><span class="sep">›</span><span class="hoy">Usuarios</span>'],
    lotes:    ['lotes', 's-lotes', '<span>Administración</span><span class="sep">›</span><span class="hoy">Lotes</span>'],
  };

  /* Los 4 roles del sistema (D-20). `ve` es la lista blanca de pantallas y la
     primera es la de entrada (Inicio para todos); `interno` si es personal de
     la Secretaría (ve Tablero, Verificación, Cargas…); `edita` si puede
     diligenciar; `verifica` si puede emitir concepto. Esto solo decide qué se
     MUESTRA: los permisos reales los valida el backend en cada acción
     (verificarToken + rol + _enAlcance). El nombre y el texto del rol se llenan
     con los datos reales de la sesión al entrar. */
  const ROLES = {
    admin:    { ext:false, rot:'Administrador',
                ve:['inicio','sedes','tablero','muni','ficha','registrar','verif','cargas','lotes','hallazgos','usuarios'],
                interno:true,  edita:true,  verifica:true },
    verif:    { ext:false, rot:'Verificador · todo el departamento',
                ve:['inicio','sedes','tablero','muni','ficha','verif','cargas','hallazgos'],
                interno:true,  edita:false, verifica:true },
    resp:     { ext:true,  rot:'Responsable de sede',
                ve:['inicio','sedes','muni','ficha','registrar'],
                interno:false, edita:true,  verifica:false },
    consulta: { ext:false, rot:'Consulta · solo lectura',
                ve:['inicio','sedes','tablero','muni','ficha'],
                interno:true,  edita:false, verifica:false },
  };

  let vista = 'login', rol = 'admin';

  /* Backend real (D-19). Único punto que cambia si el despliegue cambia de
     URL — ver backend/README.md. */
  const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz28P3m9yNHcI-catJhiCN32hPgSR0Qpx5h3AEnSHITM8Uf0OrUEFSI0__HbCN5K_8/exec';

  const ROL_BACKEND_A_CLAVE = {
    ADMINISTRADOR: 'admin', VERIFICADOR: 'verif',
    RESPONSABLE_SEDE: 'resp', CONSULTA: 'consulta',
  };

  let sesion = null; // {token, rol, nombre, alcance} una vez logueado de verdad
  let correoActual = '';

  /* Paso 2: catálogo real de sedes (null hasta que llegue del backend), y
     dónde está parado el usuario al navegar Sedes -> Municipio -> Ficha. */
  let SEDES = null;
  let muniActual = null;
  let daneActual = null;

  /* D-43: el sistema solo muestra lo que se registra en él. Cada sede trae
     `presupuesto` (resumen de su versión vigente, o null) y ACTIVIDAD son los
     últimos movimientos reales (backend/Sedes.gs::Sedes_listar). Se vuelven a
     pedir al entrar a Tablero/Sedes/Municipio si pasó más de un minuto, o de
     inmediato si esta misma sesión acaba de escribir algo (sedesSucias). */
  let ACTIVIDAD = [];
  /* D-44: lotes creados por el Administrador (backend/Lotes.gs). Cada sede
     trae `lote` ({id_lote, nombre, activo} o null) y listarSedes devuelve la
     lista completa.
     D-46: universoSel decide sobre qué sedes cuentan Tablero, Sedes y
     Municipio, y siempre se dice cuál es: 'todas' (todo el alcance), 'dano'
     (tipos 1 a 4 del censo) o el id de un lote. */
  let LOTES = [];
  let universoSel = 'todas';
  // Últimos hallazgos leídos (Inicio los cuenta); null hasta pedirlos.
  let HALLAZGOS = null;
  let hallazgosLeidosEn = 0;
  let sedesCargadasEn = 0;
  let sedesSucias = false;
  let cargandoSedes = false;
  const REFRESCO_SEDES_MS = 60 * 1000;

  // Caché de lo último que la Ficha trajo del backend para esta sede — el PDF
  // (generarPdfFicha) lo reusa tal cual en vez de pedirlo otra vez, para que
  // lo que se descarga sea exactamente lo que la pantalla está mostrando.
  let fichaPresupuestoActual = null;
  let fichaItemsActual = [];
  let fichaVerificacionActual = null;
  let fichaFotosActual = [];
  let fichaHistorialActual = [];

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function cop(n){
    return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(Number(n) || 0);
  }
  /* Tipo de afectación del censo (1-7, o 0 si no está clasificada). Desde
     D-44 el tipo ya no define ningún lote: solo se muestra como dato del
     censo (P1 = colapso, P2 = riesgo inminente, el resto con su número). */
  const tipoNum = s => { const m = /^(\d)\./.exec(String((s && s.tipo_censo) || '')); return m ? Number(m[1]) : 0; };
  const TIPO_TXT = { 1: 'Colapso', 2: 'Riesgo inminente', 3: 'Estructurales parciales', 4: 'Menores',
    5: 'Sin afectación', 6: 'No determinable', 7: 'Sin revisar', 0: 'Sin clasificar' };
  const TIPO_COLOR = { 1: 'var(--err)', 2: 'var(--alerta)', 3: 'var(--oro)', 4: 'var(--gris)',
    5: 'var(--ok)', 6: 'var(--borde-f)', 7: 'var(--borde-f)', 0: 'var(--borde-f)' };
  function tipoChipNum(t){
    if (t === 1) return '<span class="pri p1">P1</span>';
    if (t === 2) return '<span class="pri p2">P2</span>';
    return t ? `<span class="pri pt">${t}</span>` : '—';
  }
  const tipoChip = s => tipoChipNum(tipoNum(s));

  /* Días que lleva un presupuesto radicado sin concepto. Umbrales iniciales
     para el semáforo, a ajustar con el jefe: hasta 5 verde, hasta 10 oro. */
  const ESPERA_OK_DIAS = 5, ESPERA_ALERTA_DIAS = 10;
  function diasDesde(fecha){
    // Días de calendario, no bloques de 24 h: lo radicado ayer a las 7 p. m. es «1 día», no «hoy».
    const d = new Date(fecha);
    if (isNaN(d)) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dia = new Date(d); dia.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((hoy - dia) / 86400000));
  }
  function chipEspera(fecha, sufijo){
    const d = diasDesde(fecha);
    if (d == null) return '—';
    const cls = d <= ESPERA_OK_DIAS ? 'ok' : (d <= ESPERA_ALERTA_DIAS ? 'al' : 'er');
    const txt = d === 0 ? 'hoy' : (d === 1 ? '1 día' : `${d} días`);
    return `<span class="espera ${cls}" title="Días desde la radicación sin concepto">${txt}${sufijo ? ' ' + sufijo : ''}</span>`;
  }

  // Placeholders de carga (bloques con brillo), en vez de texto "Cargando…".
  const esqueletoLineas = n => Array.from({ length: n }, () => '<div class="esq esq-linea"></div>').join('');
  const esqueletoFranja = n => Array.from({ length: n }, () => '<div class="c"><b class="esq esq-num"></b><span class="esq esq-tx"></span></div>').join('');
  const filasEsqueleto = (cols, n) => Array.from({ length: n }, () =>
    `<tr>${Array.from({ length: cols }, () => '<td><div class="esq esq-celda"></div></td>').join('')}</tr>`).join('');

  /* capitulos_dano viaja como texto "2,6". Si la hoja interpretó la coma como
     separador decimal (locale es-CO) al importar el CSV, llega como número
     (2.6) en vez de lista — se detecta y se reporta, no se adivina a qué
     capítulos correspondía. */
  function capitulosDeSede(s){
    const raw = s.capitulos_dano;
    if (raw === '' || raw == null) return { lista: [], corrupto: false };
    if (typeof raw === 'number') return { lista: [], corrupto: true, crudo: raw };
    return { lista: String(raw).split(',').map(x => x.trim()).filter(Boolean), corrupto: false };
  }

  /* Trae las sedes ya filtradas y recortadas por el backend según el rol y
     alcance de la sesión (backend/Sedes.gs::_enAlcance, D-6/D-24/D-25). El
     navegador no vuelve a filtrar nada, solo pinta lo que llega. */
  /* Una sola carga a la vez: si ya hay una en curso, quien llame recibe esa
     misma promesa. Visto en producción el 2026-09-24: al entrar se pedían dos
     listarSedes simultáneos y uno volvió con ok:true pero sin `sedes`, lo que
     dejó la pantalla en "Cargando…" para siempre. Por eso además se exige que
     `sedes` sea una lista y, si no lo es, se reintenta una vez. */
  let promesaSedes = null;
  function cargarSedes(){
    if (promesaSedes) return promesaSedes;
    cargandoSedes = true;
    promesaSedes = (async () => {
      for (let intento = 1; intento <= 2; intento++){
        try {
          const r = await backend('listarSedes', { token: sesion.token });
          if (r && r.ok && Array.isArray(r.sedes)){
            SEDES = r.sedes;
            ACTIVIDAD = Array.isArray(r.actividad) ? r.actividad : [];
            LOTES = Array.isArray(r.lotes) ? r.lotes : [];
            sedesCargadasEn = Date.now();
            sedesSucias = false;
            return;
          }
        } catch (err) { /* se reintenta abajo */ }
        if (intento === 1) await new Promise(res => setTimeout(res, 1500));
      }
      // Dos intentos fallidos: si nunca hubo datos, se muestra vacío en vez de
      // "Cargando…" eterno, y se marca para reintentar en la próxima navegación.
      if (!SEDES) SEDES = [];
      sedesSucias = true;
    })().finally(() => { promesaSedes = null; cargandoSedes = false; });
    return promesaSedes;
  }

  // Muestra lo que ya hay en memoria y, si está viejo, lo pide de nuevo en
  // segundo plano y repinta al llegar — nunca deja la pantalla en blanco
  // esperando al backend.
  function refrescarSedesSiHaceFalta(){
    if (!sesion || cargandoSedes) return;
    if (!sedesSucias && Date.now() - sedesCargadasEn < REFRESCO_SEDES_MS) return;
    cargarSedes().then(() => pintar());
  }

  /* Estado de seguimiento de una sede, derivado de su presupuesto vigente.
     Tres grupos para barras y colores: pend (sin presupuesto o en borrador),
     curso (radicado, en verificación o devuelto para ajuste), apr (aprobado). */
  const GRUPO_ESTADO = { SIN:'pend', BORRADOR:'pend', RADICADO:'curso', EN_VERIFICACION:'curso', REQUIERE_AJUSTE:'curso', APROBADO:'apr' };
  const RADICADOS = ['RADICADO', 'EN_VERIFICACION', 'REQUIERE_AJUSTE', 'APROBADO'];
  const estadoDe = s => (s && s.presupuesto && s.presupuesto.estado) || 'SIN';
  const grupoDe = s => GRUPO_ESTADO[estadoDe(s)] || 'pend';
  const radicada = s => RADICADOS.indexOf(estadoDe(s)) !== -1;
  const valorRadicado = s => radicada(s) ? (Number(s.presupuesto.total_presupuesto) || 0) : 0;
  const lotesActivos = () => LOTES.filter(l => l.activo);
  // Daño reportado en el censo: tipos 1 a 4. El tipo 5 es «sin afectación» y
  // el 6-7 «no determinable / sin revisar»: no se cuentan como sedes que
  // necesiten presupuesto, pero siguen a la vista (D-46).
  const conDano = s => { const t = tipoNum(s); return t >= 1 && t <= 4; };
  // La sede está en un lote que sigue abierto (Lotes: filtro «sin lote» y aviso de «se moverá»).
  const enLoteActivo = s => !!(s && s.lote && s.lote.activo);

  /* D-46: se ven todas las sedes del alcance (el backend ya lo recortó por rol);
     el selector solo cambia sobre qué conjunto se cuenta. Los lotes solo
     existen para los roles internos. */
  function universo(){
    if (!SEDES) return [];
    if (universoSel === 'dano') return SEDES.filter(conDano);
    if (universoSel !== 'todas' && ROLES[rol].interno) return SEDES.filter(s => s.lote && s.lote.id_lote === universoSel);
    return SEDES;
  }

  // Nombre corto del conjunto elegido, para títulos de cifras.
  function etiquetaUniverso(){
    if (universoSel === 'dano') return 'Con daño reportado';
    if (universoSel === 'todas' || !ROLES[rol].interno) return ROLES[rol].interno ? 'Sedes' : 'Sedes de su alcance';
    const l = LOTES.find(x => x.id_lote === universoSel);
    return l ? `Lote ${l.nombre}` : 'Sedes';
  }

  // Frase que dice con qué criterio se construyó lo que se está viendo — va
  // en los pies de página. Sin criterio escrito ninguna cifra es defendible.
  function descripcionUniverso(sedes){
    const n = sedes.length, pl = n === 1 ? '' : 's';
    if (universoSel === 'dano') return `${n} sede${pl} con daño reportado en el censo (tipos 1 a 4)${ROLES[rol].interno ? '' : ', dentro de su alcance'}.`;
    if (universoSel !== 'todas' && ROLES[rol].interno){
      const l = LOTES.find(x => x.id_lote === universoSel);
      if (l) return `Lote «${l.nombre}»${l.activo ? '' : ' (cerrado)'}: ${n} sede${pl}.`;
    }
    return ROLES[rol].interno
      ? `Todas las sedes: ${n} (oficiales, activas y con matrícula; sin Manizales).`
      : `Las ${n} sede${pl} de su alcance.`;
  }

  function estadoBadge(s){
    const p = s && s.presupuesto;
    if (!p) return '<span class="est e-pend">Sin presupuesto</span>';
    const [cls, txt] = ESTADOS_PRESUPUESTO[p.estado] || ['e-pend', p.estado];
    return `<span class="est ${cls}">${esc(txt)}</span>`;
  }

  function copCorto(n){
    n = Number(n) || 0;
    return n >= 1000000 ? `$${formatNum(n / 1000000, 1)}<span class="u"> M</span>` : esc(cop(n));
  }

  // Fecha relativa para bitácora y "última actividad".
  function hace(fecha){
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (isNaN(d)) return '—';
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const dias = Math.round(h / 24);
    if (dias === 1) return 'ayer';
    if (dias < 7) return `hace ${dias} días`;
    return d.toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' });
  }

  function ultimaActividadDe(s){
    const p = s && s.presupuesto;
    if (!p) return null;
    const a = p.fecha_creacion ? new Date(p.fecha_creacion).getTime() : 0;
    const b = p.fecha_concepto ? new Date(p.fecha_concepto).getTime() : 0;
    const m = Math.max(a, b);
    return m ? new Date(m) : null;
  }

  // Tipo del censo sin inventar: el texto tal cual viene del censo de daños,
  // con la etiqueta P1/P2 cuando es colapso o riesgo inminente.
  function tipoCensoHtml(s){
    const t = tipoNum(s);
    const badge = t === 1 || t === 2 ? tipoChipNum(t) + ' ' : '';
    return badge + esc(s.tipo_censo || 'Sin clasificar en el censo');
  }

  function irInicio(){ vista = 'inicio'; muniActual = null; daneActual = null; pintar(); }
  function irSedes(){ vista = 'sedes'; muniActual = null; daneActual = null; pintar(); }
  function irMuni(m){ if (m !== muniActual) muniFiltro = 'todas'; vista = 'muni'; muniActual = m; pintar(); }
  function irFicha(dane){
    vista = 'ficha'; daneActual = dane;
    // Se puede llegar desde la bitácora o la bandeja, no solo desde Municipio:
    // el municipio "actual" pasa a ser el de la sede, no el último visitado.
    const s = SEDES && SEDES.find(x => String(x.dane_sede) === String(dane));
    if (s) muniActual = s.municipio;
    pintar();
  }
  function irRegistrar(){ vista = 'registrar'; cargarRegistro(daneActual); pintar(); }

  function nombreSedeCorto(s){
    if (!s || !s.sede) return '';
    return (s.institucion && s.sede.toUpperCase().indexOf(s.institucion.toUpperCase()) !== -1)
      ? s.sede : `${s.institucion} — ${s.sede}`;
  }

  function iniciales(nombre){
    return (nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  // Qué se muestra según el rol. Se llama dos veces por pintada: antes y
  // después de pintar datos reales, porque las tablas reales se regeneran con
  // elementos [data-sed] nuevos que la primera pasada todavía no vio.
  // El riel no pasa por aquí: sus entradas las decide ROLES[rol].ve en
  // pintarRiel(). Antes esta función volvía a mostrar todo lo [data-sed] del
  // riel y Consulta veía Verificación, Cargas, Lotes, Hallazgos y Usuarios.
  function aplicarVisibilidadRol(R){
    document.querySelectorAll('[data-sed]').forEach(e => { if (!e.closest('.riel')) e.classList.toggle('oculto', !R.interno); });
    document.querySelectorAll('.ext-solo').forEach(e => e.classList.toggle('oculto', R.interno));
    document.querySelectorAll('[data-edita]').forEach(e => e.classList.toggle('oculto', !R.edita));
  }

  // Quita tildes y pasa a minúsculas, solo para comparar al buscar.
  const normalizar = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

