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
