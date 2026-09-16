# Guía de montaje en SharePoint y funcionamiento del aplicativo

> **SUPERADO por D-19 (2026-09-15).** SharePoint queda fuera del backend nuevo — Apps Script
> escribe directo en Google Sheets/Drive, no hay montaje que hacer aquí. Se conserva como registro
> del sistema viejo (D-10, opción A′), retirado por D-17/D-18. Ver `CLAUDE.md` §6 y
> `docs/PLAN_DESARROLLO.md` para el backend vigente.

Secretaría de Educación de Caldas — Dirección de Planeación
Informe técnico-presupuestal por sede · sismo del 10 de agosto de 2026

Documento en dos partes: **A)** qué crear en SharePoint, **B)** cómo funciona hoy el aplicativo.

---

# PARTE A — QUÉ CREAR EN SHAREPOINT

## A.1 El sitio

Un **sitio de equipo** (Team site), no de comunicación: necesitamos permisos por carpeta.

| | |
|---|---|
| Nombre sugerido | `Presupuestos Sedes Sismo 2026` |
| Dirección | `.../sites/PresupuestosSedesSismo2026` |
| Privacidad | **Privado** |
| Idioma | Español |

Miembros: solo el equipo de la Dirección de Planeación que va a verificar. Los alcaldes **no** son
miembros del sitio — solo reciben acceso a una carpeta suya (A.3).

---

## A.2 Las tres listas

### Por qué tres y no dos

`CatalogoSedes` parece redundante pero no lo es: sin ella, el tablero de avance solo puede contar lo
que llegó y **no lo que falta**. Con las 975 sedes cargadas, Power BI puede decir «Riosucio radicó
34 de 92» y calcular la desviación contra el modelo sin depender de que el flujo la arrastre.

---

### Lista 1 — `CatalogoSedes` (975 registros, se carga una vez)

Referencia del universo. Se llena importando `catalogo_sedes.json` convertido a Excel, o pegando
desde el CSV.

| Columna | Tipo | Notas |
|---|---|---|
| `Título` | Texto | = `dane_sede`. SharePoint la exige; se aprovecha |
| `dane_sede` | Texto | **Indexada.** 12 dígitos |
| `municipio` | Elección | **Indexada.** 26 opciones |
| `dane_ie` | Texto | |
| `institucion` | Texto | |
| `sede` | Texto | |
| `zona` | Elección | `URBANA`, `RURAL` |
| `matricula` | Número entero | |
| `estado_sede` | Texto | `ANTIGUO-ACTIVO` / `NUEVO-ACTIVO` |
| `tipo_censo` | Texto | **Indexada.** «3. AFECTACIONES ESTRUCTURALES…» |
| `nivel_censo` | Texto | |
| `valor_modelo` | Moneda | Valor estimado por el modelo paramétrico |
| `orden_priorizacion` | Número entero | 1 a 554 |
| `rector` | Texto | |
| `correo_ie` | Texto | |

> **`dane_sede` debe ser Texto, nunca Número.** Como número, `117013000292` pierde precisión y los
> ceros a la izquierda desaparecen. Es la llave de todo el sistema.

---

### Lista 2 — `PresupuestosSedes` (una fila por sede radicada)

| Columna | Tipo | Notas |
|---|---|---|
| `Título` | Texto | = `id_radicado`, p. ej. `SED-PRE-117446000068-v1` |
| `dane_sede` | Texto | **Indexada.** Llave de cruce |
| `municipio` | Elección | **Indexada.** 26 opciones |
| `dane_ie` | Texto | |
| `institucion` | Texto | |
| `sede` | Texto | |
| `zona` | Elección | `URBANA`, `RURAL` |
| `matricula` | Número entero | |
| `tipo_censo` | Texto | Copia del censo, para no depender del join |
| `nivel_censo` | Texto | |
| `declara_afectacion` | Sí/No | **Indexada** |
| `hay_discrepancia` | Sí/No | **Indexada.** Difiere del censo |
| `justificacion_discrepancia` | Varias líneas | Texto sin formato |
| `descripcion_afectacion` | Varias líneas | Texto sin formato |
| `alcalde` | Texto | |
| `rector` | Texto | |
| `correo` | Texto | |
| `celular` | Texto | |
| `costo_directo` | Moneda | **Base del contraste** |
| `pct_admin` | Número, 2 decimales | |
| `pct_utilidad` | Número, 2 decimales | |
| `valor_admin` | Moneda | |
| `valor_utilidad` | Moneda | |
| `valor_iva` | Moneda | 19 % sobre la utilidad |
| `total_presupuesto` | Moneda | |
| `plazo_dias` | Número entero | |
| `actividades` | Varias líneas | |
| `estado` | Elección | `PENDIENTE`, `SIN_AFECTACION`, `BORRADOR`, `RADICADO`, `EN_VERIFICACION`, `REQUIERE_AJUSTE`, `APROBADO` |
| `version` | Número entero | |
| `fecha_radicacion` | Fecha y hora | |
| `resultado_verificacion` | Elección | `CORRESPONDE`, `CORRESPONDE_PARCIAL`, `NO_CORRESPONDE`, `REQUIERE_ACLARACION` |
| `observaciones_verificacion` | Varias líneas | |
| `verificador` | Texto | |
| `cedula_verificador` | Texto | |
| `fecha_verificacion` | Fecha y hora | |
| `valor_modelo` | Moneda | **Lo escribe el flujo** desde `CatalogoSedes`. Tenerlo aquí evita DAX frágil en Power BI |
| `desviacion_pct` | Número, 2 decimales | **Lo calcula el flujo** sobre el costo directo |
| `archivo_origen` | Texto | Nombre del archivo subido, para trazabilidad |

Moneda: formato **COP**, 0 decimales.

---

### Lista 3 — `ItemsPresupuesto` (N filas por radicado)

| Columna | Tipo | Notas |
|---|---|---|
| `Título` | Texto | = `id_radicado` + `-` + `n_item` |
| `id_radicado` | Texto | **Indexada.** Enlaza con la lista 2 |
| `dane_sede` | Texto | **Indexada.** Redundante a propósito: evita un join en Power BI |
| `n_item` | Número entero | |
| `capitulo_dano` | Número entero | 1 a 11 |
| `capitulo_nombre` | Texto | |
| `descripcion` | Varias líneas | |
| `unidad` | Elección | `M2`, `M3`, `ML`, `UN`, `GL`, `KG`, `TON`, `VJE`, `DIA`, `MES`, `HR` |
| `cantidad` | Número, 2 decimales | |
| `valor_unitario` | Moneda | |
| `valor_total` | Moneda | |

> **No usar columnas de tipo Búsqueda (Lookup)** para enlazar con `PresupuestosSedes`. Complican
> Power Automate, tienen su propio límite de 12 lookups por vista y se rompen al reimportar. Un
> texto indexado hace el mismo trabajo.

> **Umbral de 5.000 elementos.** Si las 554 sedes radican unas 10 actividades cada una, esta lista
> llega a ~5.500 filas. El límite de SharePoint es sobre *consultas de vista*, no sobre
> almacenamiento. Con `id_radicado` y `dane_sede` indexadas y **vistas siempre filtradas por
> municipio**, no hay problema. Crear la vista predeterminada ya filtrada.

---

## A.3 La biblioteca de entregas

Biblioteca de documentos: **`EntregasMunicipios`**

```
EntregasMunicipios/
├── AGUADAS/          compartida con alcaldia@aguadas-caldas.gov.co
├── ANSERMA/          compartida con alcaldia@anserma-caldas.gov.co
├── ARANZAZU/
├── BELALCAZAR/
├── CHINCHINA/
├── FILADELFIA/
├── LA DORADA/
├── LA MERCED/
├── MANZANARES/
├── MARMATO/
├── MARQUETALIA/
├── MARULANDA/
├── NEIRA/
├── NORCASIA/
├── PACORA/
├── PALESTINA/
├── PENSILVANIA/
├── RIOSUCIO/
├── RISARALDA/
├── SALAMINA/
├── SAMANA/
├── SAN JOSE/
├── SUPIA/
├── VICTORIA/
├── VILLAMARIA/
├── VITERBO/
├── _Procesados/      solo el flujo y la SED
└── _Errores/         paquetes que el flujo no pudo leer
```

Nombres de carpeta **sin tildes**: SharePoint las admite, pero se codifican en la URL y complican
el soporte por teléfono. El aplicativo sí muestra las tildes correctamente.

### Permisos

1. En `EntregasMunicipios` → **Detener la herencia de permisos**.
2. Quitar el acceso general de «Miembros» a las subcarpetas de municipio.
3. Compartir **cada carpeta** con el correo de su alcaldía (columna `CORREO ALCALDIA` de
   `enlaces_alcaldias.csv`), con permiso **Puede editar**.
4. `_Procesados`: solo el equipo de Planeación.

La alcaldía recibe un correo de invitación. Como `alcaldia@municipio-caldas.gov.co` no es cuenta del
tenant, SharePoint le pedirá **verificar con un código de un solo uso** enviado a ese mismo correo.
Es normal; está advertido en el instructivo.

> Requiere que el uso compartido externo del tenant esté en **«Invitados nuevos y existentes»**. Si
> está en «Solo personas de la organización», ninguna alcaldía podrá entrar y hay que pedirle a TI
> que lo habilite para este sitio.

### Qué sube cada alcaldía

| Archivo | Cuándo | Contiene |
|---|---|---|
| `presupuesto_<DANE>_v<N>.json` | Al radicar cada sede con presupuesto | Cabecera, ítems y fotos en base64 |
| `sin_afectacion_<MUNICIPIO>.json` | Una vez, al terminar el tamizaje | Todas las declaraciones sin afectación |

---

## A.4 El flujo de Power Automate

Todo con **conectores estándar**: no requiere licencia premium.

El montaje paso a paso, con las expresiones exactas, está en
[`AUTOMATIZACION_TABLERO.md`](AUTOMATIZACION_TABLERO.md). Los insumos que Power Automate necesita
—esquema para «Analizar JSON», paquetes de ejemplo para probar y el listado de las 64 columnas— se
generan con:

```
python tools/gen_esquema_flujo.py
```

Resumen del recorrido:

```
Disparador   SharePoint · «Cuando se crea un archivo (solo propiedades)»
             Biblioteca: EntregasMunicipios, sin carpeta fija
   │
   ├─ Descartar lo que no termine en .json
   ├─ Obtener contenido · Analizar JSON (esquema unificado)
   ├─ Rechazar esquemas no reconocidos -> _Errores
   │
   ├─ Modificador sobre `accion`
   │   ├─ radicarPresupuesto
   │   │    ├─ Traer valor_modelo de CatalogoSedes y calcular la desviación
   │   │    ├─ Comparar versiones: si es reenvío, no sobrescribir
   │   │    ├─ Crear o actualizar en PresupuestosSedes
   │   │    ├─ Crear las filas de ItemsPresupuesto
   │   │    └─ Guardar las fotos en SoportesFotograficos
   │   └─ declararSinAfectacion
   │        └─ Recorrer `registros` y crear o actualizar cada uno
   │
   ├─ Correo de confirmación al municipio
   └─ Mover el archivo a _Procesados
```

**Mover el archivo al final no es cosmético:** evita que el flujo lo reprocese y deja la carpeta del
municipio limpia, de modo que el alcalde ve solo lo que aún está pendiente.

Biblioteca adicional **`SoportesFotograficos`**, con una carpeta por `dane_sede`.

## A.5 Orden de montaje

1. Crear el sitio.
2. Crear `CatalogoSedes` y cargar las 975 sedes.
3. Crear `PresupuestosSedes` e `ItemsPresupuesto` (vacías).
4. Crear `EntregasMunicipios` con las 26 carpetas y `_Procesados`.
5. Crear `SoportesFotograficos`.
6. Romper herencia y compartir cada carpeta con su alcaldía.
7. Publicar el sitio del aplicativo y regenerar los enlaces con la URL definitiva.
8. Montar el flujo (puede ir después: mientras tanto la consola importa a mano).

Los pasos 1 a 6 son los que bloquean. El 8 no.

---

# PARTE B — CÓMO FUNCIONA EL APLICATIVO HOY

## B.1 De dónde salen los datos

Nada se digita a mano. `build_catalogo.py` construye el catálogo cruzando cuatro fuentes:

| Fuente | Aporta | Cruce |
|---|---|---|
| `fctMaestra.xlsx`, hoja `MATRICULA` | Universo de 975 sedes oficiales, I.E., zona, dirección, matrícula | filtro `SECTOR = OFICIAL`, sin Manizales |
| `fctMaestra.xlsx`, hoja `Sedes` | `Estado Sede` del DUE | por `Código Sede` |
| `ESTIMACION…xlsx`, hoja `BASE COMPLETA` | Tipo y nivel de afectación, daños marcados, valor del modelo, orden de priorización | por **DANE SEDE** |
| `Directorio I.E. 2026.xlsx` | Rector, correo y celular | por **municipio + nombre**, porque su columna DANE está desplazada |
| `Base de datos Funcionarios 2026.xlsx` | Alcalde y correo de la alcaldía | por municipio |

Resultado: 975 sedes, 161 I.E. todas con rector, 26 municipios todos con alcalde. Las 975 están
activas en el DUE y todas con matrícula mayor que cero.

La salida se parte en dos archivos **a propósito**:

- **`data.js`** — lo carga el aplicativo del alcalde. **No lleva** el valor del modelo. Si viajara al
  navegador, bastaría abrir el inspector para verlo, y el presupuesto municipal dejaría de ser una
  medición independiente.
- **`data-sed.js`** — lo carga solo la consola. Ahí sí va el valor del modelo.

## B.2 Cómo entra el alcalde

Recibe un enlace propio: `…/index.html?m=RIOSUCIO&t=BAGG8CQZX2`

1. El aplicativo normaliza el municipio (los enlaces viajan sin tildes porque los correos las rompen)
   y lo resuelve al nombre canónico: `SAN JOSE` → `SAN JOSÉ`.
2. Calcula `SHA-256("SAN JOSÉ|UE4SJDWXTZ")` y compara contra el hash publicado en `tokens.js`.
   **El sitio nunca contiene los tokens en claro.** Como el municipio entra en el hash, un token no
   sirve para otro municipio.
3. Si no coincide, muestra «Enlace no válido» y no pinta nada.

No hay usuario ni contraseña. Esto evita que un municipio diligencie por otro y da trazabilidad,
pero **no es autenticación**: la barrera real es la carpeta de SharePoint.

## B.3 El tablero municipal

Es la pantalla de trabajo. Sin ella, Riosucio serían 92 formularios completos y no se cumpliría.

Muestra las sedes del municipio con métricas de avance y, por cada sede, la clasificación del censo
en solo lectura. Cada sede llega en uno de tres modos:

| Modo | Sedes | Comportamiento |
|---|---|---|
| Pre-marcada sin afectación | 271 (tipo 5) | Se confirman con un clic, o todas de golpe |
| Abierta para presupuesto | 554 (tipos 1-4) | Se abre el formulario |
| Requiere declaración expresa | 150 (tipos 6 y 7) | Llega en blanco: el municipio decide |

El botón de confirmación masiva es lo que hace viable el volumen: Riosucio resuelve 30 sedes de un
golpe y se concentra en las 58 que sí requieren presupuesto.

## B.4 El formulario

Reproduce las secciones 1 a 4 del formato oficial.

**Sección 1 — Identificación.** Municipio, I.E., sede, DANE, zona y matrícula vienen del catálogo en
solo lectura. **El DANE nunca se digita:** un dígito mal tecleado dejaría el registro huérfano y
rompería la cadena estimación → presupuesto → verificación. Alcalde, rector y contacto vienen
precargados y sí son editables.

**Sección 2 — Afectación.** Muestra el tipo y nivel del censo en solo lectura y pregunta al
municipio si la sede presenta afectación. Si su respuesta contradice al censo, el sistema **marca la
discrepancia y exige justificación** — no la bloquea. Así el dato oficial se conserva, el desacuerdo
queda registrado como tal, y decide la Secretaría. Exige descripción y al menos una fotografía; las
fotos se reducen a 1600 px y se recomprimen en el navegador antes de guardarse.

**Sección 3 — Presupuesto.** Tabla de filas ilimitadas. Capítulo de daño y unidad de medida son
**catálogos cerrados**: en texto libre llegarían «mt2», «M2» y «metro cuadrado», y consolidar 975
sedes se volvería trabajo manual de días. El capítulo usa los mismos 11 ítems del modelo, lo que
permite comparar peso a peso lo presupuestado contra lo estimado.

**Sección 3.1 — Resumen económico.**

```
Costo directo      = Σ (cantidad × valor unitario)
Administración     = Costo directo × A %
Utilidad           = Costo directo × U %
IVA sobre utilidad = Utilidad × 19 %
TOTAL              = Costo directo + Administración + Utilidad + IVA
```

Sin imprevistos. El IVA sobre la utilidad tiene respaldo expreso: Decreto 1372 de 1992, art. 3. Si
A supera 12 % o U supera 8 %, aparece una **alerta que no bloquea** — no existe tope legal de AIU en
Colombia, cada entidad es autónoma, así que solo se puede señalar la desviación frente a la práctica
de mercado.

**Sección 4 — Plazo.** Días calendario y actividades previstas.

Todo lo calculable lo calcula el sistema. En el formato Word los tres valores se digitan y no
cuadran; es la primera causa de devolución.

## B.5 Qué pasa al radicar

1. Se validan descripción, fotografía, al menos una actividad completa, porcentajes y plazo.
2. Se arma el registro con su consecutivo `SED-PRE-<DANE>-v<N>`.
3. Se guarda en el navegador **sin las fotos en base64** — el tope de `localStorage` ronda los 5 MB
   y un municipio con 50 sedes fotografiadas lo reventaría, perdiendo todo lo digitado.
4. Se descarga `presupuesto_<DANE>_v<N>.json` con cabecera, ítems y fotos.

Las declaraciones **sin afectación no descargan nada individualmente**: confirmar 30 sedes
dispararía 30 descargas. Se acumulan y salen en un solo archivo desde el tablero.

Si el municipio vuelve a enviar una sede, sube a `v2` y **la versión anterior se conserva**.

## B.6 La consola de la Secretaría

`consola.html`, de uso interno. No debe compartirse: contiene el valor del modelo.

- **Panorama:** radicados, con y sin afectación, pendientes de verificar, discrepancias.
- **Contraste:** costo directo municipal contra valor del modelo, con desviación. **Se compara
  contra el costo directo, nunca contra el total con AU**, porque el modelo excluye AIU,
  interventoría, estudios y diseños e IVA. Comparar totales haría que toda sede pareciera inflada.
- **Importación** de los dos formatos de paquete, con control de versiones: rechaza reenvíos de una
  versión igual o anterior.
- **Verificación (sección 5):** los cuatro resultados del formato, observaciones y firma electrónica
  simple con nombre, cédula, fecha y hora.
- **Exportación** a CSV con separador `;` y BOM, para que Excel en español lo abra en columnas.

## B.7 El PDF

Reproduce el formato oficial completo, con las casillas de grado de afectación marcadas según el
censo y el cuadro de verificación con el resultado que registró la Secretaría. Se genera sin
librerías externas —el sitio no carga nada de terceros— mediante un iframe y la impresión del
navegador, que en Windows permite guardar como PDF.

## B.8 Qué NO hace todavía

| | |
|---|---|
| Enviar solo a SharePoint | El alcalde descarga y sube. Es el diseño de la opción A′ |
| Correo automático de confirmación | Lo hará el flujo de Power Automate |
| Devolver al municipio | La consola registra «requiere ajuste», pero notificar es manual |
| Compartir borradores entre computadores | Quedan en el navegador donde se digitó |
| Tablero de Power BI | Se conecta cuando existan las listas |

---

*Elaborado por Práctica TIC — Secretaría de Educación de Caldas. Corte: 08-09-2026.*
