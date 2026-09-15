# Análisis y plan del instrumento de recolección presupuestal

**Objeto:** convertir el «INFORME TÉCNICO PRESUPUESTAL para municipios.docx» en un aplicativo web
que los municipios diligencien sede por sede, con los registros consolidados en SharePoint de la SED.

**Referencia de arquitectura:** https://sedcaldas.github.io/circular122/ (planes de contingencia,
Circular 122 del 24-08-2026), desarrollado por un funcionario de la Secretaría.

Fecha: 08-09-2026. Corte de datos: censo 08-09-2026.

---

## 0. Decisiones tomadas

| # | Decisión | Definición |
|---|---|---|
| D-1 | Backend | **Power Automate Premium** (disparador HTTP) → lista de SharePoint + biblioteca de documentos |
| D-2 | Quién diligencia | **El alcalde**, por todas las sedes de su municipio |
| D-3 | Universo | **Las 975 sedes oficiales**, menos las que el municipio declare sin afectación |
| D-4 | Tamizaje | Las sedes llegan **pre-marcadas según el censo**; el alcalde confirma o corrige |
| D-5 | Fórmula AU | **A y U por separado**, sin imprevistos, **con IVA del 19 % sobre la utilidad** |
| D-6 | Referencia mostrada | **Tipo y nivel de afectación del censo**, sin el valor en pesos del modelo |
| D-7 | Adjuntos | **Registro fotográfico** por sede afectada. El certificado de la UNGRD municipal **no se exige** |
| D-8 | Cierre de recolección | **Viernes 11 de septiembre de 2026**, en modalidad de **prueba** |

Pendientes en §7.

---

## 1. Qué es realmente este instrumento

No es una encuesta. Es **la contrapartida municipal del modelo paramétrico** producido por la
Dirección de Planeación el 08-09-2026 (`ESTIMACION COSTOS RECONSTRUCCION SEDES OFICIALES
08_09_2026.xlsx`, total estimado **$23.348.062.500** sobre 456 sedes valoradas).

El oficio de ese estudio dice textualmente que es una *estimación paramétrica de orden de magnitud*
que **«no constituye presupuesto de obra y no sustituye el levantamiento de cantidades ni los
análisis de precios unitarios por sede»**.

Este instrumento es ese levantamiento. De ahí el criterio rector del diseño:

> El aplicativo debe producir un dato **comparable, sede por sede, contra el valor del modelo**.
> Si el municipio digita en texto libre, el cruce es imposible y la cifra no se puede sustentar ante
> el MEN, la UNGRD ni Hacienda.

Con D-6, ese contraste queda **ciego para el municipio y visible para la SED**: el alcalde ve el
tipo y nivel de afectación pero no el valor estimado, de modo que su presupuesto es una segunda
medición independiente. Donde ambas cifras converjan, el modelo queda validado; donde diverjan, la
diferencia es información real y no ruido de anclaje.

---

## 2. Universo y carga real

Con D-3 el aplicativo ya no muestra 554 sedes sino **975**. La carga por municipio cambia
sustancialmente:

| Municipio | Sedes totales | Tipo 1-4 | Tipo 5-6-7 | I.E. |
|---|---:|---:|---:|---:|
| RIOSUCIO | 92 | 58 | 34 | 16 |
| PENSILVANIA | 85 | 27 | 58 | 10 |
| SAMANÁ | 81 | 43 | 38 | 9 |
| ANSERMA | 65 | 40 | 25 | 10 |
| AGUADAS | 61 | 53 | 8 | 10 |
| NEIRA | 49 | 2 | 47 | 8 |
| MANZANARES | 46 | 33 | 13 | 7 |
| SUPÍA | 45 | 28 | 17 | 6 |
| MARQUETALIA | 44 | 30 | 14 | 6 |
| PÁCORA | 36 | 22 | 14 | 8 |
| SALAMINA | 35 | 21 | 14 | 7 |
| VILLAMARÍA | 34 | 16 | 18 | 9 |
| CHINCHINÁ | 32 | 14 | 18 | 7 |
| FILADELFIA | 32 | 8 | 24 | 3 |
| BELALCÁZAR | 30 | 25 | 5 | 4 |
| ARANZAZU | 30 | 30 | 0 | 4 |
| RISARALDA | 28 | 18 | 10 | 4 |
| LA DORADA | 25 | 22 | 3 | 9 |
| VICTORIA | 24 | 12 | 12 | 3 |
| NORCASIA | 17 | 11 | 6 | 2 |
| PALESTINA | 16 | 10 | 6 | 5 |
| VITERBO | 16 | 0 | 16 | 3 |
| MARMATO | 16 | 10 | 6 | 5 |
| SAN JOSÉ | 13 | 5 | 8 | 2 |
| LA MERCED | 12 | 10 | 2 | 3 |
| MARULANDA | 11 | 6 | 5 | 2 |
| **TOTAL** | **975** | **554** | **421** | **162** |

Composición del universo por tipo de afectación del censo:

| Tipo | Descripción | Sedes | Tratamiento en el aplicativo (D-4) |
|---|---|---:|---|
| 1 | Colapso total o parcial | 8 | Abierta para presupuesto |
| 2 | Riesgo inminente de colapso | 20 | Abierta para presupuesto |
| 3 | Afectaciones estructurales / funcionales parciales | 140 | Abierta para presupuesto |
| 4 | Afectaciones menores | 386 | Abierta para presupuesto |
| 5 | Sin afectación | 271 | **Pre-marcada «sin afectación»**, solo confirmar |
| 6 | No es posible determinar | 15 | En blanco, requiere declaración expresa |
| 7 | Sin revisar | 135 | En blanco, requiere declaración expresa |

**El efecto de D-4 sobre la carga:** de las 975 sedes, 271 llegan resueltas por defecto. El alcalde
de Riosucio no enfrenta 92 formularios: enfrenta una lista de 92 filas donde confirma con un clic
las que no tienen afectación y abre el formulario presupuestal solo en las que sí. Pensilvania es
el caso más favorable (58 de sus 85 sedes son tipo 5-6-7) y Aguadas el más exigente (53 de 61 son
tipo 1-4).

**Riesgo residual:** las 135 sedes tipo 7 «sin revisar» y las 15 tipo 6 «no determinable» llegan en
blanco y obligan al municipio a pronunciarse sin concepto técnico previo. Se concentran en
Pensilvania, Neira, Filadelfia y Viterbo. Conviene advertirlo en el instructivo.

---

## 3. Diseño sección por sección

### Estructura general: dos pantallas, no una

El instrumento no puede ser un formulario lineal. Son dos momentos:

1. **Tablero del municipio** — lista de las N sedes con su tipo y nivel de afectación, estado
   (pendiente / sin afectación / en diligenciamiento / radicada), y avance del municipio. Es la
   pantalla de trabajo del alcalde.
2. **Formulario presupuestal** — se abre por sede y reproduce las secciones 1 a 4 del formato.

### Sección 1 — Datos de identificación

| Campo | Tratamiento | Fuente |
|---|---|---|
| Municipio | Fijado por el enlace con token | catálogo |
| Institución Educativa | Heredado de la sede | `fctMaestra` |
| Sede Educativa | Seleccionada en el tablero | `fctMaestra` |
| Código DANE | **Autocompletado, solo lectura** | `fctMaestra`, DANE SEDE 12 díg. |
| Alcalde | Precargado desde el token; editable | *pendiente Q-3* |
| Rector(a) | **Precargado** desde el Directorio de I.E. 2026; editable | Directorio 2026 |
| Contacto | Correo y celular precargados; editables y validados | Directorio 2026 |
| Fecha de emisión | Automática, sello del servidor | sistema |

**Regla dura:** el DANE SEDE nunca se digita. Es la llave de cruce con `fctMaestra` y con el modelo
paramétrico; un DANE mal digitado convierte el registro en huérfano y rompe toda la cadena
(estimación → presupuesto municipal → verificación → consolidado).

**Advertencia sobre el Directorio de I.E. 2026:** su columna DANE **está desplazada** — a la
I.E. Escuela Normal Superior Claudina Munera le figura el DANE de Roberto Peláez. El cruce para
precargar rector y contacto debe hacerse por **municipio + nombre de I.E.**, nunca por DANE, y hay
que revisar manualmente los casos de nombre ambiguo.

### Sección 2 — Necesidad y grado de afectación

Con D-4 y D-6, el bloque queda así:

- **Tipo y nivel de afectación del censo:** mostrados en solo lectura, como contexto.
- **Declaración del municipio:** ¿la sede presenta afectación? Sí / No. Es el tamizaje de D-3.
  Pre-marcado en «No» para las 271 tipo 5; en blanco para el resto.
- **Discrepancia:** si el municipio declara afectación en una sede tipo 5, o declara sin afectación
  en una tipo 1-4, el sistema lo registra como discrepancia con el censo y exige justificación.
  No lo bloquea — lo marca. La SED decide en la verificación.
- **Descripción de la afectación y necesidad de inversión:** texto libre con mínimo y máximo. Hoy en
  el Word son tres renglones en blanco y llegará cualquier cosa.
- **Registro fotográfico** (D-7): obligatorio para toda sede declarada con afectación.

Esta discrepancia declarada es, en sí misma, un producto valioso: es la vía por la que las 135 sedes
tipo 7 «sin revisar» y las 39 sedes con daños marcados pero clasificadas 5-6-7 entran al radar.

### Sección 3 — Presupuesto detallado y discriminado

Tabla repetible: `Ítem · Actividad/Descripción · Unidad de medida · Cantidad · Valor unitario ·
Valor total`, con fila TOTAL.

Consecuencias técnicas:

1. **Es una sección repetible con cálculo.** Esto por sí solo **descarta Microsoft Forms y Google
   Forms**: ninguno soporta tablas dinámicas de N filas ni operaciones entre campos. Cualquier
   evaluación de herramientas empieza y termina aquí.
2. `Valor total = Cantidad × Valor unitario`, y el TOTAL se calcula solo. Nunca digitados. En el
   formato Word los tres se digitan y no cuadran; es la primera causa de devolución.
3. **Unidad de medida en catálogo cerrado** (m², m³, ml, un, gl, kg, día, mes…). En texto libre
   llegarán «metros», «mt2», «M2» y «metro cuadrado», y consolidar cientos de sedes se vuelve
   trabajo manual de días.
4. **Capítulo de daño en catálogo cerrado.** Cada fila se clasifica en uno de los 11 ítems que ya
   usa el modelo (estructural, mampostería y muros, cubierta, cimentación y terreno, elementos no
   estructurales, acabados, instalaciones, unidades sanitarias, cocina y restaurante escolar,
   elementos exteriores, deficiencia constructiva) y la descripción libre queda como detalle dentro
   del capítulo. Es lo que permite comparar peso a peso lo presupuestado contra lo estimado, por
   ítem y no solo por total.

### Sección 3.1 — Resumen económico

Con D-5, la fórmula queda:

```
Costo directo      = Σ (cantidad × valor unitario) de la sección 3     [calculado]
Administración     = Costo directo × A%                                 [A% digitado]
Utilidad           = Costo directo × U%                                 [U% digitado]
IVA sobre utilidad = Utilidad × 19%                                     [calculado]
TOTAL PRESUPUESTO  = Costo directo + Administración + Utilidad + IVA sobre utilidad
```

Notas:

- Se capturan **A y U por separado**, sin imprevistos. El formato dice «AU (%)» en un solo campo;
  se desglosa para poder validar cada componente.
- El IVA del 19 % sobre la utilidad **tiene respaldo normativo expreso**: el artículo 3 del Decreto
  1372 de 1992 establece que en los contratos de construcción de bien inmueble el IVA se genera
  sobre los honorarios del constructor y, si no se pactan honorarios, **sobre la utilidad**, porción
  que «en ningún caso podrá ser inferior a la que comercialmente corresponda a contratos iguales o
  similares». La decisión D-5 es por tanto la correcta para este instrumento.

**Sobre los topes de A % y U % — hallazgo:**

**No existe un tope legal nacional para el AIU en Colombia.** Colombia Compra Eficiente ha sostenido
que el AIU no está definido en la ley, que no hay obligación legal de usarlo ni una forma única de
estructurarlo, y que **cada entidad estatal es autónoma** para determinarlo dentro de su modelo
financiero, con el límite del principio de planeación y del estudio de sector y mercado.

Lo que existe es **práctica de mercado**, no norma:

| Componente | Referencia usual de mercado |
|---|---|
| Administración | ~10 % del costo directo |
| Imprevistos | ~5 % *(no aplica aquí por D-5)* |
| Utilidad | ~5 % |
| AIU total | 20 % a 30 % del costo directo |

Sin la «I», la referencia de mercado equivalente es **A 10 % + U 5 % ≈ 15 %**.

**Propuesta:** dado que no hay tope legal que invocar, el aplicativo no debe bloquear sino
**alertar**. Se sugiere parametrizar desde la consola de administración un umbral de alerta en
**A > 12 %** y **U > 8 %**, que marca el registro para revisión del verificador sin impedir la
radicación. Estos umbrales son un criterio de negocio: **requieren aval de la Dirección de
Planeación** antes de publicarse, y quedan configurables para poder ajustarlos sin tocar el código.
- El formato tiene **dos totales con nombres casi iguales**: «VALOR TOTAL REQUERIDO PARA LA SEDE» al
  cierre de la sección 3 (costo directo, sin AU) y «VALOR TOTAL REQUERIDO PARA LA OBRA» al cierre de
  3.1 (con AU e IVA). Deben quedar rotulados sin ambigüedad y ambos calculados por el sistema.

**Advertencia para la lectura de resultados:** el oficio del 08-09-2026 dice expresamente que el
modelo paramétrico **no incluye AIU, interventoría, estudios y diseños, demoliciones especializadas
ni IVA**. Por construcción, los presupuestos municipales llegarán **por encima** del modelo. Esa
diferencia es esperada, no un error, y el tablero de la SED debe compararlos contra el **costo
directo** —no contra el total con AU— para que el contraste sea legítimo.

### Sección 4 — Plazo de ejecución / cronograma

El formato pide «indicar las actividades previstas y el plazo» pero **no incluye tabla alguna**:
solo una línea para el plazo total. Es un vacío del documento, no una simplificación.

Propuesta: plazo total en **días calendario** (numérico, para poder ordenar y programar) más una
lista corta de actividades con duración. Sin fechas absolutas: nadie sabe cuándo se adjudica y una
fecha de inicio inventada envejece mal.

### Sección 5 — Observaciones de verificación

**No la diligencia el municipio: la diligencia la Secretaría.** Obliga a dos roles y dos momentos,
exactamente como circular122:

| Rol | Acción |
|---|---|
| Alcalde (municipio) | Tamiza sus sedes y radica el presupuesto de las afectadas |
| Verificador SED (Planeación) | Marca *Corresponde · Corresponde parcialmente · No corresponde · Requiere aclaración*, observa, devuelve o aprueba |
| Administrador SED | Consulta, exporta, gestiona catálogos, tokens y parámetros |

El cierre pide `Nombre / Firma / C.C.` del verificador: se resuelve con firma electrónica simple
(nombre, cédula, fecha, hora y sello del sistema) impresa en el PDF generado.

### Lo que el formato no pide y conviene evaluar

Señalado sin agregarlo por cuenta propia:

1. **Profesional que elabora el presupuesto** — nombre y matrícula profesional de ingeniero o
   arquitecto. Es lo usual en presupuesto de obra pública y hoy no se pide.
2. **Obra en curso o sede ya intervenida** — sin este campo se puede presupuestar dos veces la
   misma sede.
3. **Fuente de recursos / cofinanciación** — si el municipio aporta parte, cambia la cifra que la
   SED debe gestionar.
4. **Certificado de la UNGRD municipal** — la sección 5 dice que se contrastará contra *«los
   certificados con los conceptos emitidos por cada alcaldía municipal a través de la unidad de
   gestión del riesgo»*. Con D-7 solo se pide registro fotográfico; queda por confirmar si ese
   certificado ya lo tiene la SED o debe adjuntarse.

---

## 4. Arquitectura

### Decisión (D-1)

```
Alcalde (navegador, sin cuenta Microsoft)
   │
   ├── Sitio estático  ─  GitHub Pages, org sedcaldas
   │     HTML/CSS/JS sin framework, patrón circular122
   │     data.js = catálogo de 975 sedes + 162 I.E. + rectores
   │     api.js  = cliente desacoplado del backend
   │
   ▼  POST JSON
Power Automate  ─  disparador «Cuando se recibe una solicitud HTTP» (Premium)
   │
   ├──► Lista SharePoint  «PresupuestosSedes»       (un registro por sede y versión)
   ├──► Lista SharePoint  «ItemsPresupuesto»        (filas de la sección 3)
   ├──► Biblioteca        «SoportesFotograficos»    (D-7, carpeta por DANE SEDE)
   └──► Correo de confirmación con número de radicado
         │
         ▼
   Power BI  ─  conectado directo a las listas
```

Por qué este camino:

- **Frontend estático:** costo cero, sin servidor que mantener, el funcionario que hizo circular122
  ya conoce el código, y la URL vive en un dominio que los municipios ya recibieron y reconocen.
- **Power Automate:** 100 % Microsoft, sin código de servidor y sin secretos en el navegador. El
  dato entra directo al SharePoint de la SED, que queda como repositorio primario y no como copia.
- **`api.js` desacoplado:** el frontend se puede construir y probar **antes** de que el flujo de
  Power Automate esté listo. Cambiar de backend es reemplazar una URL.

### Modelo de datos

**Lista `PresupuestosSedes`** — una fila por sede radicada:

`id_radicado · dane_sede (llave) · municipio · dane_ie · institucion · sede · zona · matricula ·
tipo_censo · nivel_censo · declara_afectacion · hay_discrepancia · justificacion_discrepancia ·
descripcion_afectacion · alcalde · rector · correo · celular · costo_directo · pct_admin ·
pct_utilidad · valor_admin · valor_utilidad · valor_iva · total_presupuesto · plazo_dias ·
estado · version · fecha_radicacion · verificador · resultado_verificacion ·
observaciones_verificacion · fecha_verificacion`

**Lista `ItemsPresupuesto`** — N filas por radicado: `id_radicado · n_item · capitulo_dano ·
descripcion · unidad · cantidad · valor_unitario · valor_total`.

Reglas: un registro vigente por DANE SEDE; **versionado en lugar de sobrescritura** (si el
municipio vuelve a enviar, queda v2 y la v1 se conserva); todo cambio de estado queda con usuario,
fecha y hora.

### Control de acceso sin cuentas Microsoft

Los alcaldes no tienen cuenta en el tenant, así que no puede exigirse inicio de sesión Microsoft.
La trazabilidad se resuelve con **enlace con token por municipio**: cada alcaldía recibe una URL
propia (`?m=RIOSUCIO&t=<token>`) que abre el tablero ya filtrado a sus sedes.

No es autenticación fuerte, pero impide que un municipio diligencie por otro, deja trazabilidad de
quién radicó qué, y es más control del que hoy tiene circular122 (que entra libre y solo pide
correo). Se complementa con correo automático de confirmación, número de radicado y PDF del formato
diligenciado.

---

## 5. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R-1 | DANE mal digitado deja el registro huérfano | DANE no digitable; solo selección desde catálogo |
| R-2 | El municipio declara afectación donde el censo dice tipo 5 | Se registra como discrepancia con justificación obligatoria; decide la SED |
| R-3 | Riosucio (92), Pensilvania (85) y Samaná (81) no alcanzan a completar | Pre-marcado D-4, guardado parcial, tablero de avance, priorización de tipo 1-2 |
| R-4 | 135 sedes tipo 7 «sin revisar» llegan sin concepto técnico | Declaración expresa obligatoria + registro fotográfico; advertencia en el instructivo |
| R-5 | Presupuestos inflados frente al modelo | Contraste automático contra el valor estimado en la consola SED, comparando **costo directo** |
| R-6 | Unidades y capítulos en texto libre impiden consolidar | Catálogos cerrados en ambos campos |
| R-7 | Directorio de I.E. 2026 con columna DANE desplazada | Cruce por municipio + nombre; revisión manual de nombres ambiguos |
| R-8 | Datos personales de rectores y alcaldes (Ley 1581 de 2012) | Aviso de tratamiento de datos; SharePoint con permisos restringidos |
| R-9 | Licencia Power Automate Premium no disponible o sin administrador | Verificar antes de Fase 1; `api.js` desacoplado permite cambiar de backend sin reescribir |
| R-10 | Fotografías pesadas saturan la biblioteca | Límite de tamaño y número por sede; compresión en el navegador antes de subir |

---

## 6. Plan por fases

Tiempos con dedicación continua y las definiciones de §7 resueltas.

### Fase 0 — Habilitación (bloqueante, ½ día)

- Confirmar licencia Power Automate Premium y quién la administra.
- Crear o identificar el sitio de SharePoint destino y las dos listas + la biblioteca.
- Conseguir el directorio de alcaldes con correo (hoy **no lo tenemos en ningún archivo**).
- Resolver las preguntas abiertas de §7.

**Entregable:** endpoint de Power Automate operativo y listas creadas.

### Fase 1 — Tablero municipal y formulario (1 a 2 días)

- Catálogo de 975 sedes / 162 I.E. extraído de `fctMaestra` y del anexo de estimación, cruzado por
  DANE SEDE, más rector y contacto del Directorio 2026 cruzado por municipio + nombre.
- Tablero por municipio con tamizaje pre-marcado (D-4) y guardado parcial.
- Formulario presupuestal, secciones 1 a 4, con cálculo automático (D-5), catálogos cerrados y
  carga de fotografías (D-7).
- Escritura en SharePoint vía Power Automate.
- PDF con el formato oficial diligenciado y correo de confirmación con radicado.

**Entregable:** enlace funcional para prueba con municipio piloto.
**Piloto sugerido:** Marulanda (11 sedes) o San José (13) para validar el flujo completo en minutos.
Para estresar el diseño, Riosucio (92).

### Fase 2 — Consola de la Secretaría (1 a 2 días)

- Consulta por municipio, I.E., sede, tipo de afectación y estado.
- Sección 5 de verificación con los cuatro resultados, observaciones y firma electrónica simple.
- Devolución al municipio con notificación por correo y control de versiones.
- Exportación a Excel del consolidado.
- **Columna de contraste: costo directo presupuestado por el municipio vs. valor del modelo
  paramétrico, con porcentaje de desviación.** Es lo que convierte esto en un instrumento de control
  y no en un buzón.
- **Tablero de discrepancias:** sedes donde la declaración municipal no coincide con el censo.

**Entregable:** consola operativa para Planeación.

### Fase 3 — Seguimiento (1 día)

- Power BI conectado directo a las listas de SharePoint.
- Avance por municipio (pendientes / sin afectación / radicadas / verificadas / devueltas), valor
  acumulado, desviación frente al modelo, sedes tipo 1-2 sin radicar.

**Entregable:** tablero publicado.

### Fase 4 — Cierre y consolidación

- Informe consolidado con la cifra sustentada sede por sede, sustituyendo la estimación paramétrica
  donde ya exista presupuesto verificado.
- Trazabilidad completa: qué estimó la SED, qué pidió el municipio, qué verificó Planeación, qué
  quedó en firme.

### Trabajo paralelo (no bloqueante)

Mientras se habilita el backend: extracción y validación de catálogos, maquetación del tablero y el
formulario, plantilla del PDF, e instructivo para alcaldías.

---

## 7. Pendientes

**Resueltos:** plazo de cierre (D-8); directorio de alcaldes (`Base de datos Funcionarios 2026.xlsx`,
hoja `Alcaldes`, 26 de 26 municipios con correo institucional); certificado UNGRD (no se exige, D-7);
topes de A % y U % (no existen por ley — ver §3.1, se propone alerta parametrizable).

| # | Pendiente | Por qué importa |
|---|---|---|
| **Q-1** | **Confirmar que la cuenta `data@sedcaldas.edu.co` tiene licencia Power Automate Premium.** El disparador «Cuando se recibe una solicitud HTTP» es premium; la consola de Power Automate se ve igual con y sin licencia. | Bloqueante. Sin Premium hay que cambiar de backend |
| **Q-2** | ¿Existe el sitio de SharePoint destino o hay que solicitarlo? ¿Quién lo administra? | Bloqueante. Es donde viven las listas |
| **Q-3** | Aval de Planeación a los umbrales de alerta A > 12 % y U > 8 % | Criterio de negocio, no técnico |
| **Q-4** | ¿Se agregan los campos que el formato no pide (profesional que elabora, obra en curso, cofinanciación)? | Modifica el formato oficial; requiere aval de Planeación |
| **Q-5** | ¿El aplicativo se publica bajo la organización `sedcaldas` en GitHub, junto a circular122? | Define repositorio, dominio y quién administra el despliegue |
| **Q-6** | Para la prueba del viernes 11, ¿a qué municipios se les envía el enlace? | Define el alcance de la prueba |

### Plan B si no hay licencia Premium

El disparador HTTP de Power Automate es el único componente que exige Premium. Si no está
disponible, la alternativa que menos cambia el diseño es **Azure Logic Apps (plan de consumo)**:
tiene el mismo disparador HTTP, escribe a SharePoint con el mismo conector, cuesta centavos por
ejecución y no requiere licencia de Power Automate. Exige suscripción de Azure. El frontend no
cambia: solo se reemplaza la URL en `api.js`.

---

## 8. Estado de construcción

**Catálogo generado** — `catalogo_sedes.json`, construido desde las fuentes oficiales y cruzado
por DANE SEDE:

| Contenido | Cantidad |
|---|---|
| Sedes oficiales (sin Manizales) | 975 |
| Municipios, todos con alcalde y correo institucional | 26 |
| Instituciones educativas, todas con rector y contacto | 161 |
| Pre-marcadas «sin afectación» (tipo 5) | 271 |
| Abiertas para presupuesto (tipo 1-4) | 554 |
| Requieren declaración expresa (tipos 6 y 7) | 150 |

Verificaciones realizadas sobre el catálogo:

- Las 975 sedes cruzan con el censo por DANE SEDE, sin huérfanas.
- **Las 975 están activas en el DUE** (843 `ANTIGUO-ACTIVO`, 132 `NUEVO-ACTIVO`): ninguna en cierre
  temporal ni definitivo. Todas con matrícula mayor que cero. Confirma el criterio de universo
  *oficiales + activas + con matrícula = 975*.
- El cruce con el Directorio de I.E. 2026 se hizo **por municipio + nombre** (su columna DANE está
  desplazada). 154 cruces exactos y 7 por similitud de tokens, todos verificados uno por uno:
  Marco Fidel Suárez ↔ Escuela Normal Superior Marco Fidel Suárez; Técnica Alfonso López ↔ Alfonso
  López; Renán Barco ↔ Renán Barco; Llanogrande ↔ Mixto Llanogrande; La Estrella ↔ La Quiebra (La
  Estrella); María Fabiola Largo Cano ↔ María Fabiola Largo; De La Presentación ↔ La Presentación.

**Hallazgo en `fctMaestra`:** el DANE de I.E. `117380000789` (La Dorada) tiene en el campo `I.E.` el
valor «INSTITUCIÓN EDUCATIVA RENÁN BARCO - JUAN PABLO II- SEDE PRINCIPAL», que es un nombre de sede,
no de institución. Afecta a sus dos sedes. No se corrigió el archivo maestro; se resolvió en el
cruce. Conviene reportarlo a quien administra `fctMaestra`.

---

*Elaborado por Práctica TIC — Secretaría de Educación de Caldas.
Fuentes: «INFORME TÉCNICO PRESUPUESTAL para municipios.docx»; «ESTIMACION COSTOS RECONSTRUCCION
SEDES OFICIALES 08_09_2026.xlsx»; «OFICIO - Estimacion costos reconstruccion sedes oficiales
08-09-2026.docx»; «Directorio Instituciones Educativas 2026.xlsx»; código fuente público de
https://sedcaldas.github.io/circular122/.*
