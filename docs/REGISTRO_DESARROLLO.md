# Registro de desarrollo — reconstrucción de sedes

Bitácora cronológica de este proceso: qué llegó, qué se decidió y qué se construyó, en orden.
No sustituye a los otros documentos — cada uno tiene un trabajo distinto:

| Documento | Para qué sirve |
|---|---|
| **Este archivo** | El diario: qué pasó y cuándo, en orden. Se lee de arriba hacia abajo para entender cómo se llegó a donde estamos |
| `CLAUDE.md` | La verdad vigente: decisiones cerradas (`D-n`), estado actual, pendientes. Se lee para saber "qué es cierto hoy", no cómo se llegó ahí |
| `docs/diseno/DISENO_0X_*.md` | La forma y la construcción de cada módulo, ya asentada |
| `docs/CONFLICTOS_Y_HALLAZGOS.md` | Discrepancias de datos sin resolver, esperando confirmación |

Se agrega una entrada nueva cada vez que pasa algo que vale la pena dejar constancia — no es
necesario que sea diario. Entradas en orden cronológico, más reciente al final.

---

## 2026-09-15 — Diseño del sistema nuevo (D-17)

Se documentó el diseño completo del giro a sistema interno decidido el 2026-09-09: un archivo por
fase en `docs/diseno/` (`DISENO_00` a `DISENO_05`), cada uno con forma + construcción + checklist de
cierre. Se probó primero separar diseño y plan de desarrollo en series distintas
(`DISENO_*`/`PLAN_FASE_*`) y se corrigió a un solo archivo por fase al detectar que la sección "qué
se reutiliza" quedaba duplicada entre ambas series.

## 2026-09-15 — Llegan los primeros insumos reales

Se recibieron y se ubicaron en el proyecto:

- `data/entregas_excel/` — presupuestos reales de 6 municipios: Aguadas, Aranzazu, Belalcázar,
  Samaná, San José, Victoria.
- `data/insumos/PrimerasPriorizadas.xlsx` — priorización cerrada de 33 sedes (12 municipios) para
  arrancar el plan de reconstrucción, con DANE de sede.

Al inspeccionar los 6 presupuestos reales se confirmó que la heterogeneidad de formato es más
severa de lo que anticipaba `DISENO_04`: no son columnas con nombres distintos, son **paradigmas de
documento distintos** (presupuesto de obra tipo APU con la sede como fila divisoria de texto en
Aguadas/Aranzazu; diagnóstico por sede con dos columnas de valor en Samaná; ítems limpios con DANE
en encabezado en San José; carpeta de varios archivos sin DANE en Belalcázar; un oficio PDF sin
datos estructurados en Victoria).

Cruce contra las 33 priorizadas: de los 12 municipios, solo 4 (Aguadas, Aranzazu, Belalcázar,
Samaná) habían enviado algo. San José y Victoria enviaron presupuesto pero **no están entre los 12
municipios de la priorización** (`H-2` en `CONFLICTOS_Y_HALLAZGOS.md`).

**Decisión de arquitectura:** no construir la UI de "mapeo asistido" genérica que proponía
`DISENO_04` original. En su lugar, un **registro de lectores** (`tools/ingesta.py`): un municipio,
una función lectora, todas convergiendo al mismo esquema de salida
(`tools/ingesta_esquema.py::RegistroIngesta` + `Hallazgo`). Se agrega un lector cuando se ve un
archivo real de ese formato — nunca antes, para no adivinar sobre un formato que no se ha visto.
Justificación completa en la conversación del 2026-09-15; se traslada a `DISENO_04` en la próxima
edición de ese archivo.

## 2026-09-15 — Primer lector construido y probado: Samaná

`tools/ingesta_samana.py` — formato diagnóstico-por-sede (una hoja por I.E., DANE en columna
"CODIGO DANE", costo directo = materiales + mano de obra). Se eligió como primer lector por ser el
más simple de los cuatro formatos vistos y el único con DANE limpio.

Al correrlo contra el archivo real (`python tools/ingesta.py SAMANA`) salieron dos tipos de
resultado:

1. **Un defecto real del lector**, corregido antes de seguir: la hoja `I.E PIO XII` trae una segunda
   tabla apilada debajo de la de sedes (una lista de precios de materiales) sin encabezado propio.
   El lector la seguía leyendo como si fueran más sedes. Se corrigió deteniendo la lectura de una
   hoja al encontrar dos filas vacías seguidas.
2. **Hallazgos genuinos de los datos**, no del lector — quedaron en `CONFLICTOS_Y_HALLAZGOS.md`
   (`H-4` a `H-6`): DANE con la cantidad de dígitos incorrecta en varias filas de `I.E PIO XII`
   (una de ellas, fila 4, es la sede priorizada orden 33 — bloquea su cruce automático hasta que
   Samaná confirme el DANE correcto), y filas donde el DANE viene reemplazado por texto describiendo
   una sede cerrada.

Resultado final: 77 de 96 filas del archivo se leen como registros válidos; el resto queda
explícitamente en el informe de validación (error o advertencia), nada se volcó en silencio.

**Siguiente paso acordado:** lector compartido para Aguadas/Aranzazu (mismo formato APU). Belalcázar
queda después, pendiente de decidir cómo confirmar el cruce por nombre sin DANE.

## 2026-09-15 — Diseño visual cerrado (v5)

Cinco iteraciones del modelo de diseño, la última con: nombres en español llano (**Cargas** en vez de
«Ingesta», **Obras** con un solo nombre), roles renombrados (**Responsable de sede** en vez de
«Estructurador», que en un proyecto de infraestructura se leía como *ingeniero estructural*;
**Consulta** en vez de «Consultor», que en contratación pública significa contratista externo), y
**D-6 aplicada de verdad**: el tablero y todo valor estimado por la SED quedan ocultos a roles
externos, demostrado con un selector de rol en la propia maqueta.

Fundamentado en el GOV.UK Design System (nombres sin jerga, color solo funcional, una etiqueta de
estado por elemento) y en el patrón de portafolio de obra (drill-down portafolio → sitio → proyecto).
Se descartó deliberadamente el *bento grid*, la tendencia de 2026, porque las propias fuentes lo
desaconsejan para interfaces densas de datos.

## 2026-09-15 — Segundo lector: formato APU (Aguadas y Aranzazu)

`tools/ingesta_apu.py`. Es el formato donde **la sede no es una columna sino una fila divisoria**,
así que se lee con estado en vez de mapeando columnas. Ninguno de los dos archivos trae código DANE:
el lector lo **propone** cruzando por nombre contra el catálogo y deja el registro sin volcar hasta
que alguien lo confirme (`dane_origen='propuesto'`).

Cuatro defectos encontrados al probar contra los archivos reales, todos corregidos:

1. **`IVA` hacía match dentro de `ADHESIVA`.** Las filas de cierre se detectaban por subcadena, así
   que los ítems de «canaleta adhesiva» se descartaban como si fueran la fila del impuesto. Se pasó
   a comparación con límite de palabra. Era un error silencioso: restaba $113.191 a una sede sin
   avisar.
2. **El cruce por nombre proponía el mismo DANE a cinco sedes distintas.** Al no quitar el nombre de
   la institución, «...OSORIO - SEDE PRINCIPAL» quedaba contenido en todas las sedes de esa I.E.
   Ahora se compara solo la parte distintiva del nombre.
3. **Los divisores de institución venían en la columna ITEM**, no en la de descripción, y uno con
   error de digitación (`INSITUCIÓN`). Sin ellos, tres filas que dicen solo «SEDE PRINCIPAL» eran
   indistinguibles — y dos son sedes priorizadas.
4. **La alerta de Administración se marcaba como error.** El instrumento alerta, no bloquea (§4 del
   `CLAUDE.md`): no hay tope legal de AIU. Corregido a advertencia.

Verificación: Aranzazu suma **$93.722.647 con diferencia cero** contra el total declarado por el
propio archivo; Aguadas lee 20 sedes y cruza 18. Los hallazgos H-7 a H-14 quedaron en
`CONFLICTOS_Y_HALLAZGOS.md` — el más serio es **H-10**: entre los dos municipios solo cubren 2 de
las 9 sedes priorizadas que les corresponden.

## 2026-09-15 — Tercer lector: Belalcázar (tres formatos en un municipio)

`tools/ingesta_belalcazar.py`. Al abrir la carpeta que mandó la alcaldía resultó que H-3 se quedaba
corto: no es un archivo sin DANE, son **tres archivos con tres formas de documento distintas**,
separadas por nivel de afectación:

1. **Intermedia (10 sedes)** — una hoja por sede con el total ya declarado y una lista de
   materiales debajo. La hoja `SEDES EDUCATIVAS` es el índice institución↔sede que el resto del
   archivo necesita para poder proponer un DANE.
2. **Grave, 3 instituciones** (El Águila, El Madroño, San Isidro) — un presupuesto de obra
   profesional completo (miles de actividades, formato de constructora) con un total de costo
   directo **por institución**, en columnas paralelas.
3. **Grave, Manuela Beltrán** — un cuarto presupuesto suelto, también por institución, en un
   archivo aparte.

`leer()` recibe la carpeta del municipio (no un archivo, a diferencia de los demás lectores) y
combina los tres. El hallazgo de fondo, verificado antes de proponerlo y no asumido: los tres
presupuestos "grave" son por INSTITUCIÓN pero el sistema necesita DANE DE SEDE. La hipótesis
—confirmada contra el catálogo, no adivinada— es que cada total corresponde a la sede principal de
esa institución, porque las sedes rurales de esas mismas tres instituciones ya están cubiertas por
el lote de intermedia y la matrícula del archivo es del orden correcto (Manuela Beltrán: 139
estudiantes en el archivo frente a 142 en `fctMaestra`). Queda como `dane_origen='propuesto'` con
hallazgo explícito pidiendo confirmación de infraestructura — nunca como dato firme.

Resultado: 14 sedes leídas (10 intermedia + 3 institución grave + Manuela Beltrán), 9 con DANE
propuesto y 5 en error real: tres nombres de sede que no existen en el catálogo bajo ninguna
institución de Belalcázar (TURQUEZA, VERDUM, GAVIOTAS — H-15), una sede ambigua con dos candidatas
en el catálogo (San Isidro — H-16), y «aulas móviles», que no es una sede física con DANE (H-17).
H-18 y H-19 documentan la inferencia institución→sede principal. Con esto, de los 4 municipios del
lote 1 que ya mandaron archivo, los 4 tienen lector.

## 2026-09-15 — Backend del sistema nuevo: Google Apps Script (D-19 a D-23)

Se revisó `circular122` (otro sistema de la SED, mismo dominio institucional) para ver cómo resolvió
el mismo problema que traíamos abierto desde que se descartó Power Automate Premium (D-1): corre
sobre Google Apps Script, con roles por correo institucional, carga de archivos y auditoría, todo
gratis. No se había puesto sobre la mesa porque la exploración de §8.1 se quedó buscando alternativas
dentro del mundo Microsoft (Logic Apps, Functions + Graph).

Cinco decisiones cerradas en la misma conversación, todas condicionadas por lo que ya existe (D-6,
`api.js` desacoplado, el mockup v5, el modelo de datos de §6):

- **D-19 — Backend:** Apps Script + Sheets (base de datos) + Drive (archivos), reemplaza la
  exploración de §8.1 para el sistema nuevo. `api.js` no cambia de forma, solo de URL.
- **D-20 — Autenticación:** Google Sign-In (cualquier cuenta) + lista blanca en la pestaña
  `Usuarios`, verificada en el servidor. Se descartó restringir el login al dominio
  `@sedcaldas.edu.co` (más simple, pero cierra la puerta a cualquier actor externo) y el login propio
  con contraseña (control total, pero carga de mantenimiento sobre el practicante). El frontend se
  queda en GitHub Pages — no hace falta moverlo a Apps Script.
- **D-21 — Firma del Verificador:** se reemplaza la firma-imagen de D-13 por el registro de
  auditoría de la sesión (quién, con qué cuenta, cuándo). D-13 sigue vigente para lo ya construido
  del sistema viejo.
- **D-22 — Regla `resultado_verificacion` → `estado` (provisional):** solo «corresponde» aprueba;
  «corresponde parcialmente» y «no corresponde» piden ajuste. Es la regla conservadora mientras
  Planeación responde Q-7 — evita aprobar hacia obra un presupuesto que el propio verificador marcó
  incompleto. El dato crudo de `resultado_verificacion` se conserva siempre; solo cambia a qué
  `estado` empuja.
- **D-23 — Volcado:** pantalla de importación dentro de Cargas, no llamada directa de Python al
  backend. Mantiene un solo camino autenticado para todo lo que escribe en el sistema.

Queda pendiente una prueba de 10 minutos antes de programar: confirmar que la cuenta de Google de la
Secretaría puede desplegar un Web App de Apps Script sin tropezar con una política del dominio.

## 2026-09-15 — D-20 revisada: código por correo en vez de Google Sign-In

Las cuentas institucionales de la SED son de **Office 365**, no de Google — un dato que no se había
puesto sobre la mesa al proponer Google Sign-In. Pedirle a un directivo o a un arquitecto que tenga
una cuenta de Google personal para entrar a esta herramienta de trabajo era fricción injustificada, y
probablemente **no era ni lo que hace `circular122`**: su "validación de correo institucional" es más
consistente con un directorio propio que con SSO real de Google.

Se cambió a **código de un solo uso por correo** (mismo patrón que D-9): el usuario escribe su correo,
Apps Script lo busca en `Usuarios` antes de mandar nada, envía un código de 6 dígitos por
`MailApp`/`GmailApp` (entrega SMTP normal — le llega a Outlook igual que a cualquier destinatario
externo), y al validarlo entrega un token de sesión. No depende de qué proveedor de correo use nadie,
no exige registrar nada en Entra ID ni en Google Workspace, y reutiliza un patrón ya aceptado en el
proyecto.

**Aclaración importante que surgió al cerrar esto:** cambiar el mecanismo de autenticación no toca el
módulo de roles. Son dos capas separadas — autenticación ("¿quién sos?") y autorización ("¿qué podés
hacer?") — y solo cambió la primera. El reparto de roles (Administrador / Verificador / Responsable
de sede / Consulta) y sus alcances sigue exactamente como se diseñó en el mockup v5 y en la pestaña
`Usuarios`.

## 2026-09-16 — Giro a «solo valores reales»: dimDaños reemplaza al modelo (D-26 a D-31)

Cambio de fondo pedido por la Secretaría: **el modelo paramétrico sale del sistema**. Ya no se
contrasta contra él, no se calcula desviación y su archivo no se lee. La verdad pasa a ser el censo
vivo que mantienen los arquitectos.

### Qué se inspeccionó antes de tocar nada

`data/insumos/dimDañosInfraestructura.xlsx`, hoja `EstadoInfraestructura` (975 filas × 37 columnas):

- **975 DANE, cruce exacto contra el catálogo, 0 discrepancias** en ambos sentidos. No hubo que
  proponer ni descartar ninguna sede.
- Las columnas 18-28 son daño marcado con «X» por capítulo, y son **exactamente** los 11
  `CAPITULOS` de `config.js`. Eso permitió reemplazar la desviación borrada por un cruce con
  sentido: qué capítulos tienen daño contra qué capítulos tienen presupuesto.
- `PRESUPUESTO APROX INVERSION`: 162 sedes con valor, $14.260.058.745 en total.

### Las 37 del lote 1

Priorizada = tipo de afectación 1 o 2, los dos que el censo marca `PRIORITARIO`. Da 37 exactas, en
12 municipios, **las 37 con valor de referencia**, suma $9.718.464.165.

Contra las 33 de `PrimerasPriorizadas.xlsx`: 32 se mantienen, entran 5, **sale 1** (La Dorada,
`117380000134`, reclasificada a tipo 4) → hallazgo abierto, hay que confirmarlo.

### Por qué desaparece la desviación, con evidencia

Comparando el valor viejo del modelo contra el de `dimDaños` en las 32 sedes que se mantienen, los
valores divergen por factores de 3× a 13×:

| Sede | Modelo | dimDaños |
|---|---:|---:|
| Ángel de la Guarda (Aguadas) | $438.750.000 | $1.055.000.000 |
| San Antonio de Arma (Aguadas) | $101.250.000 | $1.350.000.000 |
| Encimadas (Aguadas) | $180.000.000 | $5.183.267 |
| Camelia Baja (Aranzazu) | $225.000.000 | $19.766.127 |

No son desviaciones que medir: es que la cifra se reemplazó. Y **las 4 sedes de Samaná traen cifra
idéntica en ambos archivos** ($1.688.600 / $4.970.800 / $3.651.100) porque ahí ya se registró el
presupuesto real recibido. Esa mezcla es la razón de fondo para llamar al campo «referencia» y
nunca sobrescribirlo (D-27).

### Cambios en el código

- `tools/rutas.py`: se elimina `F_ESTIMACION`; entra `F_DIM_DANOS` + `H_DIM_DANOS`.
- `tools/build_catalogo.py`, sección 3 reescrita. Campos nuevos: `priorizada`, `capitulos_dano`,
  `valor_referencia`, `estado_prestacion`, `concepto_tecnico`, `certificacion`,
  `observaciones_censo`, `donante`, `observaciones_presupuesto`. Se van `valor_modelo`,
  `orden_priorizacion`, `en_alcance`, `nivel_censo`.
- `RESERVADOS` pasa a `("valor_referencia", "donante", "observaciones_presupuesto")`: D-6 sobrevive
  en su intención (el municipio no ve la cifra de la SED) aunque el modelo que la originaba ya no
  exista. Verificado que `data.js` no contiene `valor_referencia`.
- `_entero()` usa `round()`, no `int()`: truncar perdía pesos en silencio (un peso en el total del
  lote, detectado al cuadrar contra la inspección previa).
- **Nuevos:** `tools/gen_mockup_datos.py` y `docs/diseno/mockup_v6.html`.

### Mockup v6 — partiendo del v5, no reescrito

**Corrección de rumbo durante la sesión.** Primero rehíce el mockup de cero aplicando los tokens de
`DISENO_01`; el resultado no gustó y con razón: el v5 aprobado era un Artifact de la conversación
anterior, no un archivo del repo, así que lo había reinterpretado en vez de partir de él. Se
recuperó el fuente real del Artifact (122 KB), se limpió el envoltorio del visor y quedó como
`docs/diseno/mockup_v6.html` — **ahora sí versionado en el repo**, que era el punto flaco de tener
el diseño aprobado viviendo fuera.

Sobre esa base, sin tocar el diseño, entró lo nuevo:

- **Riel:** entra «Verificación» con contador de bandeja; lote 1 pasa a 37.
- **Tablero:** franja y mosaico con las cifras reales de `dimDaños`; «Valor estimado por municipio /
  modelo paramétrico» pasa a «Valor de referencia / censo de daños»; el embudo va a 37 de 975 (3,8 %).
- **Ficha:** «Contraste contra el modelo» → **«Seguimiento y control»**, dos valores lado a lado sin
  restarlos. Entra el **cruce de capítulos** (daño vs. presupuesto), que es lo que reemplaza al
  porcentaje borrado: el arquitecto no pregunta «¿se pasó un 12 %?» sino «¿presupuestó lo que se
  dañó?». Entra el **presupuesto a detalle** con 6 ítems, A/U/IVA y plazo.
- **Verificación (nueva):** bandeja de 6 radicados con alcance departamental, y el panel de emitir
  concepto con los 3 resultados de D-22 y el aviso de firma por auditoría (D-21).
- **Usuarios:** fila nueva de permiso «Emitir concepto de verificación».

Dos defectos propios detectados y corregidos al probar, no asumidos:

| Defecto | Corrección |
|---|---|
| **Los radios del formulario de verificación salían apilados sobre el texto.** `.campo-v > label` (0,1,1) le ganaba a `.op` (0,1,0) y aplastaba su `display:flex` — las opciones también son `<label>` hijos directos | `.campo-v > label:not(.op)`, con el porqué escrito en el CSS |
| **El total del presupuesto a detalle ($5.122.318) no coincidía con el que mostraba el panel de Seguimiento ($5.567.296)** — la regla de la práctica es que las cifras del cuerpo y de los anexos cuadren | Se corrigió a $5.122.318 en los dos paneles. Aritmética verificada: costo directo $4.417.695 + A 10 % + U 5 % + IVA 19 % sobre la utilidad |

Probado en navegador: **8 pantallas × 2 roles = 16 combinaciones**, sin errores de consola. El rol
externo queda fuera de Tablero, Verificación, Cargas y Usuarios, y **no ve el valor de referencia**
(D-6 sigue vigente en su intención aunque el modelo que la originaba ya no exista).

**No se publicó como Artifact ni se subió a ningún servicio externo**: lleva nombres de sede y
cifras institucionales. Se abre en local.

### Cierre para desarrollo — 4 roles, diligenciamiento manual y D-32/D-33

Faltaba la pieza que hacía que el sistema no cumpliera el objetivo 1: **no había pantalla donde el
alcalde o el rector digitara el presupuesto a mano.** Se agregó «Registrar presupuesto» (D-33) con
la lógica del sistema anterior, que ya estaba probada y no había por qué reinventar: catálogos
cerrados de unidad y capítulo, cálculo automático, parseo del formato colombiano, alerta de A/U sin
bloqueo, y el aviso de readjuntar fotos con el dato de Riosucio que lo justifica.

El mockup pasó de 2 roles simulados a **los 4 reales**. El enrutado dejó de ser
`if (rol === 'ext')` y pasa por una tabla `ROLES` con lista blanca de pantallas y tres capacidades
(`ref`, `edita`, `verifica`). Verificado: **9 pantallas × 4 roles**, sin errores de consola.

| Rol | Alcanza | Ve referencia | Diligencia | Verifica |
|---|---|:--:|:--:|:--:|
| Administrador | todo | sí | sí | sí |
| Verificador | tablero, sedes, ficha, verificación, cargas | sí | no | sí |
| Responsable de sede | sedes, ficha, registrar | **no** | sí | no |
| Consulta | tablero, sedes, ficha | sí | no | no |

**D-32 resuelve La Dorada.** Se preguntó si la sede reclasificada a tipo 4 debía salir del lote; la
respuesta es que sí, y la razón es que ya estaba implícita en D-31: si la priorización se **deriva**
del censo, manda el censo. La sede no desaparece —sigue entre las 975— solo sale del lote 1, y si
los arquitectos corrigen `dimDaños`, vuelve sola en el siguiente build. Eso es preferible a
mantener una lista a mano que se desincroniza.

Se escribió **`docs/PLAN_DESARROLLO.md`**: los 4 objetivos contra la pieza que los cumple, el
alcance por rol confirmado, los 6 pasos de construcción en orden, y lo que falta separado entre lo
que **bloquea el paso 0** (repo, lista de Administrador/Consulta, prueba de despliegue de Apps
Script) y lo que no bloquea pero hay que resolver antes de dar acceso real.

---

### De dónde salen los valores: inspección de los 3 formatos reales (D-34, D-35)

Se preguntó por qué el presupuesto tiene «tantos valores» y si los 11 capítulos del censo alcanzan.
Se fue a los archivos reales en vez de opinar.

**Tres niveles de madurez, muy distintos entre sí:**

- **Belalcázar** — presupuesto profesional de 10 hojas con base de **APU**: `Capitulos`,
  `Actividades`, `Presupuesto`, `A.P.U`, `Insumos`, `Analisis AU`, `Analisis Mano de Obra`,
  `Analisis Herramienta Menor`, `Analisis Factor Prestacional`, `Polizas`. Cada precio unitario se
  arma de insumos + mano de obra + herramienta + factor prestacional. **35 capítulos disponibles, 18
  usados, 74 actividades** con cantidad. Ahí salen los valores.
- **Aguadas y Aranzazu** — la misma plantilla, y el encabezado todavía dice **«ALCALDÍA MUNICIPAL DE
  SALAMINA»**: la copiaron sin cambiar el membrete. Lista plana ITEM/DESCRIPCIÓN/UND/CANT/VR.
  UNITARIO agrupada por I.E. → sede. Declaran **A 25 % · I 0 % · U 5 %**.
- **Samaná** — **no es un presupuesto**: es una lista de materiales de ferretería (bulto de cemento
  $37.000, teja Eternit #6 $78.000, bloque recocido #5 $1.950). Sin mano de obra, sin actividades.

**D-34 — los capítulos pasan de 11 a 14.** Se mapearon los 18 capítulos usados por Belalcázar contra
los 11 del censo y **el 13,6 % del costo directo no tiene dónde ir**:

| Capítulo sin destino | Valor | % |
|---|---:|---:|
| DEMOLICIONES | $71.624.369 | 10,6 % |
| PRELIMINARES | $14.517.964 | 2,2 % |
| DESMONTES | $5.653.115 | 0,8 % |
| **Total huérfano** | **$91.795.449** | **13,6 %** |

No son lugares donde haya daño: son trabajo que toda reconstrucción necesita —demoler antes de
levantar, sacar escombros, cerrar la obra—. Sin ellos, quien presupuesta los mete a la fuerza en un
capítulo equivocado y ensucia el cruce daño↔presupuesto, que es justo lo que reemplazó a la
desviación. Entran **12. Preliminares · 13. Demoliciones y desmontes · 14. Aseo y escombros**, y el
cruce **solo evalúa del 1 al 11**: los transversales nunca se marcan como anomalía. **Los 11 del
censo no se tocaron** — son de los arquitectos.

**D-35 — el sistema no exige APU.** Pide el mínimo común: actividad + unidad + cantidad + valor
unitario. Exigir APU dejaría a Samaná sin poder radicar. Consecuencia aceptada y escrita: el sistema
**no valida que un precio unitario sea razonable**; eso lo hace el arquitecto al verificar.

**Hallazgo que convierte Q-3 en concreta.** El umbral de alerta es A > 12 %; Aguadas y Aranzazu
radican con **A 25 %**, el doble. La alerta saltará en casi todo lo que llegue de esos dos. Está
bien que **alerte y no bloquee** (no hay tope legal de AIU), pero ahora hay evidencia real que
llevarle a Planeación en vez de una pregunta teórica. Además ambos declaran «Imprevistos», aunque en
cero: si alguno lo usa distinto de cero, el lector debe **reportarlo como hallazgo**, no sumarlo en
silencio.

**El mockup dejó de tener cifras inventadas.** El ejemplo de presupuesto usa actividades y precios
unitarios reales del APU de Belalcázar, sobre Guayaquil (Samaná) —sede real cuyo censo marca daño en
los capítulos **2, 3 y 6**, coherente con su observación: «la pared del fondo presenta movimiento» y
«la cubierta se encuentra encorvada»—. Costo directo $5.987.974 → total $6.943.056, aritmética
verificada y cuadrada entre las tres pantallas donde aparece.

**Corregido también:** §1 de `CLAUDE.md` seguía definiendo el proyecto como «contraste contra el
modelo paramétrico» —lo primero que lee cualquiera, y ya contradecía a D-26/D-28—. Ahora describe
los dos valores que conviven sin restarse, y deja el modelo como historia.

Se agregó **§4.b «Lo que sobra»** a `PLAN_DESARROLLO.md`: 9 piezas que no entran al desarrollo, con
el porqué de cada una.

---

### Auditoría de módulos antes de arrancar: 3 huecos reales, no cosméticos

Se pidió "agregar los módulos faltantes" antes de empezar a programar. En vez de listar algo al
aire, se auditó el diseño (mockup v6) y la documentación contra la arquitectura de 6 pestañas de
Apps Script (D-19) y se encontraron tres huecos concretos:

1. **`CLAUDE.md` §6 «Modelo de datos» seguía describiendo el backend viejo** (`PresupuestosSedes` /
   `ItemsPresupuesto`, pensado para listas de SharePoint). Es lo que Paso 0 del plan necesita para
   crear el Google Sheet — sin columnas definidas, ese paso no se puede ejecutar. **Reescrita
   completa**: 6 pestañas (`Sedes`, `Presupuestos`, `Items`, `Verificaciones`, `Usuarios`,
   `Hallazgos`) con columnas derivadas de lo que el sistema ya produce (catálogo, `RegistroIngesta`,
   formulario de verificación, borrador de usuarios) — nada inventado.

2. **D-36 — decisión nueva sobre granularidad de Cargas.** Al revisar si los lectores de ingesta
   podían alimentar el cruce daño↔presupuesto (D-34) igual que el diligenciamiento manual, se
   encontró que **solo Belalcázar trae capítulo por fila** en su Excel; Aguadas, Aranzazu y Samaná
   traen descripciones en texto libre sin ninguna columna de capítulo. Inferir el capítulo por
   palabras clave sería exactamente la adivinación que el proyecto prohíbe para la ingesta —
   funcionaría en los ejemplos vistos y fallaría en silencio en el municipio 27 que describe
   distinto. **Se decide:** cuando el archivo trae capítulo estructurado, el lector llena `Items`
   completo; cuando no, vuelca solo el total y la Ficha lo marca como «sin desglose por capítulo» —
   el arquitecto revisa el Excel adjunto al verificar, que es para eso que existe ese paso.

3. **Hallazgos era un panel decorativo, no una pantalla administrable.** Hay una pestaña
   `Hallazgos` en el modelo de datos y 19 discrepancias reales ya documentadas en
   `CONFLICTOS_Y_HALLAZGOS.md`, pero ningún lugar donde el Administrador pudiera marcarlas
   resueltas — un hueco directo contra el objetivo 4 ("que los administradores tengan el control de
   todo el sistema"). **Se agregó como pantalla propia** (`data-mod="hallazgos"`, visible para
   Administrador y Verificador), con las 8 discrepancias reales que más importan hoy —las que
   bloquean un cruce, no las informativas— y el resto referenciado al `.md` mientras se termina de
   volcar a la pestaña real.

**No se agregó** (evaluado y descartado por ahora): tamizaje/confirmación masiva para las 975 sedes
completas. D-3/D-4 siguen vigentes pero aplican cuando el sistema cubra más que el lote 1 de 37 —
documentado en `CLAUDE.md` §6 como Fase 2, no bloquea el arranque actual.

Probado: **10 pantallas × 4 roles, 0 errores.** El rol Responsable de sede queda correctamente
bloqueado de Hallazgos (no es de su incumbencia); Verificador y Administrador sí lo ven.

---

### Repo publicado, usuarios internos cerrados, y un residuo de diseño corregido

**Repositorio en línea:** `https://github.com/Jostrel19/reconstruccion-sedes`, público, 4 commits.
El push lo corrió el usuario en su terminal (token de acceso personal, GitHub ya no acepta
contraseña por HTTPS) — confirmado desde acá con `git fetch` + `git log origin/master`.

**Pendiente #2 cerrado.** Lista real de usuarios internos, dada por el usuario:

| Correo | Nombre | Rol |
|---|---|---|
| data@sedcaldas.edu.co | José Andrés Saavedra Higuera | Administrador |
| gmartinez@sedcaldas.edu.co | Gustavo Martínez Murillo | Administrador |
| lhvargas@sedcaldas.edu.co | Luis Herney Vargas Barrera (Secretario de Educación) | Consulta |
| wgonzalez@sedcaldas.edu.co | Wilmar Gonzales Orozco (Jefe de Planeación) | Consulta |
| jtmejia@sedcaldas.edu.co | Jessica Tatiana Mejía Ruiz (arquitecta) | Verificador |
| falopez@sedcaldas.edu.co | Fabián López (arquitecto) | Verificador |

Se guardaron en `data/insumos/usuarios_manual.csv` (fuera de git, como todo dato personal) y
`tools/generar_usuarios_borrador.py` se extendió para leerlo y fusionarlo con el borrador
autogenerado de alcaldes/rectores — antes el script decía explícitamente que estos roles "los da
el jefe/practicante a mano" sin un lugar donde ponerlos; ahora hay uno. Borrador final:
**193 filas** (26 alcaldes + 161 rectores + 6 internos).

**Hallazgo del usuario, corregido:** el formulario de "Entrar" del mockup todavía tenía campos
`Usuario` / `Contraseña` con autocomplete de navegador — residuo de cuando se restauró el Artifact
v5 completo sin revisarlo línea por línea; ese diseño es anterior a que D-20 cerrara el login por
código de un solo uso (2026-09-15). Se reemplazó por el flujo real de dos pasos: correo
institucional → botón "Enviar código" → campo de 6 dígitos → "Entrar", con el aviso de que un
correo no autorizado no recibe nada (para que no se pueda enumerar quién tiene cuenta). Verificado
en navegador: cero campos de contraseña en todo el archivo, las dos pantallas alternan bien, sin
errores de consola.

---

### Segunda ronda de auditoría: la pantalla Usuarios y el §8 de CLAUDE.md

**Usuarios del mockup, corregido.** Al preguntar el usuario si algo más había quedado
desactualizado, se revisó la pantalla Usuarios: mostraba `jsaavedra` como identificador de sesión
(residuo del modelo usuario/contraseña ya retirado) y placeholders genéricos («Arquitecto —
infraestructura», «Dirección») que ya no representan la realidad ahora que hay 2 Verificadores y 2
Consulta confirmados, no 1 de cada uno. Se corrigió a 7 filas con roles y cantidades reales, sin
poner los nombres/correos de los 6 funcionarios en el código público — mismo criterio que con
alcaldes y rectores.

**Pregunta del usuario: los correos institucionales son de Microsoft, no de Gmail — ¿eso rompe
algo?** No: `MailApp.sendEmail()` (Apps Script) entrega por SMTP normal a cualquier proveedor,
igual que cualquier remitente le llega a cualquier bandeja. El usuario final nunca inicia sesión en
Google ni en Microsoft — solo recibe un código en su Outlook y lo escribe en la página. Ya estaba
resuelto por D-20, pero como generó duda se agregó una prueba concreta a
`docs/PRUEBA_DESPLIEGUE_APPS_SCRIPT.md`: una función `probarCorreoInstitucional()` que manda un
correo real a una cuenta `@sedcaldas.edu.co` para confirmarlo con hechos, no solo con el argumento.

**El hueco más grande: `CLAUDE.md` §8 "Estado actual" no tenía ningún aviso de que es histórico.**
Describe el aplicativo viejo congelado el 2026-09-09 —un día antes de que D-17 girara todo el
proyecto— y aparece justo después de §7, que sí está actualizado al 16-09. Alguien leyendo de
corrido se pega el mismo salto que el usuario tuvo con `ANALISIS_INSTRUMENTO_PRESUPUESTAL.md`.
Se agregó el mismo tipo de aviso que a los demás documentos. Dentro de su tabla "Pendientes"
(Q-1 a Q-14): **Q-6 venció** (era para una prueba de septiembre que ya pasó), **Q-8 quedó superada**
(el flujo de Power Automate que iba a montar ya no existe), **Q-5 se resolvió** (repo bajo cuenta
propia, no la organización `sedcaldas`).

**`docs/PLAN_DESARROLLO.md` §4 reescrita como única lista de pendientes vigente.** Los 3
bloqueantes del paso 0 ahora muestran su estado real: **1 y 2 hechos**, solo falta 3 (prueba de
despliegue). Se sumaron Q-4 (campos extra del formato) y Q-12 (ambigüedad del "catálogo de
precios unitarios") a la lista de "no bloquea pero hay que resolver", que antes no las tenía —
existían solo en el §8 histórico y se habrían perdido de vista. Q-14 (datos del contrato) se anota
aparte como "no urgente, Fase 4 aplazada" para que no se confunda con algo por resolver ya.

---

### Pendiente

Lo de siempre (repo remoto, lista de Administrador/Consulta, despliegue de prueba de Apps Script,
crear el Sheet) más lo que abrió este cambio: confirmar la reclasificación de La Dorada, las 5
priorizadas sin capítulo de daño, y sincronizar `docs/diseno/DISENO_01..05` con D-26 a D-31.

---

## 2026-09-15 — Repositorio git, alcance de roles (D-24/D-25) y borrador de Usuarios

Se decidió publicar bajo la cuenta personal del practicante (`Jostrel19`), no bajo la organización
`sedcaldas` en GitHub: esa organización resultó ser la cuenta personal de otro funcionario, no una
cuenta institucional, así que meter el trabajo ahí solo traslada el mismo riesgo que se quería
evitar (que un tercero pueda borrar o editar el repositorio sin control del autor).

Se inicializó el repositorio local (no existía pese a que ya había un `.gitignore` preparado) y se
corrigió ese `.gitignore` dos veces antes del primer commit: no excluía `data/entregas_excel/` ni
`data/insumos/` (presupuestos reales de municipios, con datos como el teléfono personal del contacto
de Belalcázar), y `web/assets/js/data.js` —el catálogo del sistema viejo— seguía trayendo
`correo_ie`/`celular_ie`/`rector` de las 1.021 sedes: el mismo dato que motivó Q-9 y obligó a poner
en privado el repositorio anterior (D-18). Confirmado que el resto de archivos `.js` solo mencionan
esos nombres de campo en el código, no los valores reales. Primer commit hecho, limpio.

Se resolvió una pregunta que había quedado abierta desde la discusión de autenticación: **"Responsable
de sede" sí incluye a alcaldes y rectores, no solo personal de la SED** (D-24) — lo que retiró D-18
fue el mecanismo inseguro (enlace público + catálogo con contactos expuesto), no el acceso directo en
sí. Con el login por código y los contactos viviendo en el backend, pueden volver a entrar de forma
segura. Alcance: alcalde = todo su municipio; rector = las sedes de su institución en el catálogo
(entre 1 y 18, según `fctMaestra`); mismos permisos para ambos. Verificador (D-25) ve todas las sedes
del departamento, sin restricción por municipio.

Con eso, `tools/generar_usuarios_borrador.py` generó automáticamente 187 filas (26 alcaldes + 161
rectores) desde el catálogo ya construido, en vez de recopilarlas a mano — quedan pendientes de
confirmar vigencia antes de invitar a alguien real, y de sumarles Administrador y Consulta, que no
salen de ningún catálogo.

**Sesión cerrada aquí.** Pendiente exacto para retomar: nombre y visibilidad del repositorio remoto,
lista de Administrador/Consulta, prueba de despliegue de Apps Script, y crear el Google Sheet real
con las 6 pestañas. Nada de esto bloquea empezar a escribir el backend de Apps Script ni el frontend
de Fase 0.

---

## 2026-09-17 — Prueba de despliegue de Apps Script: hecha, con una precisión a D-19

Al ir a ejecutar `docs/PRUEBA_DESPLIEGUE_APPS_SCRIPT.md`, el primer intento de iniciar sesión en
script.google.com con `data@sedcaldas.edu.co` falló con «No se pudo encontrar esta cuenta» — **el
dominio `@sedcaldas.edu.co` es Microsoft 365, no Google Workspace**, así que no existe ninguna cuenta
de Google con ese correo. D-19 asumía «mismo dominio institucional, mismo patrón que `circular122`»
sin haber verificado cómo estaba desplegado realmente ese sistema de referencia.

Se confirmó con el usuario: `circular122` está desplegado desde el **Gmail personal** del funcionario
que lo hizo, no desde una cuenta institucional — no existe tal cosa. Este proyecto sigue el mismo
patrón, con el Gmail personal del practicante. **D-19 se precisó** en `CLAUDE.md` con esta aclaración
y la consecuencia aceptada: el script y las hojas quedan de propiedad de esa cuenta personal, mismo
riesgo de continuidad que ya asume `circular122`, no uno nuevo.

**Prueba ejecutada con Gmail personal, tres partes:**

1. **Despliegue** — `Ejecutar como: Yo (jose.saavedra2@gmail.com)`, `Usuarios con acceso: Cualquiera`.
   Un primer intento de abrir la URL `/exec` en incógnito dio un error de Google Drive («No se puede
   abrir el archivo»); se aisló probando primero en una pestaña normal (con sesión), donde sí
   funcionó, lo que descartó problema de permisos o de código. Repetido en incógnito un par de
   minutos después, funcionó — fue demora de propagación del despliegue nuevo, no un error real.
2. **Acceso público confirmado**: el JSON de `doGet` se ve sin pedir login, en incógnito.
3. **Correo a Office 365**: `probarCorreoInstitucional()` ejecutada desde el editor, entregó a
   `data@sedcaldas.edu.co` sin pedir autorización adicional (ya estaba concedida) y llegó a la
   bandeja principal de Outlook, no a spam. Confirma que `MailApp` entrega por SMTP normal
   independiente del proveedor del destinatario — sin integración especial Google↔Microsoft.

**Resultado: sin bloqueante técnico.** Los tres pendientes que bloqueaban el Paso 0 del plan
(`docs/PLAN_DESARROLLO.md` §4) quedan resueltos. Falta borrar el proyecto de prueba en
script.google.com (no se necesita conservarlo) y empezar el Paso 0 real: crear el Google Sheet con
las 6 pestañas y desplegar el backend definitivo.

## 2026-09-17 — Auditoría de todo el proyecto antes de construir: README desactualizado

Se pidió una revisión a profundidad de todo el repositorio antes de empezar a escribir el backend
real. Verificado con datos, no de memoria: `catalogo_sedes.json` cuadra exacto con lo que dice
`CLAUDE.md` (975 sedes, 37 priorizadas, $9.718.464.165, 5 priorizadas sin capítulo de daño),
`docs/CONFLICTOS_Y_HALLAZGOS.md` tiene 19 hallazgos reales tal como se venía citando, y el mockup
sigue autocontenido (sin referencias a los `.js` viejos de `web/assets/`).

**Hallazgo grave: `README.md` describía por completo el aplicativo retirado** (SharePoint, Power
Automate, `web/index.html` como "la app"), con comandos que ya no existen en esa ruta —
`tools/generar_enlaces.py`, `tools/consolidar.py` y el resto de lo movido a `tools/_retirado/` — y
sin ningún aviso de vigencia, a diferencia de los otros 5 documentos históricos que ya lo tenían. Es
el primer archivo que ve cualquiera que entre al repositorio público. Se reescribió por completo:
arquitectura actual (Apps Script desplegado con Gmail personal, Google Sheet de 6 pestañas), los 4
roles, los comandos que sí existen hoy (`build_catalogo.py`, `ingesta.py`, `servir.py`), y una tabla
de qué vive dónde y qué no se versiona.

**`tools/rutas.py` — limpieza de rutas muertas.** `TOKENS_JSON`, `TOKENS_JS`, `ENLACES_CSV`,
`INSTRUCTIVO` y `URL_BASE` (que además apuntaba a `sedcaldas.github.io`, la organización que Q-5 ya
descartó) solo las usaban los 8 scripts ya retirados. Se eliminaron. `DATA_JS` y `DATA_SED_JS` se
conservan porque `build_catalogo.py` (activo, no retirado) todavía los escribe — aunque su
consumidor (`web/index.html`/`consola.html`) esté retirado como puerta de entrada, tocar esa lógica
no era parte de lo pedido y el script sigue verificado tal como está. Verificado con
`python -c "import rutas"` que el módulo sigue cargando bien tras el recorte.

## 2026-09-17 — Empieza el backend real: Paso 0 y arranque de Paso 1

Primer código de producción del proyecto, en `backend/`:

- **`Setup.gs`** — `crearHojas()`, crea las 6 pestañas con las columnas exactas de `CLAUDE.md` §6.
- **`Codigo.gs`** — `doGet` (mismo ping ya probado) y `doPost` con un registro de acciones
  (`manejadores`), para sumar módulos sin tocar lo que ya funciona.
- **`Auth.gs`** — D-20 completo: `solicitarCodigo`/`validarCodigo`, código de 6 dígitos en
  `CacheService` (vence solo, sin pestaña de sesiones que limpiar), token de sesión firmado con
  HMAC-SHA256 (secreto autogenerado en las Propiedades del script, nunca en un archivo), y la regla
  dura de no revelar si un correo tiene cuenta.
- **`Sedes.gs`** — listado de sedes filtrado del lado del servidor por rol y alcance (D-24/D-25),
  con `valor_referencia` excluido de la respuesta para Responsable de sede (D-6) — el filtro real,
  no el `classList.toggle` de la maqueta.

**`tools/exportar_backend.py` (nuevo)** convierte `catalogo_sedes.json` y `usuarios_borrador.csv` al
formato exacto de las pestañas `Sedes` y `Usuarios`, listo para `Archivo > Importar`. Al escribirlo
se encontró y corrigió un error propio antes de que llegara a ningún archivo: la primera versión le
daba a los alcaldes `alcance = TODO_EL_DEPARTAMENTO` en vez de su municipio — habría roto D-24 dándole
a cada alcalde acceso a las sedes de los otros 25 municipios. Corregido a usar el campo `municipio`
que el borrador ya trae por separado. Verificado contra los datos reales: 975 sedes exportadas, 193
usuarios (26 alcaldes con `alcance` = su municipio, 161 rectores con `alcance` = lista de sus
`dane_sede`, 6 internos con `TODO_EL_DEPARTAMENTO`).

Los 4 archivos `.gs` se validaron con `node --check` (renombrados a `.js` temporalmente, Apps Script
no tiene linter propio fuera del editor de Google) — sin errores de sintaxis.

**Sigue pendiente, del lado del usuario:** crear el Google Sheet real, pegar estos 4 archivos en su
editor de Apps Script, correr `crearHojas()`, importar los dos CSV, volver a desplegar como Web App
y probar `solicitarCodigo`/`validarCodigo` de punta a punta con un correo real — guía completa en
`backend/README.md`. Después de eso, conectar el frontend del mockup con `fetch` real es lo que
falta para cerrar el Paso 1.

## 2026-09-17 — Backend en producción: primer despliegue real, D-37 y prueba de punta a punta

Se ejecutó el Paso 0 completo con el usuario, en vivo:

1. Sheet real creado con el Gmail personal, 4 archivos `.gs` pegados en su editor. Un error de
   sintaxis en `Setup.gs` (`Unexpected end of input`) apareció después de que la función ya se había
   ejecutado bien una vez — se resolvió reemplazando el archivo completo en vez de depurarlo línea
   por línea, más rápido y sin riesgo de dejar el archivo a medias otra vez.
2. `crearHojas()` ejecutada: las 6 pestañas quedaron con su encabezado exacto.
3. `tools/exportar_backend.py` (nuevo) generó `backend_sedes.csv` (975 filas) y
   `backend_usuarios.csv` (193 filas), importados con `Reemplazar hoja actual` y la casilla de
   "convertir texto a números" **desmarcada a propósito**: la columna `capitulos_dano` trae listas
   como `"2,6"`, y con la configuración regional en español una hoja que sí convierta habría leído
   la coma como separador decimal y la habría vuelto el número 2,6, perdiendo la lista de capítulos.
   Verificado en la hoja real: los valores multi-capítulo (`1,2,3,6,7,9,10`, etc.) llegaron intactos
   como texto.

**Al escribir `exportar_backend.py` se encontró y corrigió un error propio antes de que llegara al
Sheet**, no después: la primera versión le asignaba a los alcaldes `alcance = TODO_EL_DEPARTAMENTO`
en vez de su municipio — habría roto D-24 dándole a cada alcalde acceso a los otros 25 municipios.
Se corrigió a usar el campo `municipio` que el borrador ya trae por separado antes de generar el CSV
que se importó.

**D-37 — nueva decisión, a petición del usuario.** Preocupación planteada directamente: que alguien
edite un presupuesto ya radicado y el cambio no quede registrado en ningún lado. Se resolvió en dos
capas — la aplicación nunca sobrescribe `Presupuestos`/`Items` (cada corrección es una fila nueva,
versión +1, la anterior se apaga pero no se borra) y el Sheet se protege con
`Datos > Hojas y rangos protegidos` para que `Presupuestos`, `Items`, `Verificaciones`, `Usuarios` y
`Hallazgos` solo los pueda editar el dueño de la cuenta — cualquier otro cambio tiene que pasar por
la API, que sí versiona. Aplicado en vivo sobre las 5 pestañas.

**Prueba de punta a punta, con `curl` contra el Web App real** (no la prueba de eco de ayer):

- `doGet` → ping ok.
- `POST solicitarCodigo` con `data@sedcaldas.edu.co` → `{"ok":true}`, correo recibido. Se disparó
  3 veces por reintentos de `curl` con problemas de `schannel` en Windows al seguir la redirección
  de Apps Script (`302` a `script.googleusercontent.com/macros/echo?...`) — cada intento ejecuta el
  backend de verdad, así que llegaron 3 correos con 3 códigos distintos; se resolvió siguiendo la
  redirección manualmente en dos pasos (`curl` sin `-L`, extraer `Location`, `curl` aparte) en vez de
  confiar en `-L`.
- `POST validarCodigo` con el último código → token firmado, `rol: ADMINISTRADOR`,
  `nombre: JOSE ANDRES SAAVEDRA HIGUERA`, `alcance: TODO_EL_DEPARTAMENTO` — todo leído en vivo de la
  pestaña `Usuarios` real, no de un dato de prueba.
- `POST listarSedes` con ese token → 975 sedes, `valor_referencia` presente (correcto para
  Administrador, D-6 no le aplica a este rol).

**Sin probar:** el filtro de alcance para `RESPONSABLE_SEDE` (D-24) y `VERIFICADOR` (D-25) — el
código ya lo implementa (`_enAlcance` en `Sedes.gs`) pero no hay forma de probarlo hoy sin acceso a
un correo real de alcalde, rector o arquitecto. Queda para cuando se invite a alguien real o se
decida crear una cuenta de prueba con cada rol.

## 2026-09-17 — Cierra Paso 1: el mockup deja de simular el login

Se conectó `docs/diseno/mockup_v6.html` al backend real: `loginEnviarCodigo`/`loginEntrar` pasaron de
cambiar de vista sin más a llamar `solicitarCodigo`/`validarCodigo` por `fetch`, con manejo de error
visible en pantalla y botones deshabilitados mientras esperan respuesta. Detalle técnico que evita un
problema conocido de Apps Script: el `fetch` no fija `Content-Type` — al mandar el body como string
plano, el navegador lo clasifica como petición CORS "simple" y no dispara `OPTIONS` (preflight), que
Apps Script no responde. `Codigo.gs` igual lo parsea como JSON sin mirar la cabecera.

**Probado en el navegador de punta a punta, con la cuenta real:** correo → código recibido por
correo → validado → `sesion` queda con el token, rol (`ADMINISTRADOR`), nombre
(`JOSE ANDRES SAAVEDRA HIGUERA`) y alcance (`TODO_EL_DEPARTAMENTO`) reales, la vista salta sola al
Tablero y la barra superior muestra el nombre e iniciales correctos — nada de esto viene ya de un
dato simulado.

**Incidente durante la prueba, sin relación con el código:** el panel de navegador compartido tuvo
dos problemas de sesión — un timeout de la herramienta al encadenar una llamada async por consola
(se resolvió recargando la página y volviendo al patrón de clic normal) y una confusión del usuario,
que escribió un código directamente en el campo del panel compartido sin avisar, pisando el intento
en curso. Se acordó un protocolo: el usuario dicta el código por chat, nunca lo escribe en el panel
mientras hay una prueba en curso.

**Hallazgo abierto, no bloqueante:** `solicitarCodigo` no limita frecuencia. Alguien que conozca la
URL del backend (viaja en el HTML público) podría pedir códigos repetidos para cualquier correo que
sí esté en `Usuarios`, inundándole la bandeja sin comprometer la cuenta (cada código sigue siendo de
un solo uso, vence en 10 min). Conviene un límite tipo "1 código por correo cada 60 s" con
`CacheService` antes de repartir el sistema a alcaldes y rectores reales — no antes de eso.

Con esto, **Paso 1 del plan queda cerrado**: falta el filtro de alcance para roles externos (sin
forma de probarlo todavía) y seguir con el Paso 2 (armazón, riel, migas, Sedes → Municipio → Ficha en
modo lectura conectados de verdad).

## 2026-09-17 — Límite de frecuencia en `solicitarCodigo`

Se cerró el hallazgo abierto en la entrada anterior. `Auth_solicitarCodigo` ahora guarda una llave
`cooldown_<correo>` en `CacheService` por 60 segundos antes de decidir si manda correo — si ya existe
la llave, responde `{ok:true}` sin hacer nada más. La llave se escribe **siempre**, exista o no el
correo en `Usuarios`: si el límite solo aplicara a correos reales, la ausencia de límite en un correo
inventado ya sería una forma de saber que no existe, exactamente el tipo de fuga que D-20 prohíbe.

Verificado con `node --check` que el archivo sigue siendo JS válido. **Pendiente:** este cambio vive
en `backend/Auth.gs` (el código fuente del repo) pero todavía no se ha vuelto a pegar en el proyecto
de Apps Script desplegado. Apps Script congela el código en cada implementación — editar el archivo
en el editor **no alcanza a la URL `/exec` ya publicada** hasta que se actualice esa implementación
(`Implementar > Administrar implementaciones > editar > Versión: Nueva versión > Implementar`), lo
que sí mantiene la misma URL, sin necesidad de tocar `BACKEND_URL` en el mockup.

## 2026-09-17 — Documento único de alcance y requisitos

El usuario pidió algo que hasta hoy no existía: un documento centralizado de "qué es este proyecto y
cuál es su alcance", pensado como soporte estable, no como bitácora. Se creó
`docs/ALCANCE_Y_REQUISITOS.md` con esa intención explícita: resume los 4 objetivos, los 4 roles y su
alcance, el universo de datos (975 sedes, lote 1 de 37, los 14 capítulos), qué SÍ y qué NO hace el
sistema, la arquitectura en una vista, y un snapshot de estado — sin repetir el detalle fino que ya
vive en `CLAUDE.md` (decisiones) y `PLAN_DESARROLLO.md` (plan operativo), a los que remite en vez de
duplicar. Incluye una sección explícita de que es un documento vivo y el protocolo para actualizarlo,
para que no quede desactualizado como pasó con el README antes de la auditoría del mismo día.

Enlazado desde `README.md` como primer punto de entrada.

## 2026-09-17 — Tres mejoras de resiliencia, a petición del usuario (D-38)

Se preguntó directamente qué tan viable y sólido es el enfoque completo, ahora que hay backend real
en producción. La respuesta identificó tres huecos concretos, y se pidió corregir los tres:

1. **`Auth_validarCodigo` sin límite de intentos.** El código de 6 dígitos vive 10 minutos sin
   restricción de cuántas veces se puede probar — un script podía intentar las 999.999 combinaciones
   dentro de esa ventana. Se agregó `MAX_INTENTOS = 5`: al quinto intento fallido, el código vigente
   se invalida (`cache.remove('otp_' + correo)`) y hay que pedir uno nuevo. La cuenta de intentos se
   guarda con la misma llave de caché que ya se usaba (`intentos_<correo>`), y se resetea cada vez
   que se emite un código nuevo, para no acumular intentos de una ventana vieja.
2. **Sin respaldo del Sheet fuera del propio archivo.** Google guarda historial de versiones nativo,
   pero vive dentro del mismo archivo — no protege contra que el archivo se corrompa, se borre o
   quede inaccesible. Se agregó `backend/Backup.gs`: `configurarRespaldoAutomatico` crea un
   disparador diario que llama a `respaldarSheet`, la cual copia el Sheet completo a una carpeta
   aparte de Drive (`Respaldos - Reconstruccion de sedes`) y borra copias de más de 30 días para no
   acumular indefinidamente.
3. **Sin plan de continuidad si la cuenta personal deja de estar disponible.** Todo el backend
   depende del Gmail personal del practicante (D-19 precisada) — no hay forma de evitarlo mientras
   el dominio institucional no tenga Google Workspace, pero sí se puede documentar qué hacer.
   `docs/RUNBOOK_CONTINUIDAD.md` (nuevo) inventaría qué vive dónde, dos acciones para reducir el
   riesgo desde ya (compartir el Sheet/proyecto como Editor con una segunda cuenta de confianza,
   confirmar que el respaldo automático está corriendo), y dos procedimientos: traspaso coordinado
   (la cuenta saliente sigue activa) y recuperación de emergencia (no lo está, se reconstruye desde
   el respaldo más reciente + el código fuente de `backend/`, que nunca depende de la cuenta
   personal porque vive en GitHub).

Verificado con `node --check` que `Auth.gs` y `Backup.gs` siguen siendo JS válido. Documentado como
**D-38** en `CLAUDE.md`, con snapshot agregado a `docs/ALCANCE_Y_REQUISITOS.md` y a
`docs/PLAN_DESARROLLO.md` §4. **Pendiente del lado del usuario:** pegar `Auth.gs` actualizado y
`Backup.gs` nuevo en el proyecto real, correr `configurarRespaldoAutomatico` una vez, y actualizar la
implementación (`Nueva versión`) para que el bloqueo de intentos quede activo — nada de esto llega
solo al backend desplegado, igual que pasó con el límite de frecuencia.

## 2026-09-17 — Paso 2: Sedes → Municipio → Ficha con datos reales

Hasta ahora `docs/diseno/mockup_v6.html` solo mostraba, en las pantallas ③ Sedes, ④ Municipio y
⑤ Ficha, contenido de ejemplo escrito a mano (municipios y sedes de Samaná inventados para el
diseño). Se conectaron las tres a `listarSedes`, el mismo endpoint que ya existía en
`backend/Sedes.gs` desde el Paso 0, sin tocar el backend.

**Qué se agregó al mockup:**
- `cargarSedes()` pide `listarSedes` justo después de un login real y guarda el resultado en
  `SEDES` — el backend ya filtró por rol y alcance (D-6/D-24/D-25) y ya quitó `valor_referencia`
  para Responsable de sede, así que el navegador no vuelve a decidir nada de eso, solo pinta.
- `pintarInicioReal()` agrupa las 37 sedes del lote 1 por municipio y reemplaza la tabla de
  ejemplo; cada fila abre `pintarMuniReal()` con las sedes reales de ese municipio; cada sede abre
  `pintarFichaReal()` con su identidad y censo de daños reales (DANE, matrícula, tipo de
  afectación, estado de prestación, concepto técnico, observaciones, capítulos con daño 1-14).
- Migas (`Caldas › Municipio › Sede`) y el riel lateral (`Sedes`, `Verificación`, etc.) pasaron de
  ser decorativos a navegar de verdad — antes no tenían ningún listener de clic.
- **Lo que todavía no existe se muestra como vacío, no simulado**: presupuesto recibido, historial
  de versiones, ítems de detalle y las 4 últimas secciones del formato oficial aparecen como "sin
  radicar" / "sin diligenciar" en vez de repetir los números de ejemplo del diseño original —
  Presupuestos e Items son Paso 3, no existen todavía en el Sheet.
- Se ocultó el panel "Hallazgos abiertos" de la pantalla Sedes cuando hay sesión real: esos
  hallazgos (H-1, H-3, H-4) son ejemplos inventados para el diseño, y mostrarlos junto a datos
  reales de una sesión autenticada los haría pasar por reales. El módulo real de Hallazgos es
  Paso 6, todavía sin construir.

**Riesgo verificado y descartado:** `capitulos_dano` viaja como texto con comas (`"1,3"`,
`"2,3,6"`). Antes de construir el cruce por capítulo se revisó si Google Sheets pudo haber
interpretado esas comas como separador decimal al importar el CSV (locale es-CO) — eso habría
convertido, por ejemplo, `"1,3"` en el número `1.3`, perdiendo cuál par de capítulos era. Se agregó
una detección defensiva (`capitulosDeSede()`, reporta en vez de adivinar si el valor llega como
número) y se probó en vivo contra el backend real: `217013000602` (Aguadas, capítulos `"1,3"`) y
`217662002291` (Samaná, capítulos `"1,2,3,4,6,7,10"` en otro caso) llegaron como texto correcto en
ambos casos. La detección se deja igual, por si un reimport futuro con otra configuración de hoja
sí produce el problema.

**Probado en el navegador de punta a punta con la cuenta Administrador real** (correo → código →
sesión): Sedes mostró los 12 municipios del lote 1 con las cifras exactas de `CLAUDE.md` §7
(Anserma 6 sedes/$713,0 M, Aguadas 5/$3.150,2 M, etc.); Municipio → Samaná mostró sus 4 sedes
reales con DANE correcto; Ficha → `217662002291` mostró identidad, censo (capítulos 2, 3 y 6
marcados con daño, exactamente los que ya describía el ejemplo de diseño original — confirma que
el ejemplo se había escrito a partir del dato real) y un estado honesto de "sin presupuesto". Se
verificó también que D-6 sigue aplicando sobre datos reales: con "Ver como: Responsable de sede"
el valor de referencia se oculta; con la sesión real de Administrador, se ve.

**Con esto, el ítem 9 del Paso 2 queda cerrado** (`docs/PLAN_DESARROLLO.md` §3). Sigue pendiente el
ítem 10 (Tablero con datos reales) y, en paralelo, el filtro de alcance para Responsable de
sede/Verificador reales sigue sin poder probarse por falta de un correo real de esos roles.

## 2026-09-17 — Paso 2 completo: Tablero con datos reales

Mismo patrón que Sedes/Municipio/Ficha, aplicado al Tablero: `pintarTableroReal()` reemplaza la
franja de cifras, el mosaico de municipios, la barra "valor de referencia por municipio" y "del
universo al lote" con lo que devuelve `listarSedes`, ya cargado en memoria desde el login. No hubo
que tocar el backend — es el mismo endpoint que ya probaba el Paso 0.

**Dos paneles no se pudieron simplemente "conectar", había que decidir qué hacer con ellos porque no
tienen un dato real detrás todavía:**

- **"Nivel de afectación"** categorizaba en Inhabilitada/Grave/Moderado/Leve/Sin dato — categorías
  que no existen en ningún campo real de `Sedes` (ni en el censo `dimDañosInfraestructura.xlsx`).
  Se repobló como **"Estado de prestación del servicio"**, usando `estado_prestacion` (Habilitada /
  Habilitada con restricción / No habilitada), que sí es un campo real del censo. Es un cambio de
  qué se muestra, no solo de dónde sale el dato — se documenta aquí en vez de solo en el commit para
  que quede claro por qué el panel dice algo distinto al diseño original.
- **"Bitácora"** era una lista de eventos inventados para el diseño (aprobaciones, hallazgos,
  archivos recibidos). No existe ningún registro de actividad en el backend — eso solo tendría
  sentido una vez existan Presupuestos, Cargas o Verificaciones reales. Se dejó vacía, con una nota
  de qué la va a llenar, y se quitó el indicador "en vivo" (implicaba una actualización en tiempo
  real que el sistema no hace).

El resto sí se pudo calcular directo del catálogo real: la franja de cifras (37 sedes,
$9.718.464.165, 2.623 estudiantes, 34 no habilitadas), el mosaico de 12 municipios y los 14 sin
sedes en el lote (antes una lista escrita a mano, ahora se calcula por diferencia contra el universo
completo de municipios que trae `SEDES`), y el ranking de valor por municipio. El mosaico además
quedó clicable: entra directo a la pantalla Municipio de ese municipio, mismo comportamiento que ya
tenían las filas de la tabla en Sedes.

**Verificado en el navegador con la cuenta Administrador real:** las cifras calculadas coincidieron
exactamente con las que `CLAUDE.md` §7 ya documentaba como reales (37 sedes, $9.718.464.165, 2.623
estudiantes, 34 no habilitadas, los mismos 14 municipios sin lote) — no es una coincidencia, es la
confirmación de que el cálculo en el navegador reproduce lo mismo que ya se había verificado a mano
al escribir esa sección de `CLAUDE.md`.

**Con esto, el Paso 2 completo queda cerrado** (`docs/PLAN_DESARROLLO.md` §3, ítems 8-10). Sigue el
Paso 3: pantalla Registrar presupuesto, el primer módulo que escribe en el backend en vez de solo
leerlo.

## 2026-09-17 — Tres correcciones de diseño detectadas al revisar el Tablero en vivo

El usuario revisó el Tablero recién conectado y señaló, con captura de pantalla, que la conexión a
datos reales no bastaba: había que revisar el resultado con el mismo rigor que el dato. Tres
problemas reales, no solo estéticos:

1. **Los badges "6" (Verificación) y "19" (Hallazgos) del riel seguían siendo del ejemplo de
   diseño.** Con una sesión real activa, mostrar un conteo pendiente inventado es exactamente el
   tipo de dato falso que se había evitado en todos los demás paneles. Se ocultan (`.riel .cand`)
   apenas hay sesión real, mismo criterio que ya se aplicaba al panel de Hallazgos de Sedes.
2. **La franja de 6 cifras se partía mal.** `grid-template-columns:repeat(auto-fit,minmax(142px,1fr))`
   dejaba, a ciertos anchos de ventana, 5 tarjetas en una fila y la sexta sola y estirada en la
   siguiente — con un número de tarjetas fijo y conocido (6), `auto-fit` no es la herramienta
   correcta. Se cambió a `repeat(6,1fr)` con dos breakpoints (`repeat(3,1fr)` bajo 920px,
   `repeat(2,1fr)` bajo 520px). Además, "Esperando verificación" y "Aprobadas para obra" — que
   todavía no aplican, no que valgan cero — pasaron de mostrar un "0" con el mismo peso visual que
   las cifras reales a un "—" atenuado (clase `.c.na`), para no competir con el 37 y el 34 que sí
   importan.
3. **"Nivel de afectación" no medía lo que decía medir.** Se había repoblado (en el commit anterior)
   con `estado_prestacion`, un campo real pero que responde otra pregunta ("¿puede funcionar la
   sede hoy?", no "¿qué tan grave es el daño?"). El dato correcto ya existe y ya se usa en otras
   pantallas: `tipo_censo`, que dentro del lote 1 solo toma dos valores por definición del propio
   lote (D-31) — tipo 1 "colapso total o parcial" y tipo 2 "riesgo inminente". Se reemplazó el
   gráfico de barra apilada (`.dist`) por el mismo patrón de lista horizontal que ya usa "Del
   universo al lote" (`.emb`), reutilizando los colores y badges P1/P2 que ya existen en
   Sedes/Municipio/Ficha en vez de inventar una paleta nueva. Una barra apilada tampoco era el tipo
   de gráfica correcto para un reparto tan desigual (9 contra 28): aprietaba el número menor hasta
   volverlo casi ilegible.

**Verificado en el navegador:** a 1110px de ancho la franja usa sus 6 columnas; a 590px usa 3; el
desglose real dio 9 sedes tipo 1 y 28 tipo 2 — coincide exactamente con la cifra que ya documentaba
`docs/diseno/mockup_v6.html` en su propio pie de página ("9 de tipo 1, 28 de tipo 2") y con
`CLAUDE.md` §7.

El usuario también reportó un número superpuesto/duplicado en pantalla ("$9.718.46~~2663~~4.165").
No se encontró ninguna ruta de código que pudiera producir dos nodos de texto superpuestos —
`innerHTML` reemplaza el contenido completo en cada pintada — así que se documenta como sospecha de
artefacto de repintado del navegador (ghosting al redimensionar), no como bug confirmado. Pendiente
de que el usuario confirme si persiste después de un refresco duro.

## 2026-09-17 — Paso 3: Registrar presupuesto, código completo, despliegue quedó pendiente

Primer módulo que **escribe** en el sistema — hasta acá todo (login, Sedes, Municipio, Ficha,
Tablero) era solo lectura. Se construyó de punta a punta:

- **`backend/Presupuestos.gs`** (nuevo): `Presupuestos_obtener` (lee la fila vigente de
  `Presupuestos` y sus `Items` para un DANE, validando alcance con la misma `_enAlcance` de
  `Sedes.gs`) y `Presupuestos_guardar` (recalcula costo directo/A/U/IVA/total él mismo — no
  confía en el total que mande el navegador — y aplica el versionado de D-37: apaga `vigente` en
  la fila anterior si existe, sin tocar ningún otro dato de ella, y agrega una fila nueva con
  `version` + 1). Registradas en `Codigo.gs` (`obtenerPresupuesto`, `guardarPresupuesto`).
- **Pantalla Registrar presupuesto** (`docs/diseno/mockup_v6.html`), que ya existía diseñada
  desde v6 pero con contenido de ejemplo hardcodeado: se conectó a los dos endpoints nuevos.
  Tabla de ítems totalmente editable (agregar/quitar fila, capítulo 1-14 y unidad de catálogo
  cerrado, cálculo de valor total en vivo), sección A/U/plazo con alerta visual si supera 12 %/8 %
  (D-5), parseo de formato colombiano (`parseCOP`) para que "1.500.000" y "12,5" se entiendan sin
  que el usuario tenga que escribir en inglés. El botón "Editar presupuesto" de la Ficha
  (`irRegistrar()`) ya lleva el DANE real de la sede que se estaba viendo.
- **La Ficha se volvió reactiva a Presupuestos**: `cargarPresupuestoDeFicha()` consulta
  `obtenerPresupuesto` cada vez que se abre una Ficha y, si existe un presupuesto real, reemplaza
  los paneles de Seguimiento/Su presupuesto/Historial/Formato oficial que hasta ahora siempre
  decían "sin presupuesto" — sin esto, radicar algo en Registrar nunca se hubiera visto reflejado
  en ningún otro lado.
- Sección 4 (fotografías) de Registrar quedó **fuera de alcance a propósito**: el backend no
  tiene ninguna pestaña ni campo para guardar archivos todavía (ni siquiera está en el esquema de
  `Presupuestos`/`Items` de `CLAUDE.md` §6). Se limpiaron las fotos de ejemplo que traía el
  diseño y se dejó una nota explícita de "todavía no disponible" en vez de simular que el botón
  "Agregar" hace algo.
- Se le explicó al usuario, a pedido explícito, la diferencia real entre "Guardar borrador" y
  "Radicar presupuesto": ambos botones llaman a la misma función y solo cambian el valor de
  `estado` que se guarda; **radicar no bloquea ediciones futuras a nivel de backend todavía** —
  es una simplificación deliberada, coherente con "alerta, no bloquea", que se deja anotada acá
  para no perderla.

**No se pudo probar en vivo.** Al intentar "Guardar borrador" el backend respondió
`Acción desconocida: guardarPresupuesto`. Diagnóstico (reemplazando `window.alert` temporalmente
para leer el mensaje real sin depender del diálogo nativo del navegador, que el panel compartido
no siempre maneja bien): el usuario había creado una **implementación nueva** ("Paso 3 —
Registrar presupuesto...", con su propia URL `AKfycbypTxkK7fAz6k8MuYUZtrV7ErEzqcjxWIA5...`) en
vez de actualizar la versión de la implementación original ("Paso 0 — 6 pestañas...", cuya URL es
la que está escrita en `BACKEND_URL` del mockup). Cada implementación de Apps Script es un
`/exec` independiente — subir una "Nueva versión" a una no le llega a la otra aunque compartan el
mismo proyecto y el mismo código fuente. Se le explicó la distinción exacta entre el botón
**"Implementar"** de la barra superior (crea una implementación nueva, URL nueva) y **"Nueva
versión" dentro de Administrar implementaciones sobre una implementación ya existente** (mantiene
la misma URL) — esta última es la única que se debe usar de acá en adelante.

**Se deja pausado a pedido del usuario**, con el paso siguiente clarísimo: entrar a "Paso 0 — 6
pestañas...", editarla, Nueva versión, implementar, y repetir la prueba de guardar/radicar.
Detalle completo de qué falta en `docs/PLAN_DESARROLLO.md` §3 (Paso 3).

## 2026-09-21 — Paso 3 cerrado: primer guardado real de punta a punta

Se retomó la prueba pausada el 17. **Nota sobre fechas:** la entrada anterior está fechada
2026-09-17 correctamente (fue cuando se escribió); esta se fecha 2026-09-21 porque efectivamente
pasaron varios días reales entre pausar y retomar — durante el tramo intermedio esta bitácora
había arrastrado por error "2026-09-17" como si fuera la fecha del día, sin volver a verificarla.

**Segunda vuelta del mismo problema de despliegue.** Al reintentar, el backend seguía respondiendo
`Acción desconocida: guardarPresupuesto` — el usuario había vuelto a editar la implementación
"Paso 3 — Registrar..." (la huérfana, con su propia URL) en vez de "Paso 0 — 6 pestañas..." (la
que de verdad usa `BACKEND_URL`). Se le explicó la distinción exacta entre el botón **"Implementar"**
de la barra superior del editor (crea una implementación nueva, URL nueva — lo que ya había pasado
dos veces) y **"Nueva versión" dentro de Administrar implementaciones, sobre una implementación que
ya existe** (mantiene la misma URL) — con pasos numerados exactos de qué clic hacer dónde, ya que
las dos veces anteriores la ambigüedad de la instrucción fue la causa real del error, no un
malentendido del usuario. Corregido sobre la implementación correcta, `guardarPresupuesto` respondió
de inmediato.

**Prueba de punta a punta, sobre `217013000602` (Aguadas, tipo 2):**
- Guardar borrador con 1 ítem (8 m² × $450.000 = $3.600.000 costo directo) → `v1`, estado
  `BORRADOR`. Cálculo verificado: A 10 % = $360.000, U 5 % = $180.000, IVA 19 % sobre U = $34.200,
  total $4.174.200.
- Radicar el mismo presupuesto → `v2`, estado `RADICADO`, mismos totales, `vigente=true`.
- Editar el plazo y guardar borrador de nuevo → `v3`, estado `BORRADOR`. Confirmado en el Sheet
  real que **las tres versiones quedaron como filas separadas** — v1 y v2 con `vigente=FALSE`,
  v3 con `vigente=TRUE` — nada se sobrescribió (D-37 funcionando como se diseñó, no solo como se
  documentó).
- La Ficha de esa sede reflejó en vivo cada cambio de estado (badge, Seguimiento, Historial) sin
  intervención manual, vía `cargarPresupuestoDeFicha`.

**Un susto que resultó ser autoinducido:** durante la prueba, el mensaje de confirmación de
"Radicar" mostró *"Presupuesto radicado como vundefined"* en vez del número real. Antes de asumir
un bug, se verificó el dato real contra el servidor (consulta directa a `obtenerPresupuesto`, sin
pasar por la UI) y el `v2` con todos sus valores estaba perfectamente correcto — el problema era
cosmético, no de datos. Se aisló la causa reinstalando un `fetch` nativo limpio (tomado de un
`iframe` recién creado, para no depender de que el navegador recargara el archivo `file://`, que en
este panel de pruebas no siempre recarga el estado de JavaScript) en lugar del que se había
interceptado unos pasos antes para diagnosticar el problema de despliegue. Con `fetch` nativo, un
guardado nuevo mostró el mensaje correcto (`v3`) — confirma que la interceptación de `fetch` que se
usó como herramienta de diagnóstico fue la causa, no el código que quedó desplegado. Ningún usuario
real habría visto este mensaje.

**Hallazgo menor que queda anotado, no bloqueante:** `cargarRegistro()` traga en silencio los
errores de `obtenerPresupuesto` (token vencido, sede fuera de alcance) y dejaría el formulario en
blanco sin explicar por qué. Corregirlo es deseable pero no urgente — el peor caso hoy es un
formulario vacío, nunca un dato incorrecto mostrado como si fuera bueno.

**Con esto, el Paso 3 completo queda cerrado** (`docs/PLAN_DESARROLLO.md` §3, ítems 11-12). Falta
por construir: fotografías (fuera de alcance, D-29 sección 4, sin campo en el backend todavía),
Paso 4 (Verificación) y Paso 5 (Cargas).
