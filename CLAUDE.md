# reconstruccion-sedes — SED Caldas

Sistema de trazabilidad de la reconstrucción de infraestructura educativa afectada por el sismo del
10 de agosto de 2026: presupuesto real por sede, verificación técnica de un arquitecto, y —cuando
esté disponible la información de contratación— seguimiento del plan de acción de cada sede hasta la
entrega de obra (D-17, módulo 4).

Nació como «Aplicativo presupuestal para municipios» (`trabajo 8.09/presupuesto-sedes`). El nombre y
la ubicación cambiaron el 2026-09-09 porque el alcance dejó de ser solo presupuesto: es un proyecto
de varios meses y, según la convención de carpetas de la práctica, no le pertenece a la carpeta del
día en que empezó. Vive ahora en la raíz de `gobernacionCaldasPractica`, sin prefijo `trabajo`,
igual que `sige`.

**Este archivo se actualiza cada vez que avanzamos.** Ver §9 para el protocolo.

---

## 1. Qué es y por qué importa

Es el **registro del presupuesto real** de reconstrucción, sede por sede, con verificación técnica.

Criterio rector, del que se deriva todo lo demás:

> **Solo entran valores reales.** Cada cifra tiene que poder sustentarse ante el MEN, la UNGRD o
> Hacienda diciendo de dónde salió: quién la levantó, sobre qué daño, con qué cantidades y con qué
> precio unitario. Si el municipio digita en texto libre, nada de eso se puede reconstruir.

Dos valores conviven por sede, y **no se restan** (D-28):

- **`valor_referencia`** — lo que el arquitecto estimó en la visita, en `dimDañosInfraestructura`.
  Es el punto de partida del seguimiento, no un presupuesto.
- **`valor_real`** — el presupuesto que radica el municipio, digitado a mano o leído de su Excel.

**Historia:** el proyecto nació como contrapartida del modelo paramétrico que Planeación produjo el
08-09-2026 (`ESTIMACION COSTOS ...xlsx`, $23.348.062.500 sobre 456 sedes). Ese modelo quedó
**retirado del sistema el 2026-09-16 (D-26)**: ya no se lee, no se guarda su cifra y no se contrasta
contra él. El propio oficio del estudio decía que **«no constituye presupuesto de obra»**, y los
valores de `dimDaños` lo confirmaron al divergir por factores de 3× a 13× en las mismas sedes.

Análisis completo: `docs/ANALISIS_INSTRUMENTO_PRESUPUESTAL.md`.
Formato origen: `INFORME TÉCNICO PRESUPUESTAL para municipios.docx`.
Modelo de arquitectura: https://sedcaldas.github.io/circular122/ (lo hizo un funcionario de la SED).

---

## 2. Decisiones cerradas — no reproponerlas

| # | Decisión | Definición |
|---|---|---|
| D-1 | ~~Backend: Power Automate Premium~~ | **ANULADA el 08-09-2026**: la Gobernación no compró la licencia y el disparador HTTP es premium. Reemplazo pendiente entre tres opciones, ver §8.1 |
| D-18 | **El aplicativo de los alcaldes se retira como puerta de entrada** | **2026-09-09**, resuelve Q-11. El *sistema* (catálogo, consolidación, cálculo, PDF, consola) **sigue siendo la base** del sistema nuevo (D-17) — lo que se retira es solo el formulario con token al que iba a entrar el alcalde. Consecuencia ejecutada: el repositorio `Jostrel19/presupuesto-sedes` en GitHub **se puso en privado** el 2026-09-09 (no se eliminó), porque el sitio publicaba `data.js` con 1.017 correos y celulares de rectores y alcaldías (Q-9) y ya no tenía uso. `tokens.js`, `generar_enlaces.py`, `tablero.js`, `index.html` y los 26 enlaces quedan sin uso. **Se conservan y se reutilizan** `pdf.js`, la lógica de cálculo de `formulario.js` para la edición interna, y `config.js` |
| D-17 | **Giro de operación** | **2026-09-09:** el sistema deja de ser un formulario para alcaldes y pasa a ser un **sistema interno**: el practicante carga los Excel que las alcaldías ya están enviando, y el sistema los analiza, valida y vuelca. Se conserva el catálogo, la lógica de consolidación, el PDF y las reglas de negocio; la consola es la base sobre la que se construye. **Anula D-2.** Plan completo en [`docs/HANDOFF_REDISENO_SISTEMA.md`](docs/HANDOFF_REDISENO_SISTEMA.md) |
| D-2 | ~~Quién diligencia~~ | ~~**El alcalde**, por todas las sedes de su municipio~~. **ANULADA el 2026-09-09 por D-17** |
| D-3 | Universo | **Las 975 sedes oficiales** menos las que el municipio declare sin afectación. No las 554 tipo 1-4 |
| D-4 | Tamizaje | Pre-marcado según el censo: las 271 tipo 5 llegan como «sin afectación» y solo se confirman; tipos 6 y 7 en blanco |
| D-5 | Fórmula AU | **A y U por separado, sin Imprevistos** (en lo público no se maneja la I), **más IVA 19 % sobre la utilidad** |
| D-6 | Referencia mostrada | Tipo y nivel de afectación del censo. **Nunca el valor estimado por la SED** — para que el presupuesto municipal sea una medición independiente sin anclaje |
| D-7 | Adjuntos | Solo **registro fotográfico**. El certificado de la UNGRD municipal no se exige |
| D-8 | Cierre | **Viernes 11 de septiembre de 2026**, en modalidad de prueba |
| D-9 | Uso compartido | TI **sí** permite compartir con personas concretas (alcaldes, rectores, quien requiera diligenciar). **No** se confirmó el tipo «cualquier persona con el vínculo», que es el que exige la solicitud de archivos anónima. Ver §8.1 |
| D-10 | Backend elegido | **Opción A′**: paquete `.json` que el alcalde sube a una carpeta de SharePoint compartida con el correo de su alcaldía. `BACKEND: 'archivo'` en `config.js`. Reemplaza a D-1 |
| D-14 | Consolidación | **`tools/consolidar.py`** lee la carpeta de entregas —sincronizada por OneDrive al disco— y produce el Excel consolidado con avance, contraste, actividades, pendientes y las fotos extraídas. No necesita SharePoint, permisos ni flujos: es el camino que permite arrancar la recolección hoy |
| D-15 | Automatización del consolidado | **`tools/vigilar.py`** rehace el Excel solo cuando llega un paquete. Se eligió sobre el flujo de Power Automate para arrancar porque no necesita tenant, permisos ni licencias, y porque durante la primera recolección conviene que un humano vea lo que entra antes de que alimente cifras oficiales. El flujo (`docs/AUTOMATIZACION_TABLERO.md`) sigue siendo el destino cuando entreguen los 26 a la vez |
| D-16 | Power BI se conecta al consolidado, no a la carpeta de JSON | Power BI **puede** leer la carpeta cruda, pero así se cargan ~2 GB de fotos en base64 que nunca se usan, los reenvíos se cuentan dos veces, las dos formas de paquete (`radicarPresupuesto` / `declararSinAfectacion`) hay que distinguirlas a mano, y **no existe denominador**: las sedes que faltan y el `valor_modelo` no viajan en los paquetes. El tablero apunta a `data/generado/CONSOLIDADO.xlsx`, de nombre fijo para que la conexión no se rompa al cambiar de día |
| D-13 | Firma en el documento | Alcalde y verificador suben **una imagen de su firma**, que se guarda por persona (no por registro) y se aplica a todas sus radicaciones o verificaciones. Aparece en el PDF junto a nombre, cédula y fecha. Es firma electrónica simple, no certificada |
| D-12 | Contrato con el flujo | Los paquetes llevan `esquema: 1`. Si cambia su forma hay que subirlo, y el flujo debe apartar lo que no reconoce en vez de escribir datos incompletos. El campo `version` viaja en el paquete: es lo que permite descartar reenvíos |
| D-11 | Nombres de municipio | Se guardan y muestran **con tildes** (`PÁCORA`, `SAMANÁ`). La normalización sin tildes es solo para cruzar y para los enlaces. Ver §3 |
| D-19 | **Backend del sistema nuevo: Google Apps Script** | **2026-09-15.** Reemplaza la exploración de Logic Apps/Functions de §8.1: Apps Script + Google Sheets (como base de datos) + Drive (como repositorio de archivos), gratis, sin licencia ni registro en Entra ID. Mismo patrón que `circular122` (otro sistema de la SED), ya validado en producción con el mismo dominio institucional. `api.js` no cambia de forma — su modo `'http'` ya existía; solo cambia a qué URL apunta |
| D-20 | Autenticación | **REVISADA 2026-09-15 — código de un solo uso por correo, no Google Sign-In.** Las cuentas institucionales de la SED son de Office 365, así que pedir una cuenta de Google para iniciar sesión era fricción real, no una simplificación. El usuario escribe su correo institucional; Apps Script lo busca primero en `Usuarios` (si no está, no se manda nada) y le envía un código de 6 dígitos por correo (`MailApp`/`GmailApp` — entrega SMTP normal, le llega a Outlook igual que cualquier correo externo); el código vence en 5-10 min y es de un solo uso; al validarlo se entrega un token de sesión firmado. Mismo patrón que D-9 (verificación por código de un solo uso). El frontend se queda en GitHub Pages. **Esto solo resuelve autenticación** (quién sos) — el módulo de roles y permisos (Administrador / Verificador / Responsable de sede / Consulta, con su alcance) sigue siendo exactamente el diseñado en `Usuarios`, sin cambios: una vez validado el código, el rol se lee de esa misma pestaña, igual que estaba pensado con Google Sign-In |
| D-21 | Firma del Verificador | **Se reemplaza la firma-imagen de D-13 por el registro de auditoría de la sesión** (quién, con qué cuenta, cuándo) para las verificaciones del sistema nuevo. Ya no hace falta subir una imagen ni escribir cédula a mano: el login con cuenta real identifica a la persona de forma verificable. D-13 se mantiene tal cual para lo que ya está construido del sistema viejo (alcalde/verificador sin cuenta institucional) |
| D-22 | Regla `resultado_verificacion` → `estado`, provisional | **Corresponde → `APROBADO`; corresponde parcialmente → `REQUIERE_AJUSTE`; no corresponde → `REQUIERE_AJUSTE`.** Regla conservadora mientras Planeación responde Q-7: evita que el sistema apruebe automáticamente hacia obra un presupuesto que el propio verificador marcó como incompleto. `resultado_verificacion` se guarda siempre tal cual lo marcó el arquitecto — esta fila solo decide a qué `estado` empuja, y cambia sola cuando Q-7 se resuelva |
| D-23 | Volcado de los lectores de ingesta | **Pantalla de importación dentro de Cargas**, no llamada directa de Python al backend. Corres el lector, revisas el informe como hoy, y subes el resultado desde el navegador ya autenticado. Todo lo que escribe en el sistema pasa por el mismo camino con sesión — no hay que crear ni proteger una clave de servicio aparte para que Python llame al backend directamente |
| D-24 | **"Responsable de sede" incluye a alcaldes y rectores, no solo personal de la SED** | **2026-09-15.** Aclaración sobre D-17/D-18: lo que se retiró fue el mecanismo inseguro (enlace público con token + catálogo con contactos expuesto en el sitio, `data.js`), no el que las alcaldías/rectorías tengan acceso directo. Con D-20 (login por código de correo) y los contactos viviendo en la pestaña `Usuarios` del backend —nunca en el frontend público— pueden volver a entrar directamente, de forma segura. **Alcance:** alcalde = todas las sedes de su municipio; rector = las sedes de su institución según el catálogo (1 a 18 sedes, según lo que diga `fctMaestra`). **Permisos:** idénticos para ambos, sin distinción — la única diferencia es cuántas sedes abarca su acceso. Borrador de 187 filas (26 alcaldes + 161 rectores) generado automáticamente del catálogo con `tools/generar_usuarios_borrador.py` — pendiente de que alguien confirme que los correos siguen vigentes antes de invitar a alguien real |
| D-25 | Alcance del Verificador | **Todas las sedes del departamento**, sin restricción por municipio — a diferencia de Responsable de sede. Válido mientras el equipo de verificación sea pequeño (1-3 arquitectos); si crece, revisar |
| D-26 | **`dimDañosInfraestructura.xlsx` es la fuente del censo. El modelo paramétrico queda retirado** | **2026-09-16.** `ESTIMACION COSTOS RECONSTRUCCION SEDES OFICIALES 08_09_2026.xlsx` **sale del sistema**: no se lee, no se guarda su cifra y no se contrasta contra ella. La reemplaza `data/insumos/dimDañosInfraestructura.xlsx`, hoja `EstadoInfraestructura`, que es el censo **vivo** que mantienen los arquitectos. Verificado: 975 DANE, cruce exacto con el catálogo, **0 discrepancias**. Aporta dos cosas que el modelo no tenía: daño marcado **por capítulo** (11 columnas «X», que son exactamente los 11 `CAPITULOS` de `config.js`) y una cifra que se actualiza con cada visita. Se elimina de `rutas.py` la constante `F_ESTIMACION` |
| D-27 | **Dos variables de valor, ambas se conservan** | `valor_referencia` (del arquitecto, en `dimDaños`) y `valor_real` (el presupuesto que llega, por Excel o digitado). **La referencia se congela al importar y NUNCA se sobrescribe con el valor real** — son dos hechos distintos y perder el primero borra la trazabilidad de en qué se basó la priorización. Advertencia real: la columna `PRESUPUESTO APROX INVERSION` **mezcla** estimaciones con presupuestos ya recibidos (las 4 sedes de Samaná traen cifra idéntica a la del presupuesto radicado). Por eso se guarda como «referencia» y no como «estimado» |
| D-28 | **Desaparecen el contraste contra el modelo y el % de desviación** | Se muestran los dos valores **lado a lado, sin restarlos**. Razón: la referencia es una estimación de visita y el valor real es un levantamiento de cantidades; su diferencia no es un sobrecosto ni un ahorro, y presentarla como porcentaje induce una conclusión falsa. Evidencia que lo respalda: entre el modelo viejo y `dimDaños` los valores divergen por factores de 3× a 13× en las mismas sedes (Ángel de la Guarda $438M→$1.055M, Encimadas $180M→$5,1M). Se eliminan `consola.desviacion()` y `consola.valorModelo()` del alcance. **D-6 sobrevive en su intención**, no en su mecanismo: `valor_referencia` sigue oculto al rol Responsable de sede para que el municipio mida por su cuenta |
| D-29 | **Vuelve el módulo de registro a detalle, y vive dentro de la Ficha** | Ítems por capítulo de daño (unidad, cantidad, valor unitario, valor total), A y U por separado, IVA sobre la utilidad y plazo — la lógica de `formulario.js` del sistema anterior, que ya estaba probada. No es una pantalla aparte: es la sección 4 de la Ficha de sede, para que registrar y consultar sean el mismo lugar. Sirve al caso de uso de alcaldes y rectores que diligencian a mano |
| D-30 | Verificación es **pantalla propia**, no un modal | Los arquitectos trabajan por **bandeja** (todo lo radicado esperando concepto), no sede por sede. Un modal dentro de la ficha obliga a navegar a cada sede para saber qué falta. La ficha conserva la sección 5 en modo **lectura** (qué concepto se emitió, quién y cuándo); emitir el concepto ocurre en la pantalla de Verificación |
| D-34 | **Los capítulos de presupuesto son 14: los 11 del censo + 3 transversales** | **2026-09-16.** Medido sobre el presupuesto real de Belalcázar (673 M de costo directo, 74 actividades): **el 13,6 % no mapea a ninguno de los 11 capítulos del censo** — `DEMOLICIONES` 10,6 %, `PRELIMINARES` 2,2 %, `DESMONTES` 0,8 %. No son un lugar donde haya daño: son trabajo que toda reconstrucción necesita. Sin ellos, quien presupuesta lo mete a la fuerza en un capítulo equivocado y el cruce daño↔presupuesto se ensucia. Se agregan **12. Preliminares y obras provisionales · 13. Demoliciones y desmontes · 14. Aseo, escombros y disposición final**. **Los 11 del censo no se tocan** —son de los arquitectos, no nuestros— y el cruce «presupuesto sin daño» **solo evalúa del 1 al 11**: los transversales nunca se marcan como anomalía |
| D-35 | **El sistema pide actividad + cantidad + valor unitario, NO el APU que lo sustenta** | Los municipios llegan con tres niveles de madurez muy distintos (ver §3): Belalcázar con base de APU completa (precio unitario derivado de insumos + mano de obra + herramienta + factor prestacional), Aguadas/Aranzazu con plantilla y hoja de APU, y Samaná con una **lista de materiales de ferretería**, sin mano de obra ni actividades. Exigir APU dejaría a Samaná sin poder radicar; no exigirlo permite que todos entren con lo que tienen. El APU, cuando exista, viaja como **adjunto**, no como estructura que el sistema valide. **Consecuencia aceptada:** el sistema no puede verificar que un precio unitario sea razonable — eso lo hace el arquitecto en la verificación, que es justamente para lo que existe |
| D-32 | **Si una sede sale de tipo 1-2 en `dimDaños`, sale del lote** | **2026-09-16.** Resuelve el hallazgo de La Dorada (`117380000134`, ESCUELA ANTONIO JOSE DE SUCRE), reclasificada de prioritaria a «4. afectaciones menores». Consecuencia de D-31: si la priorización **se deriva** del tipo, entonces manda el censo y no hay lista que mantener a mano. La sede no desaparece del sistema —sigue entre las 975, con su ficha y su tipo— solo sale del **lote 1**. El censo es de los arquitectos; si se equivocaron, se corrige en `dimDaños` y el lote se recalcula solo en el siguiente build. **Efecto secundario a vigilar:** La Dorada queda sin ninguna sede en el lote, así que el lote pasa de 12 a 12 municipios (entra Viterbo con 2, sale La Dorada con 1) |
| D-33 | **Los cuatro roles tienen pantalla; el diligenciamiento manual es una pantalla propia** | El alcalde y el rector **digitan el presupuesto ítem por ítem** en el sistema (pantalla «Registrar presupuesto»), con la lógica del sistema anterior que ya estaba probada: catálogos cerrados de unidad y capítulo, cálculo automático, parseo del formato colombiano (`1.500.000`), alerta de A/U sin bloqueo, y el aviso de que las fotos hay que readjuntarlas. Es el camino de D-24: los externos entran directo. La carga masiva de Excel (Cargas) es el camino del **arquitecto**, para no volver a digitar lo que el municipio ya mandó. Los dos caminos escriben en el mismo sitio y producen el mismo registro versionado |
| D-31 | **La priorización se deriva del tipo de afectación, no de una lista aparte** | Priorizada = `A2. TIPO DE AFECTACIÓN` tipo **1** (colapso total o parcial) o **2** (riesgo inminente) — los dos que el propio censo marca `PRIORITARIO`. Da **37 sedes en 12 municipios**, $9.718.464.165 de referencia, las 37 con valor. `data/insumos/PrimerasPriorizadas.xlsx` (33 sedes) **queda retirado como fuente**: dos listas paralelas se desincronizan, y de hecho ya lo habían hecho (ver §3, hallazgo de reclasificación) |

---

## 3. Reglas de datos — inviolables

- **Cruzar siempre por `DANE SEDE` (12 dígitos), nunca por nombre de sede.** Los nombres difieren
  entre fuentes.
- **El DANE nunca se digita en el aplicativo.** Solo se selecciona desde el catálogo. Un DANE mal
  digitado deja el registro huérfano y rompe la cadena estimación → presupuesto → verificación →
  consolidado.
- **`fctMaestra.xlsx` es la fuente de verdad** del universo de sedes, SECTOR, estado DUE y matrícula.
  Su ruta se resuelve en `tools/rutas.py`.
- **La columna DANE del `Directorio Instituciones Educativas 2026.xlsx` está desplazada.** Para
  precargar rector y contacto se cruza por **municipio + nombre de I.E.**, jamás por DANE.
- Universo declarado: **oficiales + activas + con matrícula = 975** (sin Manizales, que es
  secretaría certificada aparte).
- No inventar datos, cifras, normas ni decisiones institucionales. Si una sede aparece en una fuente
  y no en `fctMaestra`, se reporta como hallazgo.
- **Tildes (D-11).** `norm()` quita tildes y sirve **solo para cruzar**; `norm_vis()` las conserva y
  es lo que se guarda. Un instrumento oficial que va a los alcaldes no puede decir `PACORA`. Los
  enlaces sí viajan sin tildes —los correos las rompen— y el aplicativo resuelve el nombre canónico
  con `app.resolverMunicipio()`.
- **El contenido de las fotografías nunca se persiste en el navegador**, ni en registros ni en
  borradores: solo el nombre. Medido en Riosucio, 58 sedes con 3 fotos llegan a 49 MB y el navegador
  empieza a rechazar escrituras en silencio. El base64 vive en memoria durante la sesión y viaja en
  el paquete que se descarga. Consecuencia deliberada: **al reabrir una sede hay que volver a
  adjuntar las fotos**, y el formulario lo advierte y bloquea la radicación hasta que se haga.

### Cómo presupuesta cada municipio — tres niveles, verificado 2026-09-16

Inspección de los archivos reales. Explica **de dónde salen los valores** y por qué el sistema no
puede exigir un formato único (D-35):

| Municipio | Qué mandó | De dónde sale el precio | AIU declarado |
|---|---|---|---|
| **Belalcázar** | Presupuesto profesional, 10 hojas: `Capitulos`, `Actividades`, `Presupuesto`, `A.P.U`, `Insumos`, `Analisis AU`, `Analisis Mano de Obra`, `Analisis Herramienta Menor`, `Analisis Factor Prestacional`, `Polizas` | **Base de APU**: cada precio unitario se arma de insumos + mano de obra + herramienta + factor prestacional. 35 capítulos disponibles, 18 usados, 74 actividades con cantidad | Hoja propia de análisis |
| **Aguadas · Aranzazu** | Misma plantilla (el encabezado dice **«ALCALDÍA MUNICIPAL DE SALAMINA»** — la copiaron sin cambiar el membrete). Lista plana `ITEM · DESCRIPCIÓN · UND · CANT · VR. UNITARIO`, agrupada por I.E. → sede | Hoja `APU's` + `RESUMEN APU` | **A 25 % · I 0 % · U 5 %** |
| **Samaná** | **No es un presupuesto**: es una **lista de materiales de ferretería** (bulto de cemento $37.000, teja Eternit #6 $78.000, bloque recocido #5 $1.950…) con precio por unidad | Cotización de ferretería. **No incluye mano de obra ni actividades** | No declara |

Tres consecuencias que ya están en decisiones:

1. **El sistema pide actividad + cantidad + valor unitario, no el APU** (D-35). Es el mínimo común
   entre los tres.
2. **Los 11 capítulos del censo no alcanzan para presupuestar** (D-34): faltan demoliciones,
   preliminares y escombros.
3. **El umbral de alerta de `config.js` (A > 12 %) está por debajo de lo que la realidad declara.**
   Aguadas y Aranzazu radican con **A 25 %**, más del doble. La alerta va a saltar en casi todo lo
   que llegue de esos dos. Es correcto que **alerte y no bloquee** (§4: no hay tope legal), pero el
   umbral necesita el aval de Planeación antes de publicarse — **es exactamente Q-3**, y ahora hay
   evidencia concreta para llevarle: no es una pregunta teórica.
   **Nota sobre Imprevistos:** ambos declaran la «I» aunque en cero. D-5 la eliminó del formulario;
   si algún municipio la usa distinta de cero, el lector debe **reportarlo como hallazgo**, no
   sumarla en silencio a otra casilla.

### Hallazgos abiertos en las fuentes

- **La priorización cambió al pasar a `dimDaños` (2026-09-16).** De las 33 de
  `PrimerasPriorizadas.xlsx`, **32 siguen** siendo tipo 1-2 y **entran 5 nuevas** (Viterbo: La
  Milagrosa y Nazario Restrepo; Anserma: Suer de Navas; Filadelfia: Piedras Blancas; Risaralda:
  Policarpa Salavarrieta). **Sale 1:** `117380000134` — ESCUELA ANTONIO JOSE DE SUCRE (La Dorada),
  reclasificada de prioritaria a **«4. afectaciones menores»**. **Resuelto por D-32:** manda el
  censo, la sede sale del lote. Queda anotado aquí como registro de que el cambio fue deliberado y
  no una pérdida de datos — si los arquitectos lo corrigen en `dimDaños`, vuelve sola.
- **5 de las 37 priorizadas no tienen ningún capítulo de daño marcado** en `dimDaños`, pese a estar
  clasificadas tipo 1 o 2. Están priorizadas por tipo pero sin detalle de qué se dañó, así que no
  hay contra qué verificar su presupuesto. Reportado en la Ficha con aviso visible.

- `fctMaestra`, I.E. DANE `117380000789` (La Dorada): el campo `I.E.` contiene
  «INSTITUCIÓN EDUCATIVA RENÁN BARCO - JUAN PABLO II- SEDE PRINCIPAL», que es nombre de sede, no de
  institución. Afecta a sus 2 sedes. Resuelto en el cruce, **no** corregido en el maestro. Reportar
  a quien administra el archivo.

---

## 4. Marco normativo verificado

- **IVA sobre la utilidad:** Decreto 1372 de 1992, art. 3 — en contratos de construcción de bien
  inmueble el IVA se genera sobre los honorarios del constructor y, si no se pactan, **sobre la
  utilidad**. Respalda D-5.
- **Topes de AIU: no existen por ley.** Colombia Compra Eficiente sostiene que el AIU no está
  definido en la ley y que cada entidad estatal es autónoma para determinarlo. Solo hay práctica de
  mercado: AIU total 20–30 % del costo directo, desglose usual A 10 % / I 5 % / U 5 %. Sin la «I»,
  la referencia equivalente es **A 10 % + U 5 % ≈ 15 %**.
- Por eso el aplicativo **alerta, no bloquea**: umbral configurable en `config.js`
  (`ALERTA_ADMIN_PCT`, `ALERTA_UTILIDAD_PCT`). Son criterio de negocio y **requieren aval de
  Planeación** antes de publicarse.

---

## 5. Arquitectura

```
Alcalde (navegador, sin cuenta Microsoft)
   │  enlace con token por municipio:  ?m=RIOSUCIO&t=<token>
   ▼
Sitio estático  ─  GitHub Pages, patrón circular122
   js/data.js   catálogo de 975 sedes / 161 I.E. / 26 municipios
   js/api.js    cliente desacoplado del backend  ← único punto que cambia
   ▼  POST JSON
Backend (ver §8)
   ├──► Lista SharePoint  PresupuestosSedes    un registro por sede y versión
   ├──► Lista SharePoint  ItemsPresupuesto     filas de la sección 3
   ├──► Biblioteca        SoportesFotograficos carpeta por DANE SEDE
   └──► Correo de confirmación con número de radicado
         ▼
   Power BI conectado directo a las listas
```

**`api.js` está desacoplado a propósito.** Tiene modo local (localStorage) y modo backend. Todo el
frontend se construye y prueba sin backend; conectarlo es cambiar una URL en `config.js`.

### Estructura del proyecto

El proyecto vive en `trabajo 8.09/presupuesto-sedes/` y es autocontenido: se puede mover completo a
otra carpeta, a otro equipo o a un repositorio sin editar nada. Ver `README.md`.

```
presupuesto-sedes/
├── README.md                   punto de entrada: capas, comandos, migración
├── CLAUDE.md                   este archivo
├── .gitignore
├── web/                        RAÍZ PUBLICABLE — el límite público/privado
│   ├── index.html                aplicativo de la alcaldía
│   ├── consola.html              consola interna — NO publicar
│   └── assets/
│       ├── css/styles.css
│       └── js/                   ver «Capas del cliente»
├── tools/                      generación de artefactos, no se publica
│   ├── rutas.py                  PUNTO ÚNICO de configuración de rutas
│   ├── consolidar.py             carpeta de entregas -> Excel consolidado
│   ├── vigilar.py                rehace el consolidado al llegar un paquete
│   ├── build_catalogo.py         fuentes oficiales -> catálogo
│   ├── generar_enlaces.py        tokens, hashes y enlaces
│   ├── gen_instructivo.py        instructivo en Word
│   ├── versionar.py              sube la versión y refresca la caché
│   ├── servir.py                 servidor local sin caché
│   └── requirements.txt
├── data/
│   ├── generado/                 catalogo_sedes.json (regenerable)
│   └── privado/                  tokens.json y enlaces — NUNCA se publican
└── docs/                       análisis, guía de montaje, instructivo
```

### Capas del cliente

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Configuración | `config.js` | Parámetros de negocio |
| Datos | `data.js` · `data-sed.js` · `tokens.js` | Generados: **no editar a mano** |
| Utilidades | `util.js` | Formato, escape, etiquetas |
| Persistencia | `storage.js` | Único que toca `localStorage` |
| Transporte | `api.js` | Único que conoce el backend |
| Presentación | `pdf.js` | Formato oficial diligenciado |
| Interfaz | `tablero.js` · `formulario.js` · `consola.js` | Pantallas |
| Arranque | `app.js` | Enrutado, token, sesión |

Reglas que sostienen la separación, y que hay que respetar al modificar:

- **`api.js` es el único que sabe cómo se envía.** Ninguna pantalla llama a `fetch` ni descarga.
- **`storage.js` es el único que toca `localStorage`.**
- **Los parámetros de negocio viven en `config.js`,** no dispersos en la lógica.
- **Los archivos generados no se editan:** se regeneran con `tools/`.
- **Ningún script trae rutas absolutas:** todo pasa por `tools/rutas.py`, que además admite la
  variable de entorno `SED_FUENTES` para reubicar los `.xlsx` institucionales.

### Separación de catálogos — no fusionarlos

`tools/build_catalogo.py` emite **dos** archivos y es deliberado:

- **`data.js`** lo carga `index.html`. **No lleva** `valor_modelo`, `orden_priorizacion`,
  `n_danos` ni `en_alcance`. D-6 exige que el municipio presupueste sin ver la cifra de la SED, y
  si el dato viaja al navegador basta abrir el inspector para verlo.
- **`data-sed.js`** lo carga solo `consola.html`. Ahí sí va el valor del modelo, que es lo que
  permite calcular la desviación.

Nunca cargar `data-sed.js` desde `index.html`.

### Acceso por enlace con token

`tools/generar_enlaces.py` produce `data/privado/tokens.json` (tokens en claro, **no se publica**) y
`web/assets/js/tokens.js` (solo hashes SHA-256 truncados, sí público). El hash incluye el nombre del
municipio, de modo que un token no sirve para otro municipio. Los tokens se conservan entre
ejecuciones: regenerar el catálogo no invalida enlaces ya repartidos.

**Alcance real de este control:** evita que un municipio diligencie por otro y deja trazabilidad.
**No es autenticación.** La barrera de verdad es la carpeta de SharePoint, compartida individualmente
con cada alcaldía.

### Versionado de caché

Los `<script>` y el CSS llevan `?v=<versión>`. Al corregir algo hay que subir la versión, o los
alcaldes seguirán con la versión vieja en caché. Se hace con `python tools/versionar.py 0.2.0`, que
actualiza `config.js`, los dos HTML y `rutas.py` de una sola vez.

### Convenciones de código

- HTML/CSS/JS sin framework ni dependencias externas, como circular122. Nada de CDN.
- Español en identificadores de dominio (`dane_sede`, `costo_directo`, `radicado`).
- Cálculos siempre en el sistema, nunca digitados: `valor_total = cantidad × valor_unitario`,
  costo directo, A, U, IVA y total.
- Catálogos cerrados para unidad de medida y capítulo de daño. En texto libre llegan «mt2», «M2» y
  «metro cuadrado», y consolidar 975 sedes se vuelve trabajo manual.
- Un registro vigente por DANE SEDE, con **versionado en vez de sobrescritura**.

---

## 6. Modelo de datos — backend Apps Script (D-19), 6 pestañas

Reemplaza el modelo anterior, pensado para listas de SharePoint (§8.1, sistema viejo). Este es el
que se crea en el paso 0 del desarrollo (`docs/PLAN_DESARROLLO.md`).

**`Sedes`** — volcado de `catalogo_sedes.json` (975 filas), no se edita a mano, se regenera con
`tools/build_catalogo.py`:
`dane_sede · municipio · dane_ie · institucion · sede · zona · matricula · estado_sede ·
tipo_censo · priorizada · capitulos_dano · valor_referencia · estado_prestacion ·
concepto_tecnico · observaciones_censo`

**`Presupuestos`** (una fila por versión radicada — D-27, D-28: `valor_referencia` vive en `Sedes`,
nunca se copia aquí ni se sobrescribe):
`id_presupuesto · dane_sede · version · origen (MANUAL | CARGA) · archivo_origen · costo_directo ·
pct_admin · pct_utilidad · valor_admin · valor_utilidad · valor_iva · total_presupuesto ·
plazo_dias · descripcion_afectacion · declara_sin_afectacion · justificacion_discrepancia ·
estado · creado_por · fecha_creacion · vigente (bool)`

**`Items`** (N filas por `id_presupuesto` — D-29, D-33; ver D-36 sobre cuándo se llena a este nivel
de detalle):
`id_presupuesto · n_item · capitulo (1-14) · descripcion · unidad · cantidad · valor_unitario ·
valor_total`

**`Verificaciones`** (una fila por concepto emitido — D-21, D-22, D-30):
`id_presupuesto · resultado (CORRESPONDE | CORRESPONDE_PARCIAL | NO_CORRESPONDE) ·
observaciones · verificador_correo · fecha_verificacion`

**`Usuarios`** (D-20, D-24, D-25):
`correo · nombre · rol (ADMINISTRADOR | VERIFICADOR | RESPONSABLE_SEDE | CONSULTA) ·
tipo (alcalde | rector | interno) · alcance (TODO_EL_DEPARTAMENTO | dane_ie | lista de dane_sede) ·
activo`

**`Hallazgos`** (discrepancias entre fuentes, nunca resueltas en silencio — CLAUDE.md §3):
`id_hallazgo · dane_sede · origen (municipio/archivo) · severidad (ERROR | ADVERTENCIA) ·
motivo · referencia · estado (ABIERTO | RESUELTO) · resuelto_por · fecha_resolucion`

**Estados de `Presupuestos`:** `PENDIENTE · SIN_AFECTACION · BORRADOR · RADICADO ·
EN_VERIFICACION · REQUIERE_AJUSTE · APROBADO`

### D-36 — Cargas vuelca el total; los ítems por capítulo solo cuando el archivo ya los trae así

Inspección de los 3 formatos reales de presupuesto (§3): **solo Belalcázar trae una columna de
capítulo por fila** (`CATEGORIA` en su hoja `Presupuesto`, con los 35 capítulos de su propia
plantilla). Aguadas, Aranzazu y Samaná traen descripciones en texto libre
(«DEMOLICIÓN MANUAL DE COLUMNA DE AMARRE…») sin ninguna columna que diga a qué capítulo pertenece.

**No se infiere el capítulo de un texto libre.** Adivinar por palabras clave («si dice
"demolición" es capítulo 13») es exactamente el tipo de adivinación que `CLAUDE.md` prohíbe para la
ingesta: parecería funcionar en los ejemplos vistos y fallaría en silencio en el municipio 27 que
describe distinto. Por eso:

- Cuando el archivo **trae capítulo estructurado** (Belalcázar): el lector mapea el capítulo del
  municipio al capítulo 1-14 del catálogo y vuelca a `Items` fila por fila. El cruce daño↔presupuesto
  (D-34) queda completo para esas sedes.
- Cuando el archivo **no lo trae** (Aguadas, Aranzazu, Samaná, y cualquier municipio nuevo sin
  columna de capítulo): el lector vuelca **solo el total** (`costo_directo`) a `Presupuestos`, sin
  filas en `Items`, y la Ficha muestra «presupuesto sin desglose por capítulo» en vez de simular un
  cruce que no se puede sustentar. El arquitecto revisa el desglose real (el Excel adjunto) al
  verificar — es exactamente para eso que existe la verificación humana.
- El diligenciamiento manual (D-33) **siempre** llena `Items`, porque ahí el capítulo lo elige la
  persona, no un algoritmo.

### Módulo Hallazgos — de panel a pantalla administrable

El diseño (mockup v6) mostraba los hallazgos como un panel de solo lectura dentro del Tablero. Con
6 hallazgos reales ya documentados en `CONFLICTOS_Y_HALLAZGOS.md` y una pestaña `Hallazgos` propia
en el backend, el Administrador necesita poder **marcarlos resueltos** para cumplir el objetivo
"control total del sistema" — no solo verlos. Se agrega como pantalla propia en el riel
(`data-mod="hallazgos"`), visible para Administrador y Verificador: lista filtrable por
abierto/resuelto, con el botón de marcar resuelto y quién lo resolvió.

### Tamizaje y confirmación masiva — Fase 2, no bloquea el lote 1

D-3/D-4 (universo = 975 menos sedes sin afectación declaradas; tipo 5 pre-marcado, tipos 6-7 en
blanco) siguen vigentes para cuando el sistema cubra las 975 sedes, no solo el lote 1 de 37. El
sistema viejo ya tenía esta pantalla funcionando («confirmación masiva de sin afectación», D-18) y
se recupera sin rediseñar cuando se aborde esa fase — **no es parte de la construcción actual**,
que solo cubre el lote 1 (D-31). Queda anotado aquí para que no se pierda, no para bloquear el
arranque.

---

## 7. Universo y carga

975 sedes · 26 municipios · 161 I.E. Todas activas en el DUE, todas con matrícula > 0.

**Censo vigente: `dimDañosInfraestructura.xlsx` (D-26).** Las cifras cambiaron respecto del modelo
paramétrico porque los arquitectos siguieron visitando: «sin revisar» cayó de 135 a 34 y esas sedes
se reclasificaron hacia arriba.

| Tipo censo | Sedes | Antes (modelo) | Tratamiento |
|---|---:|---:|---|
| **1 Colapso total o parcial** | **9** | 8 | **lote 1 — priorizada** |
| **2 Riesgo inminente de colapso** | **28** | 20 | **lote 1 — priorizada** |
| 3 Afectaciones estructurales/funcionales | 155 | 140 | abierta para presupuesto |
| 4 Afectaciones menores | 432 | 386 | abierta para presupuesto |
| 5 Sin afectación | 302 | 271 | pre-marcada, solo confirmar |
| 6 No es posible determinar | 15 | 15 | declaración expresa |
| 7 Sin revisar | 34 | 135 | declaración expresa |

**Lote 1 = las 37 de tipo 1 y 2** (D-31), en 12 municipios: Anserma 6, Aguadas 5, Aranzazu 4,
Risaralda 4, Samaná 4, Belalcázar 3, Chinchiná 3, Filadelfia 2, Pensilvania 2, Viterbo 2,
Manzanares 1, Salamina 1. Valor de referencia total **$9.718.464.165**; las 37 tienen valor.

Municipios con más carga: Riosucio 92, Pensilvania 85, Samaná 81, Anserma 65, Aguadas 61, Neira 49.
Los más livianos: Marulanda 11, San José 13, Palestina/Marmato/Viterbo 16.

---

## 8. Estado actual — sistema viejo, histórico

> **Toda esta sección describe el aplicativo para alcaldes, congelado el 2026-09-09, un día antes
> de que D-17 girara el proyecto a sistema interno.** No se actualiza. Para el estado real de hoy
> y lo que falta por construir, ver `docs/PLAN_DESARROLLO.md` y `docs/REGISTRO_DESARROLLO.md`. La
> tabla «Pendientes» de más abajo mezcla preguntas ya resueltas (marcadas), vencidas por el
> calendario (Q-6, sobre una prueba de septiembre que ya pasó) y algunas que siguen abiertas de
> verdad — esas últimas están además en `docs/PLAN_DESARROLLO.md` §4 para no tener dos listas.

**Fecha de corte: 2026-09-09.** Versión del aplicativo: 0.9.0.

### Hecho

- Análisis completo del instrumento (`docs/ANALISIS_INSTRUMENTO_PRESUPUESTAL.md`).
- Catálogo generado y verificado: 975 sedes, 26 municipios con alcalde y correo institucional,
  161 I.E. con rector y contacto. Cruce con el Directorio 2026 por municipio + nombre: 154 exactos y
  7 por similitud de tokens, los 7 verificados uno por uno.
- **Fase 1 funcionando.** Tablero municipal con tamizaje pre-marcado, confirmación masiva de las
  tipo 5, formulario de las secciones 1 a 4 con tabla de presupuesto repetible, catálogos cerrados,
  cálculo automático, fotografías con reducción en el navegador, detección de discrepancias,
  validaciones, borradores y versionado.
- **Fase 2 funcionando.** Consola de la Secretaría: panorama general, contraste contra el modelo,
  filtros, sección 5 de verificación con firma electrónica simple, importación de paquetes `.json`
  y exportación a CSV para Excel.
- **PDF del formato oficial**, generado sin librerías externas mediante iframe e impresión del
  navegador. Reproduce las cinco secciones, incluidas las casillas marcadas y las firmas.

Pruebas ejecutadas sobre el navegador, todas en verde:

| Prueba | Resultado |
|---|---|
| Cálculo A/U/IVA/total contra valores esperados | exacto |
| Alerta cuando A > 12 % o U > 8 % (alerta, no bloqueo) | aparece |
| Validación: sin descripción, sin foto ni plazo no radica | bloquea |
| Radicación completa con 2 ítems | `SED-PRE-117446000068-v1` |
| Confirmación masiva de pre-marcadas tipo 5 (Marulanda) | 4 de 4 |
| Discrepancia: declarar afectación en una tipo 5 | exige justificación |
| Riosucio, 92 sedes | 92 filas en 6 ms |
| `valor_modelo` ausente del catálogo público | sin fuga |
| Consola: contraste costo directo vs modelo | calcula |
| Verificación sin resultado, nombre o cédula | bloquea |
| Verificación guardada y reflejada en el PDF | casilla marcada y firma |
| CSV con separador `;` y BOM `EF BB BF` | correcto para Excel español |
| Importar paquete con versión superior / repetida | acepta / rechaza |

Servidor de pruebas: `python tools/servir.py` (sirve `web/` sin caché). Los tokens están en
`data/privado/tokens.json`.

- **Opción A′ montada de punta a punta** (D-10). `BACKEND: 'archivo'`, validación de token,
  paquetes `.json` y la consola importando los dos formatos que produce el aplicativo.
- **26 enlaces generados** con token por municipio (`enlaces_alcaldias.csv`).
- **Instructivo de una página** para las alcaldías, en Word.
- **Material para la presentación al jefe**: `docs/GUION_DEMOSTRACION.md` (guion de 12 minutos con
  las preguntas previsibles y sus respuestas), `docs/RESUMEN EJECUTIVO - Instrumento
  presupuestal.docx` (una página con estado, costo, hallazgos de calidad y lo que se solicita
  autorizar), y `tools/gen_demo.py`, que genera en `docs/demo/` la recolección completa de Marulanda
  con sedes y valores del modelo reales: 8 presupuestos, 3 declaraciones, 1 discrepancia y
  desviación de +21,8 %.
- **Automatización especificada de punta a punta** (`docs/AUTOMATIZACION_TABLERO.md`): flujo de
  Power Automate con conectores estándar, acción por acción y con las expresiones exactas, más las
  medidas DAX del tablero. `tools/gen_esquema_flujo.py` genera el esquema para «Analizar JSON», los
  paquetes de ejemplo para probar sin esperar a un alcalde, y el CSV con las 64 columnas de las tres
  listas. Se generan desde el mismo código que arma los paquetes, así que no se desincronizan.
- **Proyecto reestructurado** con separación por responsabilidad: `web/` publicable, `tools/`
  de construcción, `data/` con lo generado y lo privado separados, `docs/`. Rutas centralizadas en
  `tools/rutas.py`; ningún script trae rutas absolutas. Verificado que el pipeline completo y las
  dos pantallas siguen funcionando tras el movimiento.

Correcciones hechas sobre defectos detectados al probar:

| Defecto | Corrección |
|---|---|
| `valor_modelo` viajaba al navegador del alcalde, contra D-6 | catálogo partido en `data.js` / `data-sed.js` |
| Municipios guardados sin tildes (`PACORA`, `SAMANÁ`) | `norm_vis()` conserva tildes; `norm()` solo cruza (D-11) |
| Confirmar 30 sedes sin afectación disparaba 30 descargas | solo las sedes con presupuesto generan paquete propio; las declaraciones salen en uno solo |
| Fotos en base64 en `localStorage` reventarían la cuota | se persisten nombre y tipo; el base64 va en el paquete |
| Navegadores servían JS cacheado | `?v=` en todos los recursos |
| **Borradores con fotos reventaban la cuota del navegador.** Medido en Riosucio: 58 sedes con 3 fotos = 49 MB, y **10 borradores se perdieron sin que el bucle viera error alguno** (la excepción se atrapaba dentro). El alcalde habría creído que guardó | `guardarBorrador` ya no persiste el contenido de las imágenes, solo el nombre. Riosucio: 58 de 58, 0,03 MB |
| **Descargaba un archivo por cada sede radicada.** En Riosucio eran 58 archivos y 58 cargas separadas a SharePoint | Nada se descarga al radicar. El tablero tiene **«Enviar a la Secretaría»**: agrupa lo pendiente, descarga las declaraciones sin afectación en un solo archivo más uno por sede con presupuesto, marca lo entregado y abre la carpeta de destino. Riosucio con 33 sedes: 4 archivos |
| **Las fotografías no se veían en la consola.** El paquete las lleva como `contenido_b64` (base64 sin prefijo, que es lo que necesita SharePoint) y la consola las buscaba en `datos` (data URI). Nunca coincidían | `almacen.normalizar()` traduce entre los dos formatos al importar. Además las imágenes pasaron de `localStorage` a **IndexedDB**, que sí tiene espacio: ahora las fotos sobreviven al reabrir una sede y `localStorage` bajó a 2 KB |
| **Las secciones 3.1 y 4 tampoco se entendían.** Los campos de Administración y Utilidad no decían qué son ni qué porcentaje es razonable, y el plazo no aclaraba si incluye el tiempo de contratación | Guía con qué cubre cada concepto y la referencia de mercado (A 10 %, U 5 %), aclarando que no hay tope legal y que el municipio debe sustentarlos. El plazo aclara que son los días de ejecución una vez contratada. Ejemplo de cronograma en el campo de actividades |
| **La tabla de presupuesto no se entendía.** La columna se llamaba «Actividad / descripción», así que el usuario describía el daño («se cayó la cocina») en vez del trabajo, y no había pista de qué hacer cuando no se puede medir en metros. Detectado por el propio practicante al usarlo | Columna renombrada a «Trabajo a ejecutar», guía con los dos modos —medible y global— y ejemplo numérico completo de cada uno. La unidad `gl` con cantidad 1 es la salida para lo que no se puede desglosar. Mismo texto llevado al instructivo de las alcaldías |
| **La desviación global sumaba sedes sin base de comparación.** Las tipo 1-4 sin detalle de daños y las tipo 5-6-7 tienen `valor_modelo` en cero: incluirlas en el denominador hacía parecer sobrecosto lo que es ausencia de base. En la demostración inflaba +21,8 % a +44 % | `consola.resumen()` calcula la desviación solo sobre las sedes con valor del modelo, y la interfaz declara cuántas quedan fuera y por cuánto |
| **Los campos numéricos rechazaban el formato colombiano.** `<input type="number">` vaciaba el campo ante `1.500.000` y el sistema calculaba **0 sin avisar**. Cualquier alcalde escribe así | Campos de texto con `inputmode="decimal"` y parseo que entiende `1.500.000`, `1.500,50` y `$ 1.200.000`. Se reformatea al salir del campo para que el usuario confirme que se entendió lo mismo |
| **Al reabrir una sede ya radicada, las fotos salían rotas y se podía re-radicar con `contenido_b64` vacío**: el flujo habría creado archivos vacíos en SharePoint y la validación lo dejaba pasar porque contaba entradas, no contenido | Las fotos sin contenido se muestran como marcador «vuelva a adjuntar», no cuentan para la validación y no se envían. El PDF tampoco las incrusta |
| El paquete no llevaba el campo `version`, solo embebido en el texto del radicado: el flujo no habría podido descartar reenvíos | `version` viaja explícito y `guardarRegistro` respeta la que llega en vez de volver a incrementarla |

- **Consolidación automática** (D-15): `tools/consolidar.py` produce el Excel con avance por
  municipio, un registro por sede, actividades, pendientes y las fotos extraídas;
  `tools/vigilar.py` lo rehace solo cuando OneDrive sincroniza un paquete nuevo. Probado: al copiar
  un `.json` a la carpeta vigilada, esperó a que terminara de sincronizar y pasó de 10 a 11
  registros sin intervención.
- **Diseño y plan de desarrollo del sistema nuevo (D-17), documentados** (2026-09-15):
  `docs/diseno/` — un archivo por fase (`DISENO_00` índice, `DISENO_01` a `DISENO_05`), cada uno con
  forma y construcción juntas: pantallas, tokens, archivos a tocar, qué se reutiliza sin reescribir,
  checklist de cierre. Rompe con el azul genérico actual (paleta y tipografía del logo real en
  `DISENO_01_SISTEMA_VISUAL.md`). Orden: fase 0 sistema visual → fase 1 módulo Inicio → fase 2
  módulo Presupuesto → fase 3 módulo Ingesta (bloqueada por Q-10) → fase 4 módulo Monitoreo
  (aplazada, Q-14). Ningún módulo se ha construido todavía; esto es solo el diseño y el plan.

### Falta para poner esto en producción

1. **Carpeta de entrega compartida con las alcaldías** (Q-2). Sirve OneDrive de la cuenta
   institucional para arrancar; el sitio de SharePoint es el destino. Es lo único que bloquea.
1b. **Decidir Q-9** (correos y celulares de rectores en el catálogo público) antes de publicar.
2. Montar el flujo siguiendo `docs/AUTOMATIZACION_TABLERO.md`. Ya está especificado; falta
   construirlo en el tenant. Mientras no exista, la consola importa los paquetes a mano y el
   circuito funciona igual.
3. Publicar el sitio y ajustar `URL_BASE` en `tools/rutas.py` (hoy
   `https://sedcaldas.github.io/presupuesto-sedes/`), luego regenerar los enlaces.
4. Correo automático de confirmación con el número de radicado.
5. Confirmar con Planeación el mapa resultado de verificación → estado
   (`consola.ESTADO_SEGUN_RESULTADO`): hoy «corresponde parcialmente» aprueba, y eso es un supuesto.

### 8.1 Backend — Premium descartado

**La Gobernación no compró Power Automate Premium**, así que el disparador «Cuando se recibe una
solicitud HTTP» no está disponible. **D-1 queda anulada.** Tres caminos, ninguno requiere comprar
licencias de Power Platform:

**OneDrive por sí solo no sirve.** Un sitio estático no puede escribir en OneDrive ni SharePoint sin
una credencial, y una credencial en el navegador queda a la vista de cualquiera. Siempre tiene que
haber algo del lado del servidor que guarde el secreto.

| Opción | Cómo funciona | Costo | Requiere | Fricción para el alcalde |
|---|---|---|---|---|
| **A′. Carpeta compartida + flujo gratuito** | El aplicativo genera un `.json` por sede; el alcalde lo sube a una carpeta de SharePoint compartida **con su correo como «persona específica, puede editar»**. Entra verificando su correo con un código de un solo uso. Un flujo de Power Automate con el disparador «cuando se crea un archivo» —**conector estándar, gratis**— lo parsea y escribe en las listas | $0 | Uso compartido externo con personas concretas: **confirmado** (D-9) | Verificación por código la primera vez, más subir el archivo |
| **B. Azure Logic Apps (consumo)** | Mismo disparador HTTP y mismo conector de SharePoint que Power Automate, pero facturado por ejecución en vez de por licencia. El aplicativo envía directo | centavos | Suscripción de Azure | Ninguna |
| **C. Función intermedia + Microsoft Graph** | Cloudflare Worker o Azure Function guarda el secreto y escribe con permiso `Sites.Selected`, acotado a un solo sitio | $0 | Registro de app en Entra ID y consentimiento de admin | Ninguna |

**Sobre A′ frente a la opción A original:** se planteó primero un enlace de *solicitud de archivos*
anónimo, pero eso exige el tipo de uso compartido «cualquier persona con el vínculo», que no está
confirmado. Compartir con personas concretas sí está permitido (D-9), así que A′ lo reemplaza. Es
además **más auditable**: queda registro de qué cuenta subió cada archivo, cosa que el enlace
anónimo no da.

`api.js` ya implementa los tres: modo `archivo` (opción A′), modo `http` (opciones B y C) y modo
`local`. Cambiar de camino es cambiar `BACKEND` y `ENDPOINT_URL` en `config.js`. La consola ya
importa los paquetes `.json`, así que A′ funciona de punta a punta incluso antes de montar el flujo.

**Recomendación: A′ para la prueba del viernes, B o C para producción.** A′ no depende de compras ni
de registros en Entra ID y se puede tener andando mañana.

**Nota 2026-09-15:** esta sección (§8.1) documenta la exploración de backend para el sistema
**viejo**, orientado al alcalde. El sistema **nuevo** (D-17) usa Google Apps Script — ver **D-19 a
D-23** en §2. Se deja esta sección tal cual, como registro de por qué se descartaron Logic Apps y
Functions, no porque siga siendo el camino vigente.

### Pendientes

| # | Pendiente |
|---|---|
| ~~Q-1~~ | ~~Elegir backend~~ → **resuelto: opción A′ (D-10) para el sistema viejo; D-19 para el nuevo** |
| ~~Q-2~~ | ~~Sitio de SharePoint destino, carpetas por alcaldía~~ → **superada por D-19**: el sistema nuevo no usa SharePoint |
| Q-3 | Aval de Planeación a los umbrales de alerta A > 12 % y U > 8 %. **Con evidencia desde 2026-09-16:** Aguadas y Aranzazu radican con **A 25 % · I 0 % · U 5 %**, el doble del umbral. La alerta saltará en casi todo lo que llegue de esos dos municipios. Ya no es una pregunta teórica |
| Q-4 | ¿Se agregan campos que el formato no pide? (profesional que elabora, obra en curso, cofinanciación) |
| ~~Q-5~~ | ~~¿Se publica bajo la organización `sedcaldas` en GitHub?~~ → **resuelto 2026-09-16**: repo propio del practicante, `github.com/Jostrel19/reconstruccion-sedes`, público. Esa organización resultó ser la cuenta personal de otro funcionario, no una cuenta institucional |
| ~~Q-6~~ | ~~Municipios destinatarios de la prueba del viernes 11~~ → **vencida**, esa fecha (sep. 2026) ya pasó y el plan de pruebas cambió con D-17 |
| Q-7 | Confirmar con Planeación el mapa resultado de verificación → estado. Mientras tanto rige la regla conservadora **D-22** |
| ~~Q-8~~ | ~~Al montar el flujo, verificar que el disparador quede sin carpeta fija~~ → **superada por D-19**: no hay flujo de Power Automate que montar |
| **Q-10** | **Un Excel real de los que están mandando las alcaldías** (dos o tres si difieren entre sí). **Bloqueante duro del rediseño:** sin ver la estructura real, cualquier lector que se escriba es adivinación, y adivinar aquí es meter cifras mal leídas en un consolidado oficial |
| ~~Q-11~~ | ~~¿El aplicativo de los alcaldes se retira?~~ → **RESUELTO 2026-09-09: se retira (D-18)** |
| Q-12 | «El catálogo que próximamente se subirá»: ¿catálogo de sedes actualizado, o catálogo de precios unitarios para validar los presupuestos? Son diseños distintos |
| Q-13 | **Logo oficial de la Gobernación** (PNG/SVG) y manual de identidad. No está en la carpeta de trabajo ni embebido en los `.docx` oficiales; verificado |
| Q-14 | Datos del contrato o mecanismo de ejecución, para el módulo de monitoreo |
| ~~Q-9~~ | ~~Correos y celulares en el catálogo público~~ → **RESUELTO 2026-09-09:** repositorio puesto en privado (D-18). Ya no es público |

**Resuelto:** Q-7 anterior sobre enlaces «cualquier persona» → reemplazado por D-9 y la opción A′.

---

## 9. Protocolo de actualización

Al cerrar cada avance, actualizar en este archivo:

1. **§2** si se cierra una decisión nueva — con número `D-n`, sin borrar las anteriores.
2. **§3** si aparece una regla o un hallazgo de datos.
3. **§5** si cambia la arquitectura o la estructura de archivos.
4. **§8** siempre: qué quedó hecho, qué bloquea, qué queda pendiente, y la fecha de corte.

Regla: las decisiones cerradas no se reproponen salvo evidencia nueva o cambio de contexto.
