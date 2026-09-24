# Alcance y requisitos — Reconstrucción de sedes SED Caldas

**Última actualización:** 2026-09-21. **Este documento es vivo** — se actualiza cada vez que cambia
el alcance, la arquitectura o el estado del desarrollo. No reemplaza a `CLAUDE.md` (decisiones
completas, una por una) ni a `docs/PLAN_DESARROLLO.md` (plan operativo, paso a paso): este documento
es el resumen que se lee de corrido para entender **qué es el sistema y hasta dónde llega**, sin
tener que reconstruirlo leyendo 37 decisiones sueltas. Cuando haya duda sobre un detalle fino, mandan
esos dos archivos, no este.

---

## 1. Qué es y por qué existe

El 10 de agosto de 2026 un sismo afectó infraestructura educativa en Caldas. La Secretaría de
Educación necesita saber, sede por sede: **qué se dañó, cuánto va a costar repararlo, quién lo
presupuestó, si un arquitecto lo verificó, y en qué va cada trámite** — de forma que cualquier cifra
se pueda sustentar ante el MEN, la UNGRD o Hacienda.

Es un **sistema interno de la Secretaría**, no un formulario público. Lo cargan y consultan personas
identificadas (alcaldes, rectores, arquitectos, funcionarios de planeación), cada una viendo solo lo
que le corresponde.

**Criterio rector, del que se deriva todo lo demás:** solo entran valores reales, con origen
sustentable (quién la levantó, sobre qué daño, con qué cantidades y precio unitario). Nada se
adivina ni se completa por cuenta propia.

---

## 2. A quién sirve — los 4 objetivos que definen el alcance

| # | Quién lo pidió resolver | Qué necesita | Pantalla que lo resuelve |
|---|---|---|---|
| 1 | Alcaldes y rectores | Diligenciar el presupuesto de su(s) sede(s) a mano, sede por sede | **Registrar presupuesto** |
| 2 | Arquitectos | No volver a digitar lo que el municipio ya mandó en Excel | **Cargas** (carga masiva) |
| 3 | Directivos de la Secretaría | Ver el panorama completo y cómo va el proceso, sin poder editar nada | **Tablero** (rol Consulta) |
| 4 | Administrador del sistema | Control total: usuarios, hallazgos, todas las pantallas | Rol **Administrador** |

Los dos caminos de captura (manual y carga masiva) terminan en el **mismo registro versionado** —
el sistema no distingue de dónde vino el dato salvo por una etiqueta de origen que sí se conserva
para trazabilidad.

---

## 3. Quién usa el sistema y qué alcanza a ver — los 4 roles

| Rol | Quién es | Alcance de sedes | Ve el valor de referencia del arquitecto | Diligencia | Verifica |
|---|---|---|:--:|:--:|:--:|
| **Administrador** | Practicante / funcionarios designados | Todo el departamento | Sí | Sí | Sí |
| **Verificador** | Arquitecto de la Secretaría | Todo el departamento, sin restricción por municipio | Sí | No | **Sí** |
| **Responsable de sede** | Alcalde (todo su municipio) o rector (las sedes de su institución) | Su municipio o su institución únicamente | **No** | Sí | No |
| **Consulta** | Directivos (Secretario, Jefe de Planeación) | Todo el departamento, solo lectura | Sí | No | No |

**Por qué el municipio no ve el valor de referencia:** para que el presupuesto que radica sea una
medición independiente, sin que la cifra estimada por el arquitecto la ancle de antemano.

**Cómo se entra:** sin usuario ni contraseña. Se escribe el correo institucional y llega un código de
6 dígitos de un solo uso, válido 10 minutos. Si el correo no está autorizado, no se manda nada — así
nadie puede averiguar quién tiene cuenta probando correos al azar.

---

## 4. Universo de datos — sobre qué se trabaja

- **975 sedes oficiales** (oficiales + activas + con matrícula), en 26 municipios no certificados de
  Caldas, 161 instituciones educativas. Manizales queda fuera por ser secretaría certificada aparte.
- El censo vivo de daños (mantenido por los arquitectos) clasifica cada sede en 7 tipos, de "colapso
  total" a "sin afectación".
- **Lote 1 — las 37 sedes con daño tipo 1 o 2** (colapso total/parcial o riesgo inminente), en 12
  municipios, **$9.718.464.165** de valor de referencia. Es el primer grupo que el sistema cubre de
  punta a punta; las 938 sedes restantes quedan en el catálogo pero fuera del ciclo activo de
  seguimiento hasta una fase posterior.
- **14 capítulos de presupuesto**: 11 son los que marca el censo de daño (estructural, cubierta,
  instalaciones, etc.) y 3 son transversales a cualquier obra (preliminares, demoliciones, aseo y
  escombros) — necesarios porque, medido sobre un presupuesto real, representan un 13,6 % del costo
  directo que de otro modo no tendría dónde clasificarse.

> **Revisado 2026-09-24 (D-43):** el sistema ya no muestra `valor_referencia` en ninguna pantalla.
> Solo lleva el control y seguimiento de lo que se registra en él. Lo de abajo queda como registro de
> por qué existió esa cifra; la columna sigue en la hoja `Sedes`, sin mostrarse.

**Dos cifras conviven por sede, y nunca se restan entre sí:**
- `valor_referencia` — lo que el arquitecto estimó en la visita. Es el punto de partida, no un
  presupuesto, y se congela al importar: nunca se sobrescribe.
- `valor_real` — el presupuesto que efectivamente radica el municipio.

Restarlas produciría un "porcentaje de desviación" que ya se comprobó engañoso: entre dos fuentes de
referencia distintas, los valores de las mismas sedes divergieron por factores de 3× a 13×, porque
una es una estimación de visita y la otra un levantamiento de cantidades — no son el mismo tipo de
cifra.

---

## 5. Qué SÍ hace el sistema

- Diligenciamiento manual del presupuesto (ítem, unidad, cantidad, valor unitario, A/U/IVA, plazo),
  con catálogos cerrados y cálculo automático.
- Carga masiva desde el Excel real del municipio, con una pantalla de revisión antes de volcar nada.
- Verificación técnica por bandeja: el arquitecto revisa lo radicado y emite un concepto
  (corresponde / corresponde parcialmente / no corresponde), quedando su firma como registro de
  auditoría de sesión, no como imagen escaneada.
- Cruce de qué capítulos tienen daño marcado contra qué capítulos tienen presupuesto — para que el
  arquitecto pregunte "¿presupuestó lo que se dañó?", no "¿se pasó de cierto porcentaje?".
- Registro de hallazgos (discrepancias entre fuentes) administrable, no solo un documento de texto.
- Versionado real: una corrección nunca sobrescribe el dato anterior — el histórico completo queda
  disponible siempre, y la hoja de cálculo que sirve de base de datos está protegida contra edición
  manual por fuera del sistema.

## 6. Qué NO hace (todavía, o por decisión explícita)

- **No exige el análisis de precio unitario (APU)** que sustenta cada precio — solo actividad,
  cantidad y valor unitario. Exigir el APU dejaría fuera a municipios que aún no tienen esa
  capacidad técnica instalada.
- **No calcula ni muestra un porcentaje de sobrecosto o ahorro** contra ningún modelo — ver §4.
- **No bloquea** presupuestos con AIU fuera de rango: alerta, porque no existe un tope legal de AIU
  en Colombia (Colombia Compra Eficiente lo confirma), solo práctica de mercado.
- **No cubre el seguimiento de obra/contratación** (módulo de Monitoreo) — aplazado hasta que existan
  datos del mecanismo de ejecución (número de contrato, contratista, actas).
- ~~No es el canal para las 938 sedes fuera del lote 1~~ — **superado por D-44 (2026-09-24):** ya no hay
  lote predefinido. El sistema cubre las 975 sedes; los alcaldes y rectores ven y registran todo su
  alcance, y el Administrador organiza el seguimiento creando lotes (por ejemplo, tipo 1 y 2 del censo).

---

## 7. Arquitectura, en una vista

```
Alcalde / Rector / Arquitecto / Directivo / Administrador
        │  navegador, sin instalar nada
        ▼
Frontend — HTML/CSS/JS sin framework, en GitHub Pages
        │  login: correo → código de un solo uso → token de sesión
        ▼
Backend — Google Apps Script (gratis, sin licencia)
        │
        ▼
Google Sheet — 6 pestañas: Sedes · Presupuestos · Items · Verificaciones · Usuarios · Hallazgos
```

**Por qué Apps Script y no un servidor tradicional:** no requiere comprar licencias ni registrar nada
en el tenant de Microsoft de la Gobernación (las cuentas institucionales son de Office 365, no de
Google). Es el mismo patrón que usa `circular122`, otro sistema ya en producción de la misma
Secretaría.

**Cómo se protege la trazabilidad:** ningún dato de presupuesto se sobrescribe (cada corrección es
una fila nueva, versión +1); y la hoja de cálculo en sí está protegida para que solo el backend
pueda escribir — nadie puede editar una celda a mano por fuera del sistema sin que quede un rastro
imposible de producir.

**Cómo se protege la continuidad:** el login bloquea un código tras 5 intentos fallidos, el Sheet
completo se respalda solo todos los días a una carpeta aparte de Drive (30 días de retención), y
`docs/RUNBOOK_CONTINUIDAD.md` documenta qué hacer si quien mantiene la cuenta que despliega el
backend deja la práctica sin poder coordinar el traspaso (D-38).

Arquitectura completa, con nombres de archivo exactos: `README.md` (estructura del proyecto) y
`backend/README.md` (cómo se despliega).

---

## 8. Estado del desarrollo — solo el resumen

Para el detalle paso a paso, `docs/PLAN_DESARROLLO.md` §3-4. Snapshot a la fecha de este documento:

| Frente | Estado |
|---|---|
| Diseño visual de las 10 pantallas, 4 roles | ✅ Cerrado (`docs/diseno/mockup_v6.html`) |
| Catálogo de las 975 sedes con censo de daños | ✅ Construido y verificado |
| 4 lectores de Excel real (ingesta) | ✅ Construidos y probados contra archivos reales |
| Backend: Sheet + 6 pestañas + protección | ✅ Desplegado en producción |
| Login por código de un solo uso | ✅ Funcionando, probado de punta a punta |
| Lectura de sedes filtrada por rol | ✅ Funcionando para Administrador; sin probar aún para los otros 3 roles |
| Pantallas Sedes → Municipio → Ficha con datos reales | ✅ Conectadas y probadas 2026-09-17 (identidad y censo de daños; presupuesto y verificación se muestran vacíos porque no existen todavía) |
| Tablero con datos reales | ✅ Conectado y probado 2026-09-17 (cifras, mosaico de municipios y rankings reales; Bitácora vacía porque no hay actividad que registrar todavía) |
| Registrar presupuesto (escritura real, con versionado) | ✅ Verificado en producción 2026-09-21 (guardar borrador, radicar, corregir sin sobrescribir); 4 huecos encontrados en auditoría posterior (Ficha sin reflejar cruce/detalle/historial reales, validación de longitud solo en el navegador) — corregidos el mismo día |
| Verificación (bandeja + emitir concepto) | ✅ Desplegado y verificado en producción 2026-09-21: login, radicación, bandeja, emisión de concepto (D-22), mutación de una sola celda (D-39) y candado de concurrencia (D-39), todo confirmado contra el backend real |
| Cargas (subir JSON del lector, confirmar y volcar) | ✅ Confirmado en producción 2026-09-21: `ingesta_ARANZAZU.json`, 2 de 9 registros confirmados a mano y volcados con `origen: CARGA`, verificados contra el backend real (D-36/D-40/D-41) |
| Registro fotográfico (D-29 sección 4) | ✅ Desplegado y verificado en producción 2026-09-21: `subirFoto` escribe en Drive (carpeta por DANE sede, D-19) y `listarFotos` lee solo metadata — probado con un archivo real contra la sede 217050000060 (Buenos Aires, Aranzazu) |
| Checklist "Formato oficial" de la Ficha (5 secciones) | ✅ Las 5 secciones se calculan solas con datos reales (2026-09-21): 1-4 desde `obtenerPresupuesto`/`listarFotos`, la 5 desde `verificacion` — las 5 confirmadas "Completa" en la prueba de producción |
| Sección 5 de la Ficha (concepto de verificación, modo lectura, D-30) | ✅ Desplegado y verificado en producción 2026-09-21: `_verificacionDe` en `Verificaciones.gs`, expuesto en `Presupuestos_obtener`; el panel "Concepto del arquitecto" mostró resultado, observaciones, verificador y fecha reales |
| PDF del formato oficial | ✅ Verificado en producción 2026-09-21 (adelantado del Paso 6, mismo truco sin librerías del sistema anterior) — el HTML generado contra un radicado real trae radicado, sede, ítems, totales, concepto y observaciones correctos. Sin firma-imagen (D-21 la reemplaza), sin fotos embebidas (`listarFotos` no trae el contenido) |
| Contador real de Verificación en el riel | ✅ Hecho 2026-09-21 — muestra pendientes reales una vez visitada la bandeja; antes se ocultaba siempre. 100 % frontend |
| Hallazgos (pantalla administrable) | ⏳ Diseñada, sin construir todavía — pantalla 100 % de ejemplo, no lee la pestaña `Hallazgos` real |
| Usuarios (gestión de roles) | ⏳ Diseñada, sin construir todavía — pantalla 100 % de ejemplo, "+ Agregar usuario" no hace nada |
| Correo de confirmación con el radicado | ⏳ Sin construir (Paso 6) |
| Módulo de Monitoreo/Obras | ⏸️ Aplazado — faltan datos de contratación |

---

## 9. Qué puede cambiar, y dónde se refleja

Este documento resume decisiones que **sí pueden moverse** a medida que avanza el desarrollo o
cuando el sistema ya esté en uso real: quién tiene cada rol, qué capítulos se manejan, qué umbrales
de alerta aplican (pendiente el aval de Planeación), o incluso el alcance de qué sedes cubre el
sistema en cada fase.

**Protocolo de actualización:** cuando algo de lo descrito aquí cambie, se actualiza esta misma
sección correspondiente (no se crea un documento paralelo), y el porqué del cambio queda registrado
con su fecha en `docs/REGISTRO_DESARROLLO.md`. Las decisiones formales de negocio siguen numerándose
en `CLAUDE.md` (`D-38` en adelante) — este documento las resume, no las reemplaza.
