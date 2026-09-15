# Automatización: del archivo que sube el alcalde al tablero que se actualiza solo

Secretaría de Educación de Caldas — Dirección de Planeación

Este documento monta la pieza que faltaba: **el alcalde sube su archivo y, sin que nadie toque
nada, el registro aparece en las listas y el tablero de Power BI queda al día.**

Todo con conectores estándar. **No requiere la licencia premium que no se compró.**

```
Alcalde sube el archivo
        ▼
EntregasMunicipios/<MUNICIPIO>/
        ▼   (el flujo se dispara en menos de un minuto)
Flujo de Power Automate — lee, valida, escribe
        ▼
PresupuestosSedes  ·  ItemsPresupuesto  ·  SoportesFotograficos
        ▼
Power BI — actualización programada
        ▼
El jefe abre el tablero y ve todo al día
```

Insumos generados por `python tools/gen_esquema_flujo.py`, en `docs/flujo/`:

| Archivo | Para qué |
|---|---|
| `esquema_unificado.json` | Se pega en la acción «Analizar JSON». Cubre los dos tipos de paquete |
| `ejemplo_presupuesto.json` | Para probar el flujo sin esperar a un alcalde |
| `ejemplo_sin_afectacion.json` | Idem |
| `columnas_listas.csv` | Las 64 columnas de las tres listas, con tipo y origen |

---

## 1. Antes de empezar

1. Las tres listas creadas según `columnas_listas.csv`.
2. `CatalogoSedes` cargada con las 975 sedes (desde `data/generado/catalogo_sedes.json`).
3. La biblioteca `EntregasMunicipios` con las 26 carpetas, `_Procesados` y `_Errores`.
4. La biblioteca `SoportesFotograficos`.

> **`CatalogoSedes` no es opcional.** Sin ella el tablero solo puede contar lo que llegó y no lo que
> falta, que es justamente lo que el jefe necesita ver: quién va atrasado.

---

## 2. El flujo

**Crear → Flujo de nube automatizado.** Nombre: `Ingesta presupuestos municipales`.

### Disparador

**SharePoint — «Cuando se crea un archivo (solo propiedades)»**

| Campo | Valor |
|---|---|
| Dirección del sitio | el sitio del proyecto |
| Nombre de la biblioteca | `EntregasMunicipios` |
| Carpeta | *(vacío: cubre las 26 subcarpetas)* |

En «Configuración» del disparador, poner el intervalo en **1 minuto**.

### Paso 1 — Descartar lo que no es un paquete

**Condición** llamada `¿Es un archivo .json?`

Lado izquierdo (expresión):
```
endsWith(toLower(triggerOutputs()?['body/{FilenameWithExtension}']), '.json')
```
Operador: `es igual a` · Lado derecho: `true`

En la rama **«En caso contrario»**: acción **Terminar** con estado `Correcto`. Alguien va a subir un
PDF o una foto suelta alguna vez; que el flujo no falle por eso.

Todo lo que sigue va dentro de la rama **«En caso afirmativo»**.

### Paso 2 — Leer el archivo

**SharePoint — «Obtener contenido del archivo»**
- Identificador: contenido dinámico **Identificador** del disparador.

**Operaciones de datos — «Redactar»**, nombre `TextoJSON`:
```
base64ToString(outputs('Obtener_contenido_del_archivo')?['body']?['$content'])
```

**Operaciones de datos — «Analizar JSON»**, nombre `Paquete`
- Contenido: `outputs('TextoJSON')`
- Esquema: pegar el contenido de `docs/flujo/esquema_unificado.json`

### Paso 3 — Rechazar esquemas que no se reconocen

**Condición** `¿Esquema compatible?`:
```
body('Paquete')?['esquema']
```
`es igual a` · `1`

En «En caso contrario»: mover el archivo a `_Errores` y enviar correo interno. Si algún día se
cambia la forma del paquete, es preferible que el flujo lo aparte a que escriba datos incompletos en
las listas.

### Paso 4 — Separar los dos tipos de paquete

**Control — «Modificador»** (Switch) sobre:
```
body('Paquete')?['accion']
```

---

### Caso `radicarPresupuesto`

**4.1 — Traer el valor del modelo**

SharePoint — «Obtener elementos», nombre `ValorModeloCatalogo`
- Lista: `CatalogoSedes`
- Consulta de filtro:
```
dane_sede eq '@{body('Paquete')?['cabecera']?['dane_sede']}'
```
- Número máximo de elementos: `1`

**Redactar** `ValorModelo`:
```
if(empty(body('ValorModeloCatalogo')?['value']), 0, first(body('ValorModeloCatalogo')?['value'])?['valor_modelo'])
```

**Redactar** `Desviacion`:
```
if(equals(outputs('ValorModelo'), 0), null, div(mul(sub(body('Paquete')?['cabecera']?['costo_directo'], outputs('ValorModelo')), 100.0), outputs('ValorModelo')))
```

> La desviación se calcula sobre el **costo directo**, nunca sobre el total con AU. El modelo no
> incluye AIU, interventoría, estudios y diseños ni IVA: comparar totales haría que toda sede
> pareciera inflada y el indicador no diría nada.

**4.2 — ¿Ya existía esta sede?**

SharePoint — «Obtener elementos», nombre `Existente`
- Lista: `PresupuestosSedes`
- Filtro:
```
dane_sede eq '@{body('Paquete')?['cabecera']?['dane_sede']}'
```

**Redactar** `VersionExistente`:
```
if(empty(body('Existente')?['value']), 0, first(body('Existente')?['value'])?['version'])
```

**Condición** `¿Es reenvío?`:
```
greaterOrEquals(outputs('VersionExistente'), body('Paquete')?['cabecera']?['version'])
```
`es igual a` `true`

- **En caso afirmativo:** mover el archivo a `_Procesados` y **Terminar**. Es un reenvío de algo que
  ya está; no se sobrescribe.
- **En caso contrario:** continuar con 4.3.

**4.3 — Escribir el registro**

**Condición** `¿Existe?`:
```
empty(body('Existente')?['value'])
```
`es igual a` `false`

- **Afirmativo (ya existe, versión menor):** SharePoint — «Actualizar elemento», Id:
  `first(body('Existente')?['value'])?['ID']`
- **Contrario (no existe):** SharePoint — «Crear elemento»

En ambos, mapear según `columnas_listas.csv`. Los campos vienen de
`body('Paquete')?['cabecera']?['<campo>']`, salvo:

| Columna | Valor |
|---|---|
| `Título` | `body('Paquete')?['cabecera']?['id_radicado']` |
| `valor_modelo` | `outputs('ValorModelo')` |
| `desviacion_pct` | `outputs('Desviacion')` |
| `archivo_origen` | contenido dinámico **Nombre de archivo con extensión** |

**4.4 — Las actividades del presupuesto**

**Aplicar a cada uno** sobre `body('Paquete')?['items']`
→ SharePoint — «Crear elemento» en `ItemsPresupuesto`

| Columna | Valor |
|---|---|
| `Título` | `concat(body('Paquete')?['cabecera']?['id_radicado'], '-', items('Aplicar_a_cada_item')?['n_item'])` |
| `id_radicado` | `body('Paquete')?['cabecera']?['id_radicado']` |
| `dane_sede` | `body('Paquete')?['cabecera']?['dane_sede']` |
| resto | `items('Aplicar_a_cada_item')?['<campo>']` |

> **Sobre los reenvíos:** al llegar una v2, sus actividades entran con el `id_radicado` nuevo
> (`…-v2`) y las de la v1 quedan en la lista. No estorban: Power BI une por `id_radicado`, y el
> registro vigente apunta al nuevo. Quedan como histórico.

**4.5 — Las fotografías**

**Aplicar a cada uno** sobre `body('Paquete')?['fotos']`
→ SharePoint — «Crear archivo»

| Campo | Valor |
|---|---|
| Ruta de la carpeta | `concat('/SoportesFotograficos/', body('Paquete')?['cabecera']?['dane_sede'])` |
| Nombre | `concat(body('Paquete')?['cabecera']?['dane_sede'], '_', string(rand(1000,9999)), '_', items('Aplicar_a_cada_foto')?['nombre'])` |
| Contenido | `base64ToBinary(items('Aplicar_a_cada_foto')?['contenido_b64'])` |

**4.6 — Confirmar y archivar**

Office 365 Outlook — «Enviar un correo electrónico»
- Para: `body('Paquete')?['cabecera']?['correo']`
- Asunto: `concat('Radicado ', body('Paquete')?['cabecera']?['id_radicado'], ' - ', body('Paquete')?['cabecera']?['sede'])`
- Cuerpo: confirmación con el radicado, la sede y el valor total.

SharePoint — «Mover archivo» a `/EntregasMunicipios/_Procesados`.

> **Mover el archivo no es cosmético.** Evita que el flujo lo reprocese y deja la carpeta del
> municipio limpia, de modo que el alcalde ve solo lo que aún está pendiente.

---

### Caso `declararSinAfectacion`

**Aplicar a cada uno** sobre `body('Paquete')?['registros']`. Dentro, la misma secuencia de 4.2 y
4.3 pero leyendo de `items('Aplicar_a_cada_registro')?['<campo>']` en vez de la cabecera. No hay
ítems ni fotos que procesar.

Al terminar el bucle: correo de confirmación al municipio y mover el archivo a `_Procesados`.

---

### Caso predeterminado

Mover a `_Errores` y avisar por correo a Planeación.

---

## 3. Probar el flujo antes de que llegue un alcalde

1. Subir `docs/flujo/ejemplo_presupuesto.json` a cualquier carpeta de municipio.
2. Verificar en el historial del flujo que corrió sin error.
3. Confirmar que en `PresupuestosSedes` apareció `SED-PRE-117446000157-v1`, con `valor_modelo`
   traído del catálogo y `desviacion_pct` calculada.
4. Confirmar una fila en `ItemsPresupuesto` y el archivo movido a `_Procesados`.
5. Repetir con `ejemplo_sin_afectacion.json`.
6. **Volver a subir el mismo archivo:** debe ir a `_Procesados` sin duplicar nada. Esta prueba es la
   importante — un alcalde va a reenviar por error, es cuestión de tiempo.

Después de probar, borrar los registros de prueba de las listas.

---

## 4. El tablero

### Conectar

Power BI Desktop → **Obtener datos → Lista de SharePoint Online** → dirección del sitio →
implementación **2.0** → seleccionar `CatalogoSedes`, `PresupuestosSedes` e `ItemsPresupuesto`.

En el editor de Power Query, quedarse solo con las columnas necesarias. Las listas traen decenas de
columnas del sistema que no aportan y hacen lenta la actualización.

### Relaciones

| Desde | Hacia | Cardinalidad |
|---|---|---|
| `CatalogoSedes[dane_sede]` | `PresupuestosSedes[dane_sede]` | uno a varios |
| `PresupuestosSedes[id_radicado]` | `ItemsPresupuesto[id_radicado]` | uno a varios |

`CatalogoSedes` es la tabla del universo: contra ella se mide lo que falta.

### Medidas

```dax
Sedes del universo = COUNTROWS ( CatalogoSedes )

Sedes con respuesta = DISTINCTCOUNT ( PresupuestosSedes[dane_sede] )

Sedes pendientes = [Sedes del universo] - [Sedes con respuesta]

% Avance = DIVIDE ( [Sedes con respuesta], [Sedes del universo] )

Sedes con presupuesto =
CALCULATE (
    DISTINCTCOUNT ( PresupuestosSedes[dane_sede] ),
    PresupuestosSedes[declara_afectacion] = TRUE ()
)

Costo directo radicado = SUM ( PresupuestosSedes[costo_directo] )

Total presupuestado = SUM ( PresupuestosSedes[total_presupuesto] )

Valor del modelo = SUM ( PresupuestosSedes[valor_modelo] )

Desviación % =
DIVIDE ( [Costo directo radicado] - [Valor del modelo], [Valor del modelo] )

Discrepancias con el censo =
CALCULATE (
    COUNTROWS ( PresupuestosSedes ),
    PresupuestosSedes[hay_discrepancia] = TRUE ()
)

Por verificar =
CALCULATE (
    COUNTROWS ( PresupuestosSedes ),
    FILTER ( PresupuestosSedes, ISBLANK ( PresupuestosSedes[resultado_verificacion] ) )
)
```

### Qué poner en el tablero

**Página 1 — Avance.** Es la que mira el jefe.
- Tarjetas: sedes del universo, con respuesta, pendientes, % avance.
- Barras por municipio ordenadas por pendientes de mayor a menor: se ve de inmediato quién va
  atrasado. Riosucio, Pensilvania y Samaná son los que hay que vigilar.
- Tabla: municipio, sedes, respondidas, pendientes, último radicado.

**Página 2 — Dinero.**
- Costo directo radicado contra valor del modelo, y la desviación.
- Desglose por capítulo de daño, usando `ItemsPresupuesto[capitulo_nombre]`.
- Las diez sedes de mayor valor.

**Página 3 — Control.**
- Discrepancias con el censo.
- Pendientes de verificar.
- Sedes tipo 1 y 2 que aún no radican: son las 28 críticas, y valen el 20,6 % del total estimado.

### Actualización

Publicar al servicio → conjunto de datos → **Actualización programada**, con credenciales OAuth2 de
SharePoint Online. No hace falta puerta de enlace: SharePoint Online se actualiza directo.

**Con Power BI Pro son hasta 8 actualizaciones al día.** Conviene ser claro en esto: el tablero
queda automático, no instantáneo. Si se programa cada dos horas en jornada laboral, lo que un
alcalde suba a las 9:10 se ve a las 10:00. Para el seguimiento de una recolección es de sobra; si
alguien necesita verlo al segundo, la vista de la lista de SharePoint sí es en vivo.

---

## 5. Qué mirar si algo falla

| Síntoma | Causa habitual |
|---|---|
| El flujo no se dispara | El disparador tiene una carpeta fija en vez de vacía, y no ve las subcarpetas |
| «Analizar JSON» falla | Un campo llegó vacío y el esquema no admite `null`. Los esquemas generados ya declaran `["string","null"]`; si se editaron a mano, revisar eso |
| El registro entra sin `valor_modelo` | El `dane_sede` no está en `CatalogoSedes`, o la columna quedó como Número y perdió los ceros a la izquierda |
| Se duplican registros | Falta el paso 4.2, el de comparar versiones |
| El mismo archivo se procesa en bucle | Falta mover a `_Procesados` |
| Power BI no actualiza | Credenciales del conjunto de datos vencidas |

> **La causa número uno de problemas es que `dane_sede` quede como columna de tipo Número.**
> `117013000292` pierde precisión y los ceros a la izquierda desaparecen; a partir de ahí nada
> cruza. Debe ser **Texto** en las tres listas.

---

*Elaborado por Práctica TIC — Secretaría de Educación de Caldas. Corte: 08-09-2026.*
