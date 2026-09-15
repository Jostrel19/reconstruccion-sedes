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
