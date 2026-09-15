# Diseño — sistema visual (Fase 0)

Fundamentos que consumen los módulos 2, 3 y 4. Se construye una sola vez.

---

## 1. Referencia real: el logo, no una paleta inventada

`web/assets/img/logo-sed-caldas.png` (450×60, fondo transparente) es la única fuente de la paleta.
Colores muestreados directamente de sus píxeles (`HANDOFF_REDISENO_SISTEMA.md` §4):

| Token | Valor | De dónde sale | Uso |
|---|---|---|---|
| `--marca-gris` | `#6E7A7B` | Color dominante del lockup | Texto institucional, barra superior, autoridad |
| `--marca-verde` | `#006B39` | Verde del escudo | Estados positivos, acento de marca, enlaces |
| `--marca-oro` | `#D8AE23` | Oro del escudo | Atención suave, destacados, advertencia leve |

**No hay azul en ningún tono.** Es la corrección explícita sobre el sistema actual, que usaba
`#12395f` sin que viniera de la marca.

---

## 2. Tokens

### 2.1 Color

```css
:root {
  /* marca — del logo, no se inventan */
  --marca-gris:  #6E7A7B;
  --marca-verde: #006B39;
  --marca-oro:   #D8AE23;

  /* superficie */
  --sup-fondo:   #F6F5F2;   /* cálido, no el gris azulado típico de dashboard */
  --sup-panel:   #FFFFFF;
  --sup-borde:   #DDD9D2;
  --sup-borde-fuerte: #B9C2C2;

  /* texto */
  --texto:       #2B3130;
  --texto-sec:   #5B6462;
  --texto-inv:   #FFFFFF;

  /* estado — desaturados, informan sin gritar */
  --estado-ok:      #1F7A4C;
  --estado-ok-bg:   #E7F2EA;
  --estado-alerta:      #9A6B0E;
  --estado-alerta-bg:   #FBF1DD;
  --estado-error:      #A3352E;
  --estado-error-bg:   #FBEAE8;
  --estado-neutro:     #5B6462;
  --estado-neutro-bg:  #ECEAE6;
}
```

Nota sobre `--sup-fondo`: se elige un blanco roto cálido (no el `#f4f6f8` azulado del sistema
actual) porque el gris azulado es exactamente la firma visual de un dashboard SaaS genérico; un
fondo cálido tira hacia "papel", coherente con la dirección de "documento oficial interactivo".

### 2.2 Tipografía — decisión deliberada, no genérica

Dos familias, cada una con un trabajo distinto, ambas del sistema (sin CDN):

```css
:root {
  --f-titulo: Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
  --f-dato:   -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --f-codigo: ui-monospace, "Cascadia Mono", Consolas, monospace;
}
```

**Por qué una serif para títulos:** los documentos oficiales de la Gobernación (decretos, oficios,
actas) se tipografían tradicionalmente en serif. Usar una serif del sistema en los encabezados de
sección (`h1`, `h2`, nombre de sede, nombre de municipio) ancla el sistema a ese lenguaje sin salir
de fuentes ya instaladas en cualquier equipo con Windows/macOS. Los datos, tablas y controles de
formulario se quedan en la sans del sistema (`Segoe UI` en los equipos de la Gobernación) porque ahí
lo que importa es la lectura rápida de cifras, no el carácter.

Esto es lo que separa el resultado de "un dashboard más": la mezcla serif/sans con ese criterio no
aparece en plantillas genéricas, que casi siempre usan una sola sans para todo.

Escala:

```css
:root {
  --t-h1: 1.5rem;   --t-h2: 1.15rem;  --t-h3: 1rem;
  --t-base: .92rem; --t-peq: .8rem;   --t-mini: .72rem;
}
```

### 2.3 Espaciado

Escala de 4px, ya implícita en el CSS actual (`.4rem`, `.8rem`...) — se formaliza:

```css
:root {
  --e-1: .25rem; --e-2: .5rem; --e-3: .75rem; --e-4: 1rem; --e-5: 1.5rem; --e-6: 2rem;
}
```

### 2.4 Bordes, radio y elevación

```css
:root {
  --radio: 3px;         /* antes 6px. Más recto = menos "app", más "formulario" */
  --radio-pill: 3px;    /* las etiquetas de estado dejan de ser píldora — ver §3.3 */
  --borde: 1px solid var(--sup-borde);
}
```

**Se elimina la sombra difusa (`--sombra`) de tarjetas y paneles.** Los paneles se delimitan con
borde real (`1px solid`), no con sombra — es la diferencia entre "tarjeta flotando" (SaaS) y "hoja
delimitada" (documento). La sombra se conserva **solo** para el diálogo modal, donde sí cumple una
función (indicar que está por encima del resto de la pantalla).

---

## 3. Componentes base

### 3.1 Barra superior — con el logo real

Reemplaza `.barra`. Fondo `var(--marca-gris)`, no verde ni azul — el gris es "color de autoridad"
según el propio HANDOFF. El logo (que ya trae el lockup completo con el escudo) se muestra en vez
de repetir el nombre en texto.

```
┌──────────────────────────────────────────────────────────────────┐
│ [logo-sed-caldas.png]        Sistema de reconstrucción de sedes   │
│                                            Uso interno · v0.1.0   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Migas de pan (breadcrumb) — navegación principal, no sidebar

Componente nuevo, central para el módulo 2. Reemplaza cualquier idea de sidebar con íconos (patrón
de dashboard genérico) por una ruta literal, porque el propio modelo mental del sistema ya es
jerárquico: Caldas → municipio → sede.

```
Caldas  ›  Riosucio  ›  I.E. La Milagrosa - Sede Principal
```

- Cada segmento es clicable y vuelve a ese nivel.
- El segmento activo va en `--f-titulo` (serif), los anteriores en `--f-dato` con `--texto-sec`.
- Persiste en toda pantalla de los módulos 2 y 3.

### 3.3 Estado — franja de color, no píldora

Se reemplaza `.et` (píldora redondeada) por una franja izquierda + texto, más cercano a un sello
sobre un documento que a una etiqueta de app:

```css
.estado {
  display: inline-flex; align-items: center; gap: var(--e-2);
  padding: var(--e-1) var(--e-2);
  border-left: 3px solid var(--color-estado);
  background: var(--fondo-estado);
  font-size: var(--t-peq); font-weight: 600;
  border-radius: 0 var(--radio) var(--radio) 0;
}
```

En tablas, la misma franja se aplica al borde izquierdo de la fila completa (`tr` con
`border-left`), de modo que el estado se lee de un vistazo bajando la vista por la columna izquierda
— igual que un radicado físico con un sello de color en el margen.

### 3.4 Tabla densa — se conserva casi tal cual

La tabla actual (`table`, `th`, `td.num`) ya cumple el principio de "el dato manda": tabular-nums,
alineado a la derecha, encabezado en mayúscula pequeña. Se mantiene. Cambia solo:
- El fondo de `th` pasa de `#eef2f6` (azulado) a un derivado de `--marca-gris` muy claro.
- El hover de fila (`tbody tr:hover`) usa `--sup-fondo` en vez de un azul clarísimo.

### 3.5 Bloque métrica (KPI) — número, no gráfico

Se mantiene `.metrica` (número grande + etiqueta), **sin añadir donuts, gauges ni sparklines**: son
el adorno decorativo típico de dashboard que el criterio "el dato manda sobre el adorno" descarta.
Cambia el color del número de `--azul` a `--marca-gris`, y el número usa `--f-titulo` (serif) para
que un panorama de métricas se lea con la misma voz tipográfica que los títulos de sección.

### 3.6 Botones, notas, diálogo — se conservan, se recolorean

La geometría de `.btn`, `.nota` (franja izquierda) y `.dialogo` ya sigue el criterio correcto — no
se rediseñan. Solo se remapean sus variables de color: `--azul` → `--marca-gris`,
`--verde` (`#1d7a55`) → `--marca-verde` (`#006B39`), `--ambar` → `--marca-oro`.

---

## 4. Qué se conserva literalmente de `styles.css`

Sin cambios de fondo, porque ya cumplen el criterio:

- Los helpers de grilla `.rejilla`, `.r2`, `.r3`, `.r4`.
- La estructura de formulario (`label`, `input`, `.campo`).
- `.tabla-scroll`, `.avance` (barra de progreso simple, sin decoración).
- `.firma-caja`, `.fotos` — patrones ya funcionales y sobrios.

---

## 5. Construcción — archivos a tocar

Solo presentación: **no se toca `consola.js`, `almacen.js`, `api.js` ni `storage.js`** en esta fase.

| Archivo | Acción |
|---|---|
| `web/assets/css/tokens.css` | Nuevo. Variables de §2 |
| `web/assets/css/styles.css` | Se edita in situ (no se reescribe): reasignar variables, quitar `--sombra` de tarjetas, franja de estado en vez de píldora, `--f-titulo` en encabezados |
| `web/consola.html`, `web/index.html` | `<link>` a `tokens.css` antes de `styles.css`; reemplazar el `<style>` inline de la barra por la versión con logo (§3.1) |

Pasos, en orden:

1. Crear `tokens.css` con las variables completas.
2. En `styles.css`, sustituir cada variable vieja por la nueva **sin renombrar las clases que la
   consumen** (`.btn`, `.tarjeta` siguen llamándose igual; cambia el valor, no el selector) — así
   el cambio queda contenido en CSS y no obliga a tocar el HTML que genera `consola.js`.
3. Quitar `--sombra` de `.tarjeta` y `.metrica`; conservarla solo en `.dialogo`.
4. Convertir `.et` y sus 8 modificadores (`.e-pendiente` … `.e-aprobado`) de píldora a franja (§3.3),
   **manteniendo los mismos nombres de clase** — es el mismo motivo del punto 2.
5. Insertar el logo real en la barra superior de ambos HTML.
6. Subir versión con `python tools/versionar.py`.

**Riesgo a vigilar:** `consola.js` genera esas clases (`.et.e-radicado`, etc.) desde JS. Si en algún
punto se renombra una clase en vez de solo su regla CSS, hay que tocar JS — y esta fase es
puramente visual, así que ese renombre no debería pasar aquí.

## 6. Verificación de cierre

- [ ] `consola.html` abre sin errores de consola (`tools/servir.py`).
- [ ] Comparación visual antes/después de panorama, tabla filtrada y modal de verificación.
- [ ] Ningún azul (`#12395f`, `#1f6fb2`, `#0c2842`) queda en `styles.css` ni en `<style>` inline.
- [ ] Las 8 etiquetas de estado se ven como franja, no píldora.
- [ ] El logo real aparece en la barra superior.
- [ ] Versión subida (`?v=`), sin CSS cacheado.

Solo con esto en verde se pasa a fase 1.
