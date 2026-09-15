# Diseño del sistema nuevo — visión, principios y ruta de construcción

**Fecha:** 2026-09-15
**Estado:** diseño cerrado para las fases 0-2; fase 3 diseñada pero bloqueada por Q-10; fase 4 aplazada.

Este archivo es el **índice y el mapa de ruta**. No repite lo que ya está decidido en
[`HANDOFF_REDISENO_SISTEMA.md`](../HANDOFF_REDISENO_SISTEMA.md) (los 4 módulos, qué se conserva del
sistema viejo, D-17/D-18) — lo da por leído y construye la capa de diseño de interfaz encima.

---

## 1. Los archivos de esta carpeta

Un archivo por fase. Cada uno cubre **forma y construcción juntas**: qué se ve, qué se reutiliza del
código existente, qué se crea, y cómo se verifica antes de cerrar la fase. No hay una serie de
diseño separada de una serie de plan — se probó esa separación y quedó redundante (la sección "qué
se reutiliza" terminaba escrita dos veces con distinto título), así que cada `DISENO_0X` es también
el plan de esa fase.

| Fase | Archivo | Cubre |
|---|---|---|
| — | Este archivo | Visión, principio anti-genérico, ruta completa |
| 0 | [`DISENO_01_SISTEMA_VISUAL.md`](DISENO_01_SISTEMA_VISUAL.md) | Tokens, componentes base, archivos a tocar, checklist de cierre |
| 1 | [`DISENO_02_MODULO_INICIO.md`](DISENO_02_MODULO_INICIO.md) | Navegación Caldas → municipio → sede, qué se reutiliza de `consola.js`, checklist |
| 2 | [`DISENO_03_MODULO_PRESUPUESTO.md`](DISENO_03_MODULO_PRESUPUESTO.md) | Ficha de sede, historial, contraste, PDF, verificación, checklist |
| 3 | [`DISENO_04_MODULO_INGESTA.md`](DISENO_04_MODULO_INGESTA.md) | Mapeo asistido y validación. Diseñado, **no se construye** hasta Q-10 |
| 4 | [`DISENO_05_MODULO_MONITOREO.md`](DISENO_05_MODULO_MONITOREO.md) | Placeholder. Aplazado por decisión expresa (Q-14) |

---

## 2. Por qué esto no puede salir genérico

El sistema actual (`web/assets/css/styles.css`) ya tiene el defecto que hay que evitar repetir, y
sirve como catálogo negativo:

| Rasgo actual | Por qué es genérico | Qué dice el HANDOFF al respecto |
|---|---|---|
| Azul `#12395f` como color de marca | Es el azul por default de cualquier plantilla de dashboard corporativo — no viene de ningún lado | «el azul... no es de la marca» (§4) |
| Etiquetas de estado como *pills* redondeadas (`border-radius: 999px`) | Patrón de SaaS gratuito (Notion, Linear, Trello). No comunica autoridad institucional | — |
| Tarjetas blancas con sombra difusa en cada bloque | Estética de landing page, no de instrumento de trabajo | «el dato manda sobre el adorno» (§4) |
| Una sola familia tipográfica para todo | No distingue "esto es un dato" de "esto es un título de sección" | — |

La corrección **no es "aplicar la paleta nueva sobre la misma forma"**. Repintar de verde un
dashboard con pills y sombras sigue siendo el mismo dashboard genérico, solo que verde. El cambio
real está en la *forma*: menos tarjeta-con-sombra, más tabla y ficha con bordes reales; menos pill
de colorines, más franja de estado a la izquierda con texto — como un sello o un radicado físico, no
como una app de gestión de tareas.

Dirección concreta (desarrollada en `DISENO_01`): **el sistema se parece a un documento oficial que
se volvió interactivo**, no a un dashboard de startup. Tipografía con una serif para títulos de
sección (como una gaceta departamental), datos siempre en tabla densa, jerarquía por borde y peso
tipográfico en vez de por color y sombra, y los tres colores de marca (gris pizarra, verde, oro)
sin azul de ningún tono.

---

## 3. Fundamentos que no se negocian

Heredados de `HANDOFF_REDISENO_SISTEMA.md` §4, se repiten aquí porque cada archivo de diseño los
aplica:

- El dato manda sobre el adorno: cifras en tabular, alineadas a la derecha, legibles de un vistazo.
- El color significa algo: verde/ámbar/rojo son estado, nunca decoración.
- Contraste suficiente: pastel en fondos, nunca en texto.
- Sin dependencias externas: nada de CDN, ninguna fuente remota, ningún framework.

---

## 4. Ruta de construcción — 5 fases, en este orden

```
Fase 0 ─ Sistema visual          (tokens + componentes)
   │
   ▼
Fase 1 ─ Módulo Inicio           (navegación Caldas → municipio → sede)
   │
   ▼
Fase 2 ─ Módulo Presupuesto      (ficha de sede, cuelga de la navegación de fase 1)
   │
   ▼
Fase 3 ─ Módulo Ingesta          (BLOQUEADA por Q-10 — diseño listo, no se construye aún)
   │
   ▼
Fase 4 ─ Módulo Monitoreo        (APLAZADA por decisión expresa — Q-14)
```

**Por qué este orden y no otro:**

- **Fase 0 va primero sin excepción.** Si se construye el módulo de Inicio con el estilo viejo y
  después se le cambia la piel, se reescribe dos veces. Los tokens y componentes se hacen una sola
  vez y todo lo demás los consume.
- **Fase 1 antes que fase 2**, porque el módulo de Presupuesto no tiene sentido sin poder llegar a
  una sede primero. La navegación es el esqueleto; la ficha de sede se cuelga de él.
- **Fase 2 no depende de Q-10.** Usa el catálogo de 975 sedes y los paquetes/consolidado que el
  sistema ya produce hoy (`tools/consolidar.py`, `web/assets/js/pdf.js`). Se puede construir en
  paralelo a que se resuelva el bloqueo de ingesta.
- **Fase 3 se diseña pero no se implementa.** El propio HANDOFF es explícito: «cualquier lector es
  adivinación» sin ver el Excel real. Adelantar el diseño de pantallas (`DISENO_04`) sí tiene valor
  porque no depende del formato exacto de columnas — depende del *flujo* (subir → mapear → validar
  → reportar), que sí se puede fijar de antemano.
- **Fase 4 no se diseña todavía**, más allá de reservar el lugar en la navegación y la llave
  (`dane_sede`) en el modelo de datos. Diseñar pantallas sin saber qué datos trae el contrato
  (Q-14) sería inventar campos.

---

## 5. Cómo se construye rápido sin volverse sucio

El proyecto ya tiene la decisión correcta tomada para esto: **sin framework, sin build step**
(convención heredada de `circular122`). Eso es lo que permite que Claude Code sea rápido aquí — no
hay que levantar un toolchain, cada cambio es un archivo `.html`/`.css`/`.js` que se abre directo en
el navegador con `tools/servir.py`.

Reglas para que la velocidad no cueste limpieza:

1. **Un solo archivo de tokens** (`web/assets/css/tokens.css`, fase 0) con las variables de color,
   tipografía y espaciado. Ningún color ni tamaño se escribe suelto en otro archivo — siempre
   `var(--algo)`. Esto es lo que permite que cambiar un color de marca sea editar una línea, no
   perseguir hex codes por 10 archivos.
2. **`styles.css` se refactoriza in situ, no se reescribe.** Ya usa variables para casi todo
   (`var(--azul)`, `var(--radio)`, etc.), así que gran parte del trabajo de fase 0 es renombrar y
   reasignar esas variables, no rehacer las reglas. Ver el detalle en `DISENO_01` §5.
3. **`consola.js`/`consola.html` es la base, no una pantalla más.** El HANDOFF ya lo señala como
   «el germen del nuevo sistema». Los módulos 2 y 3 se construyen *ampliando* ese archivo (o
   dividiéndolo cuando crezca demasiado para mantenerlo en uno solo), no creando una tercera
   pantalla paralela que duplique lógica de `almacen.js`/`api.js`.
4. **Componentes como funciones que devuelven HTML**, siguiendo el patrón que ya usa `consola.js`
   (funciones `render*()`). Nada de plantillas nuevas ni de un sistema de componentes aparte — es
   el patrón que el proyecto ya eligió y que Claude Code puede extender sin fricción.
5. **Cada fase se verifica en el navegador antes de pasar a la siguiente** (regla ya vigente del
   proyecto para cambios de UI). No se avanza a fase 2 con fase 1 sin probar.

---

## 6. Qué sigue dependiendo de alguien fuera de este documento

- **Manual de identidad de la Gobernación**, si existe (pendiente desde el HANDOFF). Sin él, fase 0
  trabaja con la paleta muestreada del logo, que es fiel al archivo real pero no oficial en el
  sentido de "manual aprobado".
- **Q-10** (Excel reales de alcaldías) — bloquea fase 3.
- **Q-12** (catálogo de sedes actualizado vs. catálogo de precios unitarios) — afecta el diseño de
  fase 3 en cuanto se resuelva.
- **Q-14** (datos del contrato/mecanismo de ejecución) — bloquea el diseño de fase 4.

Ninguno de estos bloquea fases 0-2, que es donde arranca la construcción.
