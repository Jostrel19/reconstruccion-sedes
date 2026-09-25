# Plan de desarrollo — sistema de reconstrucción de sedes

**Fecha:** 2026-09-16 · **Estado:** diseño y decisiones cerradas. Listo para construir.

Este archivo es el punto de partida del desarrollo. Reemplaza a `docs/diseno/DISENO_0X` como guía
operativa: aquellos describen la fase de diseño y quedaron parcialmente desactualizados por D-26 a
D-33 (ver §5).

---

## 1. Los cuatro objetivos, y con qué se cumple cada uno

Textualmente lo que se pidió, y la pieza que lo resuelve:

| # | Objetivo | Pieza | Estado |
|---|---|---|---|
| 1 | «Que los alcaldes y rectores sigan diligenciando la información de manera manual para crear el presupuesto bajo el sistema» | Pantalla **Registrar presupuesto** (D-33), rol *Responsable de sede*. Ítems por capítulo, A/U/IVA, plazo, fotos, borrador y radicación versionada | Diseñado |
| 2 | «Que los arquitectos, si cuentan con presupuestos ya en Excel, puedan hacer el cargue masivo y les rinda más el trabajo» | Módulo **Cargas** + los 4 lectores de `tools/ingesta*.py`, con pantalla de revisión antes de volcar (D-23) | Lectores hechos y probados · pantalla diseñada |
| 3 | «Que los directivos puedan visualizar y entender la información y cómo va el proceso realmente» | **Tablero** + rol *Consulta* (solo lectura, ve todo el departamento) | Diseñado |
| 4 | «Que los administradores puedan tener el control de todo el sistema» | Rol **Administrador** + módulo **Usuarios** | Diseñado |

**Sí cubre lo que se pidió.** Los dos caminos de captura —manual y masivo— escriben en el mismo
sitio y producen el mismo registro versionado, así que el Tablero no distingue de dónde vino el
dato salvo por la etiqueta de origen (`MAN` / `XLS`), que sí se conserva para trazabilidad.

---

## 2. Alcance por rol — confirmado

| Rol | Alcance de sedes | Lotes (D-44) | Diligencia | Verifica | Pantallas |
|---|---|:--:|:--:|:--:|---|
| **Administrador** | Todo el departamento | Crea, agrega, quita, cierra | Sí | Sí | Todas |
| **Verificador** (arquitecto) | **Todo el departamento**, sin restricción por municipio (D-25) | Filtra por lote | No (solo Cargas) | **Sí** | Inicio · Sedes · Tablero · Ficha · Verificación · Cargas · Hallazgos |
| **Responsable de sede** — alcalde | **Todas las sedes de su municipio** (D-24) | No los ve | Sí | No | Inicio · Sedes · Ficha · Registrar |
| **Responsable de sede** — rector | **Las sedes de su I.E. según el catálogo**, de 1 a 18 (D-24) | No los ve | Sí | No | Inicio · Sedes · Ficha · Registrar |
| **Consulta** (directivo) | Todo el departamento, solo lectura | Filtra por lote | No | No | Inicio · Sedes · Tablero · Ficha |

*Desde D-43 (2026-09-24) ningún rol ve `valor_referencia`; la columna que decía quién lo veía se reemplazó por la de lotes.*

Dos precisiones que importan al programar:

- **Alcalde y rector tienen permisos idénticos.** Lo único que cambia es a cuántas sedes alcanzan.
  No hay dos roles: hay un rol con dos alcances. En `Usuarios` se distinguen por la columna `tipo`,
  pero la lógica de permisos no la mira.
- **El filtro por rol lo hace el backend, no el navegador.** En el mockup se simula con
  `classList.toggle('oculto')` porque es una maqueta; en producción, si un Responsable de sede pide
  una sede fuera de su alcance, Apps Script responde error — no responde el dato y lo esconde.
  Lo mismo con `valor_referencia`: **no viaja** al navegador de quien no lo alcanza (D-6).

---

## 2.b Los 14 capítulos de presupuesto (D-34)

Del **1 al 11** son los del censo — dicen **dónde** está el daño y son los que el arquitecto marcó
en `dimDaños`. Del **12 al 14** son transversales: no son un lugar con daño, son trabajo que toda
reconstrucción necesita.

| # | Capítulo | Origen |
|---:|---|---|
| 1 | Estructural | Censo |
| 2 | Mampostería y muros | Censo |
| 3 | Cubierta | Censo |
| 4 | Cimentación y terreno | Censo |
| 5 | Elementos no estructurales | Censo |
| 6 | Acabados | Censo |
| 7 | Instalaciones | Censo |
| 8 | Unidades sanitarias | Censo |
| 9 | Cocina y restaurante escolar | Censo |
| 10 | Elementos exteriores | Censo |
| 11 | Deficiencia constructiva / vulnerabilidad | Censo |
| **12** | **Preliminares y obras provisionales** | **Transversal** |
| **13** | **Demoliciones y desmontes** | **Transversal** |
| **14** | **Aseo, escombros y disposición final** | **Transversal** |

**Regla al programar el cruce daño↔presupuesto:** solo se evalúan los capítulos **1 a 11**. Un ítem
en 12, 13 o 14 **nunca** se marca como «presupuesto sin daño» — no le corresponde ningún capítulo del
censo por definición.

**La evidencia:** en el presupuesto real de Belalcázar (673 M de costo directo, 74 actividades),
demoliciones pesa 10,6 %, preliminares 2,2 % y desmontes 0,8 % — **13,6 % que sin estos capítulos no
tendría dónde ir**.

### Qué NO se pide

Los municipios entregan con tres niveles de madurez muy distintos (§3 de `CLAUDE.md`). El sistema
pide el **mínimo común**: actividad + unidad + cantidad + valor unitario. **No pide el APU** que
sustenta el precio (D-35): exigirlo dejaría a Samaná fuera, que mandó una lista de materiales de
ferretería sin mano de obra. El APU, cuando existe, viaja como adjunto.

Consecuencia aceptada: **el sistema no valida que un precio unitario sea razonable.** Eso lo hace el
arquitecto en la verificación — es para lo que existe ese paso.

---

## 3. Orden de construcción

Cada paso deja algo que se puede probar. No se avanza con el anterior sin verificar.

### Paso 0 — Backend mínimo en pie — ✅ código listo en `backend/`, falta desplegarlo
1. Crear el Google Sheet con 6 pestañas: `Sedes`, `Presupuestos`, `Items`, `Verificaciones`,
   `Usuarios`, `Hallazgos` — columnas exactas en `CLAUDE.md` §6. **`backend/Setup.gs::crearHojas()`
   lo hace solo**, falta correrlo una vez en el Sheet real.
2. Desplegar un Web App de Apps Script que responda a un `ping`. **Confirmado 2026-09-17**
   (`docs/PRUEBA_DESPLIEGUE_APPS_SCRIPT.md`) — `backend/Codigo.gs::doGet` ya lo implementa.
3. Cargar `Sedes` desde `data/generado/catalogo_sedes.json` (975 filas). **`tools/exportar_backend.py`
   ya genera el CSV exacto** (`backend_sedes.csv`) para importar con `Archivo > Importar`.

### Paso 1 — Entrar (D-20) — ✅ código listo en `backend/Auth.gs`, falta desplegar y probar en vivo
4. `POST solicitarCodigo` → busca el correo en `Usuarios`; si no está, **no envía nada y responde
   lo mismo** que si estuviera (no se puede averiguar quién tiene cuenta probando correos).
5. Genera código de 6 dígitos, lo guarda con vencimiento de 10 min, lo manda con `MailApp`.
6. `POST validarCodigo` → token de sesión firmado (HMAC, secreto en las Propiedades del script) +
   rol y alcance leídos de `Usuarios`.
7. ✅ **Frontend conectado con `fetch` real (2026-09-17).** La pantalla de entrada del mockup ya
   llama a `solicitarCodigo`/`validarCodigo` de verdad — probado de punta a punta con la cuenta
   Administrador: el token, el rol, el nombre y el alcance que se ven en pantalla vienen del backend,
   no de un dato simulado. El selector "Ver como" del mockup sigue existiendo aparte, para revisar
   diseño sin necesidad de loguearse cada vez.

### Paso 2 — Armazón y lectura — ✅ cerrado 2026-09-17
8. ✅ Riel y migas ya navegan de verdad (antes eran decorativos); filtrado por rol **del lado del
   servidor** en `backend/Sedes.gs` (D-24/D-25), `valor_referencia` oculto a Responsable de sede
   (D-6) — verificado también sobre datos reales, no solo en el diseño simulado.
9. ✅ **Hecho 2026-09-17.** Sedes → Municipio → Ficha, en modo lectura, conectadas a `listarSedes`.
   Probado de punta a punta con la cuenta Administrador real: 12 municipios del lote 1, drill-down
   a sedes de un municipio, ficha con identidad y censo de daños reales (capítulos 1-14). Lo que
   todavía no existe (presupuesto, historial, ítems) se muestra vacío, no simulado — detalle en
   `docs/REGISTRO_DESARROLLO.md`.
10. ✅ **Hecho 2026-09-17.** Tablero conectado a `listarSedes`: franja de cifras, mosaico de
    municipios (clicable, entra directo a Municipio), valor de referencia por municipio y "del
    universo al lote" son reales. "Nivel de afectación" se repobló como "Estado de prestación del
    servicio" (el campo real del censo; el original no tenía con qué sustentar sus categorías) y la
    Bitácora quedó vacía (no existe todavía un registro de actividad — eso es Paso 3 en adelante).

### Paso 3 — Escritura manual (objetivo 1) — ✅ cerrado 2026-09-21
11. ✅ **Verificado en producción.** `backend/Presupuestos.gs` (nuevo): `Presupuestos_obtener` y
    `Presupuestos_guardar`, registradas en `Codigo.gs`. Pantalla Registrar presupuesto
    (`docs/diseno/mockup_v6.html`) conectada: tabla de ítems editable (agregar/quitar fila,
    catálogo cerrado de capítulo 1-14 y unidad), cálculo automático de costo directo/A/U/IVA/total,
    parseo del formato colombiano (`1.500.000`), alerta visual si A > 12 % o U > 8 % (D-5, umbrales
    sin aval de Planeación todavía, Q-3). El botón "Editar presupuesto" de la Ficha lleva el DANE
    real a esta pantalla.
12. ✅ **Versionado real, verificado en producción.** `Presupuestos_guardar` nunca actualiza una
    fila: calcula los totales él mismo (no le cree el total al navegador), apaga `vigente` en la
    versión anterior si existe, y agrega una fila nueva con `version` + 1 (D-37). Probado en el
    Sheet real sobre `217013000602`: v1 (borrador) → v2 (radicado) → v3 (borrador editado después
    de radicado) quedaron como tres filas separadas, ninguna se sobrescribió. La Ficha
    (`cargarPresupuestoDeFicha`) refleja el presupuesto vigente en Seguimiento/Historial.

**Bloqueante resuelto 2026-09-21** (arrastrado desde el 17): el primer intento de desplegar creó
una implementación **nueva** ("Paso 3 — Registrar...", URL propia) en vez de subir una versión
nueva a la implementación existente ("Paso 0 — 6 pestañas...", cuya URL es la que tiene
`BACKEND_URL`) — cada implementación de Apps Script es un `/exec` independiente, así que el mockup
seguía hablando con el `Codigo.gs` viejo. Corregido subiendo la versión correcta a la
implementación original. La implementación huérfana "Paso 3 — Registrar..." quedó sin usar (no
rompe nada, es una URL que nadie referencia) — pendiente archivarla cuando haya un rato, no urge.

**Fotografías (D-29 sección 4) — desplegado y verificado en producción 2026-09-21.**
`backend/Fotos.gs` (nuevo): `Fotos_subir` y `Fotos_listar`, con Drive como repositorio de
archivos — exactamente lo que D-19 ya preveía ("Drive como repositorio de archivos") y que hasta
ahora no se había construido. Una carpeta raíz ("Reconstrucción de sedes — Fotos", id guardado en
las Propiedades del script, mismo mecanismo que el secreto de los tokens) y, dentro, una subcarpeta
por DANE sede — mismo patrón que "SoportesFotograficos" en el sistema anterior (D-13), con Drive en
vez de SharePoint. Límite de 8 MB por foto, una llamada por foto (nunca un lote) para no acercarse
al límite de tamaño de `doPost`. Puede subir quien puede diligenciar a mano (`ADMINISTRADOR` /
`RESPONSABLE_SEDE`, mismo criterio que `Presupuestos_guardar` con `origen: MANUAL`) — el Verificador
no diligencia, así que no sube fotos por esta vía. Registradas en `Codigo.gs` como `subirFoto` y
`listarFotos`.

La pantalla Registrar (sección 4) se reconstruyó: ya no es decorativa — sube por clic o arrastrando,
muestra miniatura de lo recién subido, y al reabrir la sede trae lo que ya existe en Drive
(`listarFotos`). Se retira el aviso "tendrá que adjuntar las fotos de nuevo" (D-11 del sistema
viejo): ya no aplica, el contenido persiste del lado del servidor, no del navegador. El stepper de
la sección 4 (ver más abajo) ahora refleja si hay al menos una foto real.

**Aprovechado para cerrar dos huecos reales de la Ficha, encontrados en la auditoría de hoy:** en
`cargarPresupuestoDeFicha`, la sección "2 · Descripción de la afectación" del checklist "Formato
oficial" nunca se marcaba completa aunque el presupuesto ya trajera la descripción — solo se
marcaba la 3 (Presupuesto). Corregido con el mismo criterio de longitud mínima que ya exige
`Presupuestos_guardar` al radicar. Se agregó `cargarFotosDeFicha` para que la sección 4 del mismo
checklist deje de estar fija en "Sin adjuntar" y refleje `listarFotos` real. El contador
"X de 5 secciones" ahora se recalcula sobre el DOM (`actualizarContadorFormatoOficial`) en vez de
un número fijo, porque presupuesto y fotos llegan por dos llamadas independientes que pueden
resolver en cualquier orden.

**Tres cambios más, 2026-09-21, a pedido explícito tras la auditoría — probados primero con datos
fabricados en memoria y luego, tras el despliegue, contra el backend real:**

1. **Sección 5 de la Ficha — concepto de verificación en modo lectura (D-30), desplegado y
   verificado en producción.** `_verificacionDe(idPresupuesto)` (nuevo, en `Verificaciones.gs`) busca en
   la hoja `Verificaciones` la fila más reciente para ese `id_presupuesto` y la expone como campo
   `verificacion` en la respuesta de `Presupuestos_obtener` (mismo patrón que ya usa `historial` —
   sin viaje nuevo desde el navegador). En la Ficha, un panel nuevo "Concepto del arquitecto"
   (oculto si no hay verificación todavía) muestra resultado, observaciones, quién y cuándo; el
   paso 5 del checklist "Formato oficial" deja de estar fijo en "Pendiente". Antes de esto, un
   Responsable de sede que veía "Requiere ajuste" en el badge no tenía forma de saber *qué* corregir
   sin preguntar por fuera del sistema — las observaciones del arquitecto se guardaban bien en
   `Verificaciones` (D-21) pero no llegaban a ningún lado del frontend.
2. **PDF del formato oficial, adelantado del Paso 6 — código completo, 100 % frontend, no
   requiere desplegar backend.** Mismo truco sin librerías del sistema anterior (iframe oculto +
   impresión del navegador), reescrito para el modelo de datos nuevo: sin firma-imagen (D-13, ya
   reemplazada por D-21 — se imprime correo y fecha de quien radicó y quien verificó, registro de
   auditoría de sesión, no una rúbrica escaneada) y sin fotos embebidas (`listarFotos` solo trae
   metadatos, nunca el contenido — traerlo exigiría un endpoint nuevo que no se pidió ahora; el PDF
   deja una nota de que las fotos se consultan en el sistema). Usa la misma caché que ya carga la
   Ficha (`fichaPresupuestoActual`/`fichaItemsActual`/`fichaVerificacionActual`) — lo que se
   descarga es exactamente lo que la pantalla está mostrando, sin pedir nada dos veces.
3. **Contador real de Verificación en el riel — hecho, 100 % frontend, ya activo.** Antes se
   ocultaba siempre (correcto: el "6" del ejemplo no debía pasar por real, pero tampoco mostraba
   nada útil). Ahora `actualizarBadgeVerifRiel()` calcula los `RADICADO` pendientes sobre `VERIF`
   real y los muestra — sigue oculto hasta la primera vez que se visita Verificación en la sesión
   (no se pide la bandeja completa desde el login solo para este número), y se actualiza cada vez
   que la bandeja se refresca.

**Prueba de producción, 2026-09-21, tras el despliegue de `Fotos.gs`, `Codigo.gs`,
`Verificaciones.gs` y `Presupuestos.gs`:** login real (`data@sedcaldas.edu.co`, código de un solo
uso), sobre la sede 217050000060 (Buenos Aires, I.E. Antonio Nariño — Aranzazu):

- Se radicó un presupuesto de prueba (`guardarPresupuesto`, MANUAL, 1 ítem, $1.020.000) →
  `217050000060-v1`.
- Se subió una foto real a Drive (`subirFoto`) y se confirmó con `listarFotos`: la carpeta del DANE
  se crea sola, se guarda solo metadata (id, nombre, tamaño, fecha), nunca el contenido — tal como
  se diseñó.
- Se emitió un concepto real (`emitirConcepto`, `CORRESPONDE_PARCIAL` → `estado: REQUIERE_AJUSTE`,
  D-22/D-39).
- Se abrió la Ficha de esa sede: las 5 secciones del checklist "Formato oficial" quedaron
  "Completa" (incluida "1 adjunta" en fotos), y el panel "Concepto del arquitecto" mostró resultado,
  observaciones, verificador y fecha reales — antes vacío en toda prueba anterior porque no existía
  ninguna verificación real sobre un presupuesto que siguiera vigente.
- Se generó el HTML del PDF (`_htmlFormatoOficial`) sobre esos mismos datos cacheados: trae
  radicado, sede, municipio, el ítem, el total ($1.020.000), el concepto y las observaciones.

Es un registro de **prueba**, igual que las radicaciones de prueba anteriores (Aguadas-Viboral,
Aranzazu): queda en `Presupuestos`/`Items`/`Verificaciones` y una foto en Drive hasta que se limpie
a mano, como se hizo la vez pasada.

**Auditoría del 2026-09-21, antes de seguir con los pasos 4 y 5:** se pidió revisar a fondo que no
hubiera errores ni incongruencias antes de construir más. Se encontraron y corrigieron 4 huecos
reales en lo que ya se había dado por cerrado:

1. **`cargarPresupuestoDeFicha()` nunca actualizaba "Cruce por capítulo" ni "Presupuesto a
   detalle".** Esos dos paneles quedaban congelados para siempre con el ejemplo de diseño
   (Guayaquil, capítulos 2/3/6) sin importar qué sede real se estuviera viendo — el hallazgo menor
   que quedó anotado la vez anterior (`cargarRegistro()` tragando errores) resultó ser el más chico
   de cuatro. Corregido: ambos paneles ahora se recalculan con los `items` reales que devuelve
   `obtenerPresupuesto`.
2. **`Presupuestos_obtener` solo devolvía la versión vigente**, así que "Historial" nunca podía
   mostrar más de una fila aunque el Sheet sí tuviera v1/v2/v3 guardadas. Se agregó `_historialDe()`
   y el campo `historial` en la respuesta; la Ficha ahora lista todas las versiones.
3. **`cargarRegistro()` corregido**: ya no traga errores de `obtenerPresupuesto` en silencio —se
   muestra un aviso visible en la pantalla Registrar en vez de dejar el formulario vacío sin
   explicar por qué.
4. **La longitud mínima de la descripción (60/40 caracteres) solo se validaba en el navegador.**
   `Presupuestos_guardar` ahora repite la misma regla en el servidor: cualquiera con un token válido
   que llame la API directo, sin pasar por el formulario, se topa con la misma exigencia.

Las cuatro correcciones se probaron en el navegador contra datos fabricados con la forma exacta de
la respuesta real del backend (no contra el backend real, que no cambia hasta que se pegue el
código nuevo en Apps Script) — sin errores de consola. Detalle en `docs/REGISTRO_DESARROLLO.md`.

### Paso 4 — Verificación (objetivo 3 del flujo) — ✅ desplegado y probado en producción 2026-09-21
13. ✅ `backend/Verificaciones.gs` (nuevo): `Verificaciones_bandeja` (todo lo `RADICADO` /
    `REQUIERE_AJUSTE` / `APROBADO` del departamento, con la sede y los ítems ya adjuntos — el
    Verificador ve hasta 37 filas, no hace falta paginar) y `Verificaciones_emitir` (guarda el
    concepto en `Verificaciones` —D-21— y aplica D-22 sobre el `estado` vigente de `Presupuestos`,
    con el mecanismo de D-39). Registradas en `Codigo.gs` como `obtenerBandejaVerificacion` y
    `emitirConcepto`.
14. ✅ Pantalla Verificación conectada: franja de cifras real, bandeja clicable, panel "Emitir
    concepto" con el cruce daño↔presupuesto de esa sede (D-34), los 3 resultados de D-22, validación
    de observaciones (≥20 caracteres si no es "corresponde") y el botón "Devolver al municipio" como
    atajo de "no corresponde". El botón "Verificar" de la Ficha abre directo el concepto de esa sede
    (`irVerificacionSede`). Probado con datos fabricados con la forma exacta del backend nuevo —
    franja, bandeja, cruce de capítulos, las dos validaciones y el payload que viaja a
    `emitirConcepto` quedaron verificados; sin errores de consola.

**Desplegado y probado en producción 2026-09-21.** `Verificaciones.gs` y el `Presupuestos.gs`
actualizado (D-39/D-40) se pegaron en el proyecto real y se subió "Nueva versión" sobre la
implementación **"Paso 0 — 6 pestañas..."** correcta (sin repetir la confusión del Paso 3).
Prueba de punta a punta con la cuenta Administrador real, contra el backend real:

- Login completo (`solicitarCodigo` → correo real → `validarCodigo` con el código recibido).
- Radicación de prueba sobre `217013000394` (Ángel de la Guarda, Aguadas) para tener algo que
  verificar: `217013000394-v1`.
- `obtenerBandejaVerificacion` trajo la fila real con sus ítems adjuntos.
- Concepto emitido con `resultado: CORRESPONDE_PARCIAL` → **confirmado D-22**: `estado` pasó a
  `REQUIERE_AJUSTE`, y **confirmado D-39**: la fila `v1` no se reemplazó (`version` siguió en 1,
  solo cambió la celda `estado`).
- Radicada una segunda versión (`217013000394-v2`) mientras la primera seguía "abierta" en
  pantalla, y se intentó emitir el concepto sobre la `v1` ya obsoleta: **confirmado el candado de
  concurrencia de D-39** — el backend rechazó con *"Esta versión ya no es la vigente (la actual es
  217013000394-v2) — recargue la bandeja"*.
- Concepto emitido sobre la `v2` con `resultado: CORRESPONDE` → `estado` pasó a `APROBADO`.
- Panel "Emitir concepto" renderizando el cruce daño↔presupuesto (D-34) contra `capitulos_dano`
  real de la sede, y `valor_referencia` vs `total_presupuesto` mostrados lado a lado sin restarse
  (D-28).

**Limpieza pendiente/hecha:** las filas anteriores son datos ficticios de esta prueba, no un
presupuesto real. Se retiraron a mano del Sheet (Presupuestos, Items, Verificaciones) con una
función de un solo uso corrida directo en el editor de Apps Script y luego eliminada — el sistema
no tiene ni debe tener una acción de borrado (D-37), así que esta limpieza no deja rastro en la API
a propósito, igual que no lo dejaría un alcalde real que nunca llegó a existir.

### Paso 5 — Cargas (objetivo 2) — ✅ código completo y desplegado 2026-09-21, prueba en producción pendiente
15. ✅ **`tools/ingesta.py` gana un modo `--json`.** Hasta ahora los 4 lectores solo imprimían el
    informe por consola: no había ningún archivo que la pantalla Cargas pudiera recibir. Ahora
    `python tools/ingesta.py <MUNICIPIO> --json` además escribe `data/generado/ingesta_<MUNICIPIO>.json`
    (`esquema: 1`, mismo patrón que D-12 en el sistema viejo) con los `registros` y `hallazgos` tal
    cual los calculó el lector. Probado de verdad contra los archivos reales: Samaná (77 registros,
    29 hallazgos) y Aranzazu (9 registros, todos con DANE propuesto por nombre).
16. ✅ **`Presupuestos_guardar` admite `origen: CARGA` desde `VERIFICADOR`** (D-40) — antes solo
    `RESPONSABLE_SEDE`/Administrador podían guardar presupuesto.
17. ✅ Pantalla Cargas reconstruida por completo (antes era 100 % estática, sin un solo `id` ni
    listener): sube el JSON (clic o arrastrar), muestra el informe real (registros leídos, errores
    que no generaron fila, advertencias), y por cada registro deja **confirmar** el DANE cuando el
    lector lo propuso por nombre (`dane_origen=propuesto`) — la casilla de esa fila es la
    confirmación humana que exige D-23, nunca viene premarcada. Las filas fuera del lote 1 tampoco
    vienen premarcadas (D-40). "Volcar confirmados" llama `guardarPresupuesto` una vez por fila
    marcada y muestra qué quedó bien y qué falló.
18. ✅ **Granularidad según D-36/D-41:** se verificó contra los 4 lectores reales que **ninguno**
    —tampoco Belalcázar— exporta hoy capítulo por ítem ni A/U/IVA/plazo (`RegistroIngesta` solo trae
    `costo_directo`). D-36 preveía ese caso para 3 de 4 municipios; en la práctica aplica a los 4
    todavía. Se vuelca como un ítem único "sin desglose" (D-41) en vez de un total suelto —el cruce
    daño↔presupuesto lo trata correctamente como no verificable por capítulo, sin inferir nada.

**Probado de punta a punta en el navegador, con los JSON reales generados en el punto 15** (no con
ejemplos inventados): subir el archivo, ver el informe, confirmar dos DANE propuestos de Aranzazu,
marcar sus casillas, volcar, y confirmar que las filas volcadas correctamente desaparecen de la
lista pendiente y las que fallan se quedan para reintentar. Sin errores de consola.

**Confirmado en producción 2026-09-21.** Con `ingesta_ARANZAZU.json` (9 registros, los 9 con DANE
propuesto por nombre — ninguno traía DANE en el Excel): la pantalla mostró las 4 filas con
coincidencia en el catálogo sin premarcar (D-40), se confirmaron 2 a mano (Buenos Aires
`217050000060`, Campo Alegre `217050000116`) y "Volcar confirmados" llamó `guardarPresupuesto` real
dos veces. Verificado leyendo de vuelta ambos registros con `obtenerPresupuesto`: `origen: CARGA`,
`archivo_origen: ingesta_ARANZAZU.json`, `creado_por: data@sedcaldas.edu.co`, un ítem único por
sede con `capitulo` vacío/`unidad: gl`/`cantidad: 1`/`valor_unitario` = costo directo exacto del
Excel, y la nota de D-36 en `descripcion_afectacion` sobre la falta de desglose — exactamente el
comportamiento de D-36/D-40/D-41. Las 5 filas sin coincidencia en el catálogo (Camelia Pequeña,
Camelia Alta, La Meseta, Buenavista, San Rafael — los 5 errores que ya reporta H-8) se quedaron sin
volcar, tal como debía ser. Tras confirmar, la lista pendiente pasó de 9 a 7 filas.

### Paso 6 — Hallazgos y cierre
19. ✅ **2026-09-23** — Pantalla **Hallazgos** (Administrador y Verificador) conectada a la pestaña
    real, con «Marcar resuelto» (quién y cuándo). Los hallazgos se **detectan solos** al radicar o
    cargar (D-42); ninguno se resuelve solo. Los 19 históricos de `CONFLICTOS_Y_HALLAZGOS.md` se
    sembraron y luego el usuario pidió dejar solo los de prueba (borrado manual de las filas H-1..H-19).
20. ✅ PDF del formato oficial, con registro fotográfico real (2026-09-23).
21. ⏳ Correo de confirmación con el radicado — **código listo 2026-09-24** (`Presupuestos.gs`, solo al
    radicar a mano), falta desplegar y verlo llegar.
22. ✅ **2026-09-23** — Pantalla **Usuarios** conectada (listar, crear, activar/desactivar). Los 187
    Responsables de sede del borrador D-24 quedaron **desactivados** (no borrados) hasta que alguien
    confirme sus correos; activos solo los 6 usuarios internos.
23. ✅ **2026-09-24** — Limpieza del mockup y D-43: fuera el marco de diseño (título, selectores de
    pantalla y de rol, barra de navegador falsa, notas de simulación) y todos los datos de ejemplo del
    HTML; sin sesión solo existe la pantalla de ingreso; Tablero, Sedes, Municipio y Ficha leen el
    estado real de cada presupuesto; sale `valor_referencia` de todas las pantallas.
24. ⏳ **2026-09-24** — Transporte robusto (Apps Script a veces responde lo de `doGet` a un POST: se
    detecta y se reintenta; `accion` en cada respuesta; tiempo límite de 60 s), sesión que sobrevive a
    F5 (`sessionStorage`) y que se corta si el usuario se desactiva o cambia de rol, Ficha que pinta el
    resumen al instante, catálogo en caché y una sola lectura de `Presupuestos` por consulta. Código
    listo y probado con simulación; falta desplegar y confirmarlo en real.
25. ⏳ **2026-09-24** — **Lotes (D-44)**: pantalla del Administrador, selector de lote en Tablero, Sedes y
    Municipio, Responsable de sede con todo su alcance. Código listo y probado con simulación; falta
    desplegar `Lotes.gs` y correr `crearHojas()`.
26b. ⏳ **2026-09-24** — **D-45**: un borrador guardado sobre un radicado queda en espera y no lo
    reemplaza; hallazgos automáticos solo al radicar. Registrar retoma el borrador; la Ficha lo marca.
    Probado con el arnés (43/43); desplegado (confirmado 2026-09-25), falta probarlo en real.
26c. ⏳ **2026-09-24** — **Cargas corregida**: municipio comparado sin tildes (Samaná y Belalcázar no
    cruzaban ninguna fila), volcado por tandas con `volcarCarga` (idempotente), filas en $0 y DANE
    repetidos no se vuelcan, casillas estables tras un volcado parcial, «ya volcada desde este archivo».
    Probado con arnés (54/54) y simulador con el JSON real de Samaná; desplegado (confirmado
    2026-09-25), falta correr `docs/GUION_CASO_DE_EXITO.md`.
26. ✅ **2026-09-24** — Pulido visual y novedades (frontend): encabezado de vista, avisos y diálogos propios
    (sin `alert`/`confirm`), revisión antes de radicar y confirmación con número de radicado, días en
    espera con semáforo, línea de tiempo por sede, buscador de sedes, exportar a Excel (CSV), menú de
    celular. Probado con backend simulado.

---

## 3.c Hoja de ruta a producción — aprobada 2026-09-25

Aprobada por el usuario el 2026-09-25 («Me convence el plan, déjalo»). Cambia la pregunta de «¿qué
más le falta?» por «¿qué hace falta para pasar a la siguiente etapa?»: cada hito tiene **una sola
condición de salida verificable** y, cuando se cumple, se pasa al siguiente aunque queden detalles.

**Reglas que la sostienen:**
1. Fuera de la lista cerrada del hito 0, no se agrega nada nuevo hasta terminar el piloto. Las ideas
   van a «Después del piloto» (abajo) y se priorizan con evidencia de uso.
2. Cada sesión cierra un paso concreto del hito en curso, o deja escrito qué lo bloquea.
3. Claude no propone mejoras por su cuenta: solo reporta lo que bloquea el hito en curso.
4. Un defecto se corrige solo si bloquea. Un texto mejorable o una pantalla lenta que funciona no bloquean.

| Hito | Pregunta que responde | Condición de salida |
|---|---|---|
| 0 | ¿Está completo lo que el usuario quiere mostrar? | Los 8 puntos de abajo hechos, verificados con simulador y arnés, y documentados |
| 1 | ¿Funciona de punta a punta? | `docs/GUION_CASO_DE_EXITO.md` en verde, en real |
| 2 | ¿Es lo que la Secretaría necesita? | Decisiones del jefe **por escrito** (Q-3, Q-7, Q-14, municipio y arquitecto piloto, publicar y borrar datos de prueba, D-19) |
| 3 | ¿Le sirve a quien lo usa? | Presupuestos reales radicados por un municipio y verificados por un arquitecto dentro del sistema, en 2 semanas |
| 4 | ¿Cubre la obra? | Una sede con contrato y avance registrados, con los campos que defina el jefe (Q-14) |

**Límite medido que condiciona el hito 3 y la extensión a los 26 municipios:** el cupo de correo de la
cuenta que despliega el backend es de **100 al día** (`MailApp.getRemainingDailyQuota()` = 100, medido
el 2026-09-25 a las 8:35 sin correos enviados ese día). Cada ingreso gasta uno (código de un solo uso),
igual que cada radicación y cada concepto. Alcanza para un piloto de un municipio; para los 26
municipios con sus rectores activos no alcanza en un día de mucho uso. Se lleva a la reunión del hito 2.

### Hito 0 — lista cerrada, pedida por el usuario el 2026-09-25

Todo se prueba con simulador y arnés; se despliega **una sola vez** al final, y el hito 1 prueba en
real la versión final. (`Presupuestos.gs`, `Codigo.gs` y `Sedes.gs` del 2026-09-24 ya están
desplegados: el usuario lo confirmó el 2026-09-25 y el `/exec` publicado reconoce `volcarCarga`.) Orden:

1. ✅ **2026-09-25** — **Dividir el `<script>`** del mockup en archivos (hecho: `app/`, ver `app/README.md`) (`index.html`, CSS y un JS por pantalla, scripts
   clásicos sin módulos ni dependencias, porque los `onclick` usan funciones globales). Movimiento
   mecánico, sin cambiar comportamiento; verificación: los archivos concatenados en orden deben ser
   idénticos al `<script>` original. Va primero porque todo lo demás edita ese código.
2. ✅ **2026-09-25** — **Sedes con las 975** y filtros explícitos (D-46).
3. ✅ **2026-09-25** — **Pantalla de Inicio** por rol (D-46); corrige además el riel que mostraba pantallas de más a Verificador y Consulta.
4. ✅ **2026-09-25** — **Lista de tareas en Registrar:** panel «Antes de radicar» junto al botón, con lo que falta (bloquea) y lo recomendado (no bloquea); cada pendiente lleva a su sección.
5. ✅ **2026-09-25** — **Precargar el detalle de la Ficha:** memoria por sede y carga anticipada al pasar sobre una fila (máximo 2 pedidos de precarga a la vez).
6. ✅ **2026-09-25** — **Lotes más rápida:** crear, agregar, quitar y cerrar actualizan la memoria del navegador en vez de volver a pedir las 975 sedes (antes, ~20 s por operación).
7. ✅ **2026-09-25** (desplegado ese día) — **Correo al emitir concepto** (`Verificaciones.gs::_avisarConcepto`), con las observaciones cuando se devuelve para ajuste. No se envía si el presupuesto entró por Cargas, si quien radicó es quien emite, si ya no está activo o si no queda cupo.
8. ✅ **2026-09-25** — **Revisión WCAG 2.1 AA y lineamientos GOV.CO.** Accesibilidad revisada contra el
   Anexo 1 de la Resolución MinTIC 1519 de 2020 (CC1–CC32) y corregida; detalle en `REGISTRO_DESARROLLO.md`.
   **GOV.CO (Resolución 2893 de 2020, Anexo 2) queda como decisión del usuario:** según su propio alcance
   aplica a la *sede electrónica* de la entidad (su portal oficial, con los menús Transparencia · Servicios
   a la Ciudadanía · Participa y la barra superior GOV.CO); este sistema es una aplicación interna con inicio
   de sesión, no la sede electrónica de la Gobernación ni un trámite ciudadano. Si el jefe decide que debe
   llevar la barra GOV.CO, choca con `DISENO_01` (azul institucional de GOV.CO frente a la paleta del logo).

**Hito 0 cerrado el 2026-09-25.** Hito 1: `docs/GUION_CASO_DE_EXITO.md` actualizado ese día (Inicio, «Contar
sobre», «Antes de radicar», precarga, Lotes, correo del concepto con una vuelta devolver → corregir →
aprobar, comprobación rápida de accesibilidad, pasos cronometrados); **falta correrlo en real**.

### Después del piloto (anotado, no se hace antes)

Seguimiento de obra (hito 4, Q-14) · tamizaje de las 975 (D-3/D-4) · lector de San José · texto
obsoleto de `Setup.gs::crearHojas` · datos personales en el historial público del repositorio (decisión
del usuario, `docs/HANDOFF_2026-09-24.md` punto 8) · **política CSP estricta** para `app/` (anotado
2026-09-25): el token de sesión vive en `sessionStorage` y hoy lo protege `esc()` en todo dato que se
pinta; una CSP sin `unsafe-inline` exige antes cambiar los `onclick="…"` del HTML por `addEventListener`.

---

## 4. Lo que falta para arrancar — y quién lo tiene que dar

**Actualizado 2026-09-16.** Esta es la única lista de pendientes vigente — la tabla «Pendientes» de
`CLAUDE.md` §8 es histórica (sistema viejo) y no se vuelve a actualizar.

**Bloquean el paso 0:**

| # | Qué falta | Quién | Estado |
|---|---|---|---|
| 1 | Nombre del repositorio y visibilidad | Practicante | ✅ **Hecho** — `github.com/Jostrel19/reconstruccion-sedes`, público |
| 2 | Lista de Administrador, Verificador y Consulta: nombre + correo | Jefatura | ✅ **Hecho** — 6 personas confirmadas (2 Administrador, 2 Verificador, 2 Consulta), en `data/insumos/usuarios_manual.csv` |
| 3 | Cuenta de Google para desplegar el Apps Script, y probar que despliega | Practicante | ✅ **Hecho 2026-09-17** — desplegado con Gmail personal (`jose.saavedra2@gmail.com`, ver D-19 precisada), acceso público confirmado en incógnito, y `MailApp` entrega sin fricción a `@sedcaldas.edu.co` (Office 365) |

**Los tres bloqueantes del paso 0 están resueltos.** No queda nada pendiente para empezar el
paso 1 (backend real) — ver `docs/REGISTRO_DESARROLLO.md` para el detalle de la prueba.

**Actualizado 2026-09-17, tarde — Paso 0 y arranque de Paso 1 verificados en producción**, no solo
en código: Sheet real creado con las 6 pestañas (`crearHojas`), `Sedes` y `Usuarios` cargadas desde
`tools/exportar_backend.py`, las 5 pestañas de escritura protegidas contra edición directa (D-37),
desplegado como Web App, y probado con `curl` de punta a punta: `solicitarCodigo` →
`validarCodigo` → token real → `listarSedes` devuelve las 975 sedes con `valor_referencia` visible
para `ADMINISTRADOR`. **Sin probar todavía:** el filtro de alcance para `RESPONSABLE_SEDE` y
`VERIFICADOR` — el código lo implementa (`Sedes.gs::_enAlcance`) pero no hay forma de probarlo sin
acceso a un correo real de alcalde/rector/arquitecto.

**Actualizado 2026-09-17, más tarde — Paso 1 cerrado.** `docs/diseno/mockup_v6.html` ya no simula el
login: llama al backend real (`BACKEND_URL` apunta al despliegue vigente), y el rol/nombre/alcance
que muestra la interfaz salen de la respuesta de `validarCodigo`. Probado con la cuenta
Administrador de punta a punta en el navegador.

**Resuelto el mismo día:** `Auth_solicitarCodigo` ya limita a **un código nuevo por correo cada 60
segundos** (`CacheService`, clave `cooldown_<correo>`), aplicado antes de mirar si el correo existe
y con la misma respuesta `{ok:true}` en cualquier caso — así el límite no delata qué correos están
en `Usuarios`. **Pendiente del lado del usuario:** pegar el `Auth.gs` actualizado en el proyecto real de Apps Script
**y actualizar la implementación** (`Implementar > Administrar implementaciones > editar > Nueva
versión`) — el código nuevo no llega solo a la URL `/exec` ya publicada.

**Actualizado 2026-09-17, tarde-noche — 3 mejoras de resiliencia (D-38), a petición explícita del
usuario tras revisar qué tan sólido está el sistema:** `Auth_validarCodigo` bloquea un código tras 5
intentos fallidos (`backend/Auth.gs`); `backend/Backup.gs::configurarRespaldoAutomatico` respalda el
Sheet completo a Drive todos los días; `docs/RUNBOOK_CONTINUIDAD.md` documenta el traspaso de la
cuenta personal que sostiene todo esto. **Pendiente del lado del usuario:** pegar `Auth.gs`
actualizado y `Backup.gs` nuevo en el proyecto real, correr `configurarRespaldoAutomatico` una vez, y
actualizar la implementación (`Nueva versión`) para que el bloqueo de intentos quede activo.

**Actualizado 2026-09-17, noche — Paso 2 completo (ítems 9 y 10).** `docs/diseno/mockup_v6.html` ya
no muestra Samaná de ejemplo en Sedes/Municipio/Ficha: las tres pantallas llaman `listarSedes` y
pintan el catálogo real, con drill-down real (clic en municipio → sus sedes; clic en sede → su
ficha) y migas/riel funcionales. El Tablero quedó igual de conectado, incluido el mosaico de
municipios como acceso directo. Probado de punta a punta con la cuenta Administrador: cifras
($9.718.464.165, 37 sedes, 34 no habilitadas, 2.623 estudiantes) calculadas en el navegador contra
el catálogo real y verificadas iguales a las que ya documentaba `CLAUDE.md` §7. Detalle completo en
`docs/REGISTRO_DESARROLLO.md`. **Sigue el Paso 3** (Registrar presupuesto).

**Actualizado 2026-09-21 — Pasos 4 y 5 desplegados; Verificación confirmada en producción, Cargas
pendiente de probar.** `backend/Verificaciones.gs` (nuevo) y los cambios de `backend/Presupuestos.gs`
(D-39, D-40) se pegaron en el proyecto real y se subió "Nueva versión" sobre la implementación
correcta ("Paso 0 — 6 pestañas..."). `obtenerBandejaVerificacion`/`emitirConcepto` se probaron de
punta a punta contra el backend real con la cuenta Administrador (detalle completo en el Paso 4 de
§3): D-22, D-28, D-34, D-39 (mutación de una sola celda) y el candado de concurrencia de D-39
quedaron confirmados con datos reales, no simulados. Los datos de esa prueba (`217013000394-v1/v2`)
eran ficticios y se retiraron del Sheet a mano — ver nota de limpieza en el Paso 4.

**Cargas confirmado en producción el mismo día** (detalle en el Paso 5 de §3): `ingesta_ARANZAZU.json`
volcado con 2 de 9 registros confirmados y verificados contra el backend real. Igual que con
Responsable de sede, tampoco hay todavía un correo real de arquitecto para probar el alcance del
rol Verificador en producción — Verificación y Cargas siguen probadas solo con Administrador.

**Datos de prueba en el Sheet real, pendientes de limpiar en una sola pasada:** `217013000602`
(v1/v2/v3, prueba del Paso 3), `217050000060-v1` y `217050000116-v1` (prueba de Cargas). Ninguno es
un presupuesto real de un municipio.

**No bloquean, pero hay que resolverlos antes de dar acceso real:**

| # | Qué falta | Quién |
|---|---|---|
| 4 | Confirmar que los **187 correos** de alcaldes/rectores siguen vigentes (los 6 internos ya están confirmados) | Alcaldías / rectorías |
| 5 | **Q-3:** aval de Planeación a los umbrales A > 12 %, U > 8 %. **Ya no es teórico:** Aguadas y Aranzazu radican con **A 25 %** — la alerta va a saltar en casi todo lo que llegue de esos dos. Hay evidencia concreta que llevarle | Planeación |
| 6 | **Q-7:** mapa definitivo resultado → estado. Mientras tanto rige **D-22** | Planeación |
| 7 | Las **5 sedes priorizadas sin capítulo de daño marcado** en `dimDaños`: están en el lote pero no hay contra qué verificar su presupuesto | Arquitectos |
| 8 | **Q-13:** logo oficial en alta y manual de identidad. Hoy se usa el PNG del repo | Comunicaciones |
| 9 | **Q-4:** ¿se agregan campos que el formato oficial no pide (profesional que elabora, obra en curso, cofinanciación)? | Planeación |
| 10 | **Q-12:** «el catálogo que próximamente se subirá» — ¿es el catálogo de sedes (ya resuelto, es `dimDaños`) o un catálogo de **precios unitarios** para validar presupuestos? Son diseños distintos; D-35 asume que no existe todavía | Planeación |

**No urgente, pertenece a Fase 4 (módulo Obras/Monitoreo), aplazada por decisión propia:**

| # | Qué falta |
|---|---|
| 11 | **Q-14:** datos del contrato o mecanismo de ejecución (número, contratista, valor, plazo, actas). Sin esto no se diseña el módulo 4 — no se está intentando ahora |

**Ya cerradas, no se repreguntan:** Q-1, Q-2, Q-5, Q-6, Q-8, Q-9, Q-10, Q-11.

---

## 4.b Lo que sobra — se retira o no se construye

Tan importante como lo que falta. Nada de esto entra al desarrollo:

| Qué | Por qué sobra |
|---|---|
| **8 herramientas del sistema viejo**, ya movidas a `tools/_retirado/` | Pertenecen al circuito alcalde → paquete `.json` → SharePoint que retiraron D-17 y D-18. Varias leen campos que el catálogo ya no tiene |
| **`ESTIMACION COSTOS ... 08_09_2026.xlsx`** (modelo paramétrico) | Retirado por D-26. No se lee, no se guarda, no se contrasta |
| **`PrimerasPriorizadas.xlsx`** | Retirado por D-31: la priorización se deriva del tipo de afectación. Dos listas paralelas se desincronizan — y ya lo habían hecho |
| **`% de desviación` y el módulo de contraste** | D-28. Restar una estimación de visita contra un levantamiento de cantidades produce un número que no significa nada |
| **Campos `valor_modelo`, `orden_priorizacion`, `en_alcance`, `nivel_censo`** | Ya salieron del catálogo. No se reintroducen |
| **`tokens.js`, enlaces con token, `index.html` del sistema viejo** | D-18. Los reemplaza el login por código de correo (D-20) |
| **Exigir APU estructurado** | D-35. Dejaría a Samaná sin poder radicar |
| **Módulo Obras / Monitoreo** | Aplazado (Q-14): no hay datos de contratación. Queda el lugar en el riel, bloqueado con candado |
| **Módulo de firma-imagen del verificador** | D-21: lo reemplaza el registro de auditoría de la sesión |

Y una advertencia sobre lo que **no se debe agregar por iniciativa propia**: campos que el formato
oficial no pide (profesional que elabora, obra en curso, cofinanciación) siguen siendo **Q-4**, sin
resolver. No se agregan sin que alguien los pida.

---

## 5. Deuda de documentación

`docs/diseno/DISENO_01` a `DISENO_05` describen el diseño **anterior a D-26**. Siguen sirviendo para
los tokens visuales y el razonamiento anti-genérico, pero contienen referencias al modelo
paramétrico, al contraste y a la desviación, que ya no existen. **La fuente de verdad del diseño es
`app/`** (desde 2026-09-25; antes `docs/diseno/mockup_v6.html`), que sí está al día y es ejecutable.

No se reescriben ahora: no bloquean el desarrollo y reescribirlos antes de construir es trabajo que
se repite. Se actualizan cuando el módulo correspondiente esté construido y se sepa qué quedó.

---

## 6. Cómo se prueba el diseño

Ver `app/README.md`: servidor local en el puerto 8779, `node --check` de cada script y backend
simulado para recorrer las pantallas sin tocar datos reales.

Verificado el 2026-09-25, tras dividir el archivo: 10 pantallas × 4 roles y las acciones de cada una
(lotes, borrador, concepto, hallazgo, Cargas, PDF, buscador, CSV, sesión), sin errores de consola.
