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

| Rol | Alcance de sedes | Ve valor de referencia | Diligencia | Verifica | Pantallas |
|---|---|:--:|:--:|:--:|---|
| **Administrador** | Todo el departamento | Sí | Sí | Sí | Todas |
| **Verificador** (arquitecto) | **Todo el departamento**, sin restricción por municipio (D-25) | Sí | No | **Sí** | Tablero · Sedes · Ficha · Verificación · Cargas |
| **Responsable de sede** — alcalde | **Todas las sedes de su municipio** (D-24) | **No** (D-6) | Sí | No | Sedes · Ficha · Registrar |
| **Responsable de sede** — rector | **Las sedes de su I.E. según el catálogo**, de 1 a 18 (D-24) | **No** (D-6) | Sí | No | Sedes · Ficha · Registrar |
| **Consulta** (directivo) | Todo el departamento, solo lectura | Sí | No | No | Tablero · Sedes · Ficha |

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
7. Frontend: pantalla de entrada del mockup, en dos pasos — **falta conectarla con `fetch` real** al
   endpoint; hoy el botón solo cambia de vista sin llamar al backend.

### Paso 2 — Armazón y lectura — arrancado
8. Riel, barra superior, migas, y el filtrado por rol **del lado del servidor**. **`backend/Sedes.gs`
   ya filtra por alcance (D-24/D-25) y oculta `valor_referencia` a Responsable de sede (D-6)** —
   falta el resto de pantallas y conectar el frontend.
9. Sedes → Municipio → Ficha, en modo lectura.
10. Tablero.

### Paso 3 — Escritura manual (objetivo 1)
11. Pantalla Registrar presupuesto: ítems, cálculo, validaciones, borrador.
12. Radicación con versionado: una v2 no pisa la v1.

### Paso 4 — Verificación (objetivo 3 del flujo)
13. Bandeja + emitir concepto, con la regla D-22 y el registro de auditoría de D-21.

### Paso 5 — Cargas (objetivo 2)
14. Pantalla de importación que recibe la salida de los lectores, muestra el cruce propuesto y
    **exige confirmar lo ambiguo** antes de volcar (D-23).
15. **Granularidad según D-36:** si el archivo trae capítulo por fila (hoy solo Belalcázar), el
    lector vuelca a `Items` completo; si no (Aguadas, Aranzazu, Samaná), vuelca **solo el total** a
    `Presupuestos` — no se infiere capítulo de un texto libre.

### Paso 6 — Hallazgos y cierre
16. Pantalla **Hallazgos** (Administrador y Verificador): lista de la pestaña `Hallazgos`,
    filtro abierto/resuelto, botón de marcar resuelto con quién y cuándo. Reemplaza el panel de
    solo lectura del mockup inicial — sin esto, "control total del sistema" (objetivo 4) es
    incompleto: hoy los 19 hallazgos abiertos solo viven en un `.md`.
17. PDF del formato oficial (se reusa `pdf.js`).
18. Correo de confirmación con el radicado.

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
`docs/diseno/mockup_v6.html`**, que sí está al día y es ejecutable.

No se reescriben ahora: no bloquean el desarrollo y reescribirlos antes de construir es trabajo que
se repite. Se actualizan cuando el módulo correspondiente esté construido y se sepa qué quedó.

---

## 6. Cómo se prueba el diseño

```bash
python tools/servir.py
```

Y abrir `docs/diseno/mockup_v6.html`. El selector **«Ver como»** cambia entre los cuatro roles: las
pantallas fuera de alcance quedan tachadas y el valor de referencia desaparece para el Responsable
de sede.

Verificado el 2026-09-16: 9 pantallas × 4 roles, sin errores de consola.
