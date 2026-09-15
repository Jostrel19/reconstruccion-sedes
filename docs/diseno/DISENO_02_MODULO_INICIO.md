# Diseño — Módulo 2: Inicio y navegación (Fase 1)

Consume los tokens y componentes de [`DISENO_01_SISTEMA_VISUAL.md`](DISENO_01_SISTEMA_VISUAL.md).
No depende de Q-10: usa datos que el sistema ya produce (`db.registros()`, `catalogo_sedes.json`,
`SED_RESERVADO`).

---

## 1. Objetivo

Reemplazar el panorama plano de `consola.js::pintar()` (una sola pantalla con todo) por los tres
niveles de profundidad que pide el HANDOFF: **Caldas → municipio → sede**. Hoy la lógica de
agregación ya existe (`consola.resumen()`, `consola.filtrar()`, `consola.desviacion()`) — este
módulo la reorganiza en tres pantallas navegables en vez de una tabla con filtros sueltos.

---

## 2. Las tres pantallas

### 2.1 Nivel Caldas (pantalla de entrada)

```
[barra superior con logo]

Caldas › [aquí no hay más niveles]

┌─ Panorama general ──────────────────────────────────────────┐
│  975 sedes · 26 municipios · 161 I.E.                        │
│  [métrica] [métrica] [métrica] [métrica]   ← consola.resumen()│
└────────────────────────────────────────────────────────────┘

┌─ Municipios ──────────────────────────────────────────────── tabla densa
│ MUNICIPIO   SEDES  RADICADAS  AVANCE  COSTO DIRECTO  DESVIACIÓN  ALERTAS │
│ Riosucio      92        61     66%      $XXX.XXX.XXX     +12,3%     ▮2   │
│ Pensilvania   85        40     47%      ...                              │
│ ...                                                                       │
└────────────────────────────────────────────────────────────────────────┘
```

- Cada fila de municipio lleva la franja de estado (§3.3 de `DISENO_01`) en el color de su alerta
  más severa (rojo si hay discrepancias sin resolver, ámbar si hay A/U fuera de umbral, verde si
  está al día).
- Clic en una fila → nivel municipio.
- La tabla se ordena por defecto por **sedes pendientes descendente** (lo que más urge), no
  alfabético — alfabético es el default genérico que no ayuda a decidir por dónde seguir.

### 2.2 Nivel Municipio

```
Caldas › Riosucio

┌─ Riosucio ────────────────────────────────────────────────┐
│  92 sedes · 61 radicadas · 31 pendientes                    │
│  [métrica] [métrica] [métrica]                               │
└─────────────────────────────────────────────────────────────┘

┌─ Sedes ──────────────────────────────────────────────────── filtros: estado · tipo censo · solo discrepancias
│ SEDE                          DANE            ESTADO      TIPO  COSTO DIRECTO  DESV. │
│ I.E. La Milagrosa - Ppal.     117xxxxxxxxx    RADICADO     3    $XX.XXX.XXX    +8%    │
│ ...                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- Reutiliza literalmente `consola.filtrar()` con `filtro.municipio` fijado al municipio activo — no
  se reimplementa el filtrado.
- Clic en una fila de sede → nivel sede (que es la ficha del **módulo 3**, ver
  `DISENO_03_MODULO_PRESUPUESTO.md`). El módulo de Inicio no duplica esa pantalla, solo enruta a
  ella.

### 2.3 Nivel Sede

No es responsabilidad de este módulo: es el punto de entrada al módulo 3. Aquí solo se define que
la miga de pan llega hasta `Caldas › Riosucio › I.E. La Milagrosa - Sede Principal` y que desde ahí
"volver" regresa al nivel municipio con los mismos filtros que tenía.

---

## 3. Migas de pan — estado de la navegación

El componente de `DISENO_01` §3.2 lleva el estado de dónde está el usuario. Se implementa como un
objeto de ruta simple, coherente con que el proyecto no usa router ni framework:

```js
const nav = { nivel: 'caldas', municipio: null, dane: null };
```

`app.js` (arranque) decide qué pinta según `nav.nivel`. No hace falta hash-routing ni historial del
navegador para la fase 1 — se puede añadir después si se pide compartir enlaces a una sede
específica, pero no es requisito de esta fase.

---

## 4. Construcción — qué se reutiliza, qué es nuevo, dónde vive

Requiere fase 0 cerrada. No requiere Q-10: no lee Excel de alcaldías, solo reorganiza lo que ya
llega por paquete `.json` o por `tools/consolidar.py`.

| Pieza | Origen |
|---|---|
| `consola.resumen()`, `consola.filtrar()`, `consola.desviacion()`, `consola.valorModelo()` | **Se reutilizan sin cambios** |
| `nav` — `{ nivel, municipio, dane }` | **Nuevo.** Vive en memoria, no en `localStorage`: recargar vuelve a Caldas, aceptable para uso interno de una sola persona |
| `consola.resumenPorMunicipio()` | **Nuevo.** Aplica `resumen()`/`desviacion()` agrupando por los 26 municipios de `SED_MUNICIPIOS`, reutilizando el cálculo existente sin duplicarlo |
| `renderCaldas()`, `renderMunicipio()`, `renderMigas()` | **Nuevas.** Pintan §2.1, §2.2 y §3 respectivamente |
| Tabla de sedes por municipio | Adaptación de la tabla plana que ya pinta `consola.pintar()`, con `filtro.municipio` fijo |

`consola.js` ya tiene 595 líneas (panorama + filtros + modal de verificación + importación). Antes
de seguir agregando ahí, dividir por responsabilidad (mismo criterio de "Capas del cliente" del
`CLAUDE.md` del proyecto §5):

```
web/assets/js/
  consola.js         arranque, estado global (nav, filtro), importación/exportación — se queda
  consola-inicio.js  NUEVO: renderCaldas(), renderMunicipio(), resumenPorMunicipio()
  consola-migas.js   NUEVO: renderMigas() — se reutiliza también en fase 2
```

---

## 5. Estados vacíos y de carga

- Municipio sin ninguna sede radicada: la tabla de sedes muestra el catálogo completo con estado
  `PENDIENTE` para todas — nunca una tabla vacía. El dato de "qué falta" es tan relevante como "qué
  ya llegó".
- Mientras `db.registros()` no ha cargado (paquetes aún no importados): panorama en cero, sin
  spinners ni animaciones — un estado quieto con la cifra `0` es más honesto que un loader decorativo
  cuando la causa real es "todavía no hay nada que cargar".

---

## 6. Verificación de cierre

- [ ] Con datos de la demo (`tools/gen_demo.py`) o el consolidado real, la suma de los 26
      municipios en la tabla de Caldas coincide con `consola.resumen()` global.
- [ ] Clic en un municipio entra al nivel municipio y la miga de pan lo refleja.
- [ ] Los filtros de `consola.filtrar()` siguen funcionando dentro de un municipio.
- [ ] Clic en una sede navega al nivel sede (puede apuntar a un placeholder "fase 2 pendiente" si
      esa fase aún no existe, sin romper la navegación).
- [ ] Volver de municipio a Caldas y de sede a municipio conserva los filtros previos.
- [ ] Sin ningún registro importado, la tabla de sedes de un municipio muestra el catálogo completo
      en `PENDIENTE`, no una tabla vacía.

Solo con esto en verde se pasa a fase 2.
