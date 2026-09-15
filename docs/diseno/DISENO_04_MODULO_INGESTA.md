# Diseño — Módulo 1: Ingesta y validación (Fase 3 — BLOQUEADA)

**No se implementa todavía.** Este archivo diseña el *flujo* de pantallas, que no depende del
formato exacto de columnas de un Excel; no diseña el *parser*, que sí depende de verlo
(`HANDOFF_REDISENO_SISTEMA.md` §6, Q-10). Construir el parser antes de tener un Excel real sería
adivinar, y el propio HANDOFF lo prohíbe explícitamente.

---

## 1. Objetivo

Un Excel de alcaldía se convierte en registro solo si pasa por identificación de sede, normalización
de cantidades, recálculo (nunca lectura directa de totales) y clasificación por capítulo de daño —
las 5 reglas ya fijadas en `HANDOFF_REDISENO_SISTEMA.md` §3, módulo 1. Este documento diseña cómo se
ve eso para quien lo opera (el practicante, no el alcalde).

---

## 2. Por qué mapeo asistido y no un lector fijo

Ya decidido en el HANDOFF: los municipios no mandan el mismo formato, confirmado el 2026-09-09. Un
lector de columnas fijas falla en silencio la primera vez que dos municipios llaman distinto a la
misma columna. La alternativa —adivinar por heurística de nombre de columna— falla peor: falla
*a veces*, que es más peligroso que fallar siempre.

---

## 3. Pantallas

### 3.1 Subir archivo

```
Caldas › Ingesta

┌─ Nuevo archivo ──────────────────────────────────────────────┐
│  Municipio: [selector de los 26]                                │
│  Archivo:   [seleccionar .xlsx]                                 │
│                                              [Analizar archivo]  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2a Primera vez de un municipio — mapeo

Se muestran los encabezados reales tal como llegaron, sin normalizar, y se pide asignar cada uno a
un campo del modelo:

```
┌─ Mapear columnas — Riosucio (primera vez) ────────────────────┐
│  Encabezado en el Excel          →  Campo del sistema           │
│  "Codigo Dane"                   →  [DANE SEDE ▾]                │
│  "Nombre sede"                   →  [Sede (referencia, no cruce) ▾]│
│  "Descripcion del item"          →  [Trabajo a ejecutar ▾]        │
│  "Unidad"                        →  [Unidad de medida ▾]          │
│  "Cant"                          →  [Cantidad ▾]                  │
│  "Vr Unitario"                   →  [Valor unitario ▾]            │
│  "Capitulo"                      →  [— sin mapear —]              │
│                                                                    │
│  Columnas del Excel sin usar quedan visibles, no se ocultan.     │
│                                          [Guardar perfil de Riosucio] │
└────────────────────────────────────────────────────────────────────┘
```

- Ningún campo se auto-asigna por heurística de nombre — el HANDOFF descarta explícitamente
  adivinar. Se puede ofrecer una sugerencia por similitud de texto, pero el practicante confirma
  cada una; nada se guarda sin confirmación explícita.
- El perfil se guarda por municipio (`data/generado/perfiles_ingesta.json` o similar — el formato
  exacto de persistencia se decide al implementar).

### 3.2b Envíos siguientes del mismo municipio

Sin pantalla de mapeo: se aplica el perfil guardado directo al informe de validación (§3.3). Si los
encabezados no coinciden con el perfil guardado, **no se procesa** — se avisa que el formato cambió
y se ofrece volver a mapear (regla ya fijada en el HANDOFF, no se relaja).

### 3.3 Informe de validación — antes de escribir nada

Ningún archivo se vuelca al sistema sin pasar por un reporte que el practicante revisa. Se agrupa
por severidad, tabla densa (nunca tarjetas de "éxito" decorativas):

```
┌─ Riosucio — presupuesto_riosucio_v3.xlsx ────────────────────┐
│  61 filas leídas                                                 │
│                                                                    │
│  ERROR — no se vuelcan (3)                                       │
│  FILA  MOTIVO                                                     │
│  14    DANE SEDE no está en el catálogo de 975 sedes              │
│  22    Cantidad no numérica: "por definir"                        │
│  40    Sede sin ninguna fila de presupuesto                       │
│                                                                    │
│  ADVERTENCIA — se vuelcan con nota (5)                            │
│  FILA  MOTIVO                                                     │
│  8     Total de la fila no coincide con cantidad × valor unitario:│
│        Excel dice $4.200.000, recalculado $4.150.000 → manda      │
│        el recalculado                                             │
│  19    Capítulo de daño no viene — queda "sin clasificar"          │
│                                                                    │
│  OK — se vuelcan (53)                                             │
│                                                                    │
│                        [Descartar]   [Volcar 53 + 5 con nota]     │
└────────────────────────────────────────────────────────────────────┘
```

- **Error = bloqueante**, no se vuelca esa fila bajo ninguna circunstancia.
- **Advertencia = se vuelca, pero queda marcada** para que el módulo 2 (panorama) la liste entre
  pendientes de depuración — igual que hoy `sinBase` se muestra en el panorama de `consola.js` en
  vez de esconderse.
- El archivo original se archiva tal como llegó (regla ya fijada, `HANDOFF` §3 módulo 1, punto 5).

---

## 4. Modelo de datos del perfil (borrador, sujeto al Excel real)

```json
{
  "municipio": "RIOSUCIO",
  "mapeo": {
    "dane_sede": "Codigo Dane",
    "descripcion": "Descripcion del item",
    "unidad": "Unidad",
    "cantidad": "Cant",
    "valor_unitario": "Vr Unitario",
    "capitulo_dano": "Capitulo"
  },
  "hoja": "Presupuesto",
  "fila_encabezado": 1,
  "actualizado": "2026-09-15"
}
```

Este esquema es un borrador razonable, **no un contrato cerrado**: en cuanto llegue el primer Excel
real (Q-10) es probable que aparezcan casos que esta forma no cubre (encabezados en dos filas,
celdas combinadas, hojas múltiples por sede). Se ajusta ahí, no antes.

---

## 5. Qué NO se construye todavía

- El parser de Excel en sí (`openpyxl`/`pandas`, según corresponda tras inspeccionar el archivo real
  — ver la regla del proyecto de elegir herramienta según estructura, `CLAUDE.md` §5 del perfil).
- La UI de mapeo puede adelantarse como *shell* (pantalla estática con datos de ejemplo) si se
  quiere probar la interacción, pero no se conecta a un lector real hasta tener Q-10 resuelto.
- Persistencia definitiva del perfil — formato exacto se decide con el primer caso real en mano.

---

## 6. Construcción — decisión de arquitectura pendiente de ver el Excel

**Herramienta:** esta es la única fase que introduce algo nuevo — Python (pandas/openpyxl) en vez
de JS puro, porque leer en el navegador un Excel con posibles celdas combinadas, hojas múltiples o
encabezados en dos filas es mucho más frágil que hacerlo en `tools/`, y es coherente con
"Consolidación de N archivos, cruces, auditoría → Script Python" (`CLAUDE.md` del proyecto §5).

**Decisión a confirmar solo con el Excel real en mano:** ¿corre como herramienta de línea de
comandos en `tools/` (patrón de `consolidar.py`) que el practicante ejecuta y cuyo resultado
alimenta la consola, o se lee del lado del navegador vía una librería JS de xlsx? Se recomienda la
primera opción salvo que el archivo real resulte tan simple que no la justifique.

Pasos, en cuanto se resuelva Q-10:

1. Inspeccionar el archivo real sin asumir nada (hojas, encabezados, celdas combinadas, tipos).
2. Repetir con un segundo y tercer ejemplo de municipios distintos, y anotar en qué difieren — eso
   confirma o corrige el diseño de mapeo asistido de este archivo.
3. Escribir el lector (`tools/leer_presupuesto_alcaldia.py` o similar) aplicando las 5 reglas del
   HANDOFF §3 módulo 1.
4. Construir el informe de validación (§3.3) como salida del script.
5. Conectar la salida al modelo de datos para que aparezca en los módulos 2 y 3 sin tocarlos de
   nuevo.
6. Construir la UI de mapeo (§3.2a/§3.2b) **solo si el volumen de formatos distintos lo justifica**
   — si la mayoría de municipios manda algo parecido, un mapeo fijo por municipio dentro del propio
   script puede bastar para 26 municipios y ser más rápido que construir una UI. Se decide con el
   Excel real en mano.

## 7. Verificación de cierre (cuando se ejecute)

- [ ] El lector rechaza correctamente DANE inválido, cantidad no numérica y sede sin ninguna fila de
      presupuesto (los 3 casos de ejemplo de §3.3).
- [ ] El total recalculado manda sobre el del Excel cuando difieren, y la diferencia queda como
      advertencia, no oculta.
- [ ] El archivo original queda archivado tal como llegó.
- [ ] Un segundo envío del mismo municipio versiona en vez de sobrescribir (misma regla que ya
      aplica `storage.js::guardarRegistro` para paquetes `.json`).
- [ ] Los registros volcados aparecen en el módulo 2 sin haber tocado ese módulo de nuevo.

## 8. Disparador para retomar

En cuanto llegue al menos un Excel real de una alcaldía (Q-10). Si llegan varios a la vez, mejor:
más variedad confirma o descarta más rápido el diseño del mapeo.
