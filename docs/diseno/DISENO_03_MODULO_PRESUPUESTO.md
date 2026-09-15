# Diseño — Módulo 3: Presupuesto y trazabilidad (Fase 2)

Consume `DISENO_01` (visual) y se llega a él desde `DISENO_02` (nivel sede de la navegación). No
depende de Q-10.

---

## 1. Objetivo

La ficha de una sede: el formato oficial de cinco secciones, su historial de versiones, el
contraste contra el modelo, las fotografías, el PDF y la verificación de la SED. Hoy esto vive
repartido entre `formulario.js` (edición), `pdf.js` (impresión) y la sección de verificación de
`consola.js`. Este módulo los organiza como **una sola ficha por sede**, no tres pantallas sueltas.

---

## 2. Estructura de la ficha

```
Caldas › Riosucio › I.E. La Milagrosa - Sede Principal          [Descargar PDF]

┌─ Identificación ───────────────────────────────────────────────┐
│ DANE 117xxxxxxxxx · Zona rural · Matrícula 240                  │
│ Tipo censo 3 · Nivel censo: afectación estructural               │
│ Estado: RADICADO · v2 · última actualización 2026-09-12          │
└──────────────────────────────────────────────────────────────────┘

┌─ Contraste contra el modelo ──────────────────────────────────┐
│  Costo directo    $XX.XXX.XXX     ← consola.desviacion(reg)     │
│  Valor del modelo $XX.XXX.XXX                                    │
│  Desviación        +8,3 %                                        │
│  (si sinBase: nota explicando por qué no hay base de comparación)│
└──────────────────────────────────────────────────────────────────┘

┌─ Historial de versiones ──────────────────────────────────────┐
│  v2  RADICADO       $XX.XXX.XXX   2026-09-12   ← vigente         │
│  v1  REQUIERE_AJUSTE $XX.XXX.XXX  2026-09-08                     │
└──────────────────────────────────────────────────────────────────┘

┌─ Formato oficial (5 secciones) ───────────────────────────────┐
│  1. Identificación  2. Afectación  3. Presupuesto  4. Fotos      │
│  5. Verificación (uso interno SED)                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Historial de versiones — diseño concreto

La fuente ya existe: `reg.historico` (array de `{version, estado, total_presupuesto, fecha}`,
`storage.js` líneas 61-77) más el registro vigente (`reg` mismo, que es la última fila implícita).

**No se dibuja como gráfico de líneas ni timeline con iconos.** Es una tabla, igual que el resto del
sistema — coherente con "el dato manda sobre el adorno" y con que aquí lo que importa es comparar
cifras entre versiones, no ver una tendencia bonita:

```
VERSIÓN  ESTADO            TOTAL PRESUPUESTO   FECHA
v2       RADICADO          $XX.XXX.XXX         2026-09-12   ← vigente (franja verde)
v1       REQUIERE_AJUSTE   $XX.XXX.XXX         2026-09-08
```

La fila vigente lleva la franja de estado (§3.3 de `DISENO_01`); las anteriores van en
`--texto-sec`, sin franja — ya no son accionables, son evidencia.

**Qué cambió entre versiones** (diff): para la fase 2 basta mostrar la diferencia de
`total_presupuesto` entre v1 y v2 (`+$X` o `-$X`) al lado de cada fila. Un diff campo por campo de
los ítems del presupuesto es más trabajo y no lo pide el HANDOFF — se deja como mejora futura, no se
construye ahora sin que se pida.

---

## 4. Contraste contra el modelo — reutiliza consola.js sin cambios de fondo

- `consola.valorModelo(dane)` y `consola.desviacion(reg)` se llaman igual.
- Si `valorModelo(dane) === 0` (sede tipo 1-4 sin detalle o tipo 5-6-7), la ficha **no** muestra
  "desviación: 0%" — eso sería falso. Muestra la nota que ya usa el panorama general: sin base de
  comparación, y por qué.

---

## 5. Verificación de la SED (sección 5)

Se conserva el flujo actual de `consola.js` (selector de resultado, observaciones, firma) sin
rediseño funcional — cambia solo la piel visual (tokens de `DISENO_01`). Los 4 resultados
(`consola.RESULTADOS`) y el mapa `ESTADO_SEGUN_RESULTADO` siguen igual, con la advertencia ya
documentada en el HANDOFF de que ese mapeo está pendiente de aval de Planeación (Q-7 en
`CLAUDE.md` §8, resuelto como pendiente confirmado).

---

## 6. PDF

Sin cambios de lógica: `pdf.js` sigue generando el formato de 5 secciones vía iframe e impresión del
navegador. Único ajuste: el encabezado del PDF pasa a usar el logo real en vez de texto plano, si
`pdf.js` no lo hace ya — verificar al implementar.

---

## 7. Construcción — qué se reutiliza, qué es nuevo, qué no cambia

Requiere fase 1 cerrada (necesita el nivel "sede" de la navegación para tener a dónde llegar). No
requiere Q-10.

| Pieza | Origen |
|---|---|
| `consola.valorModelo()`, `consola.desviacion()` | Reutilizado sin cambios |
| `reg.historico` (`storage.js`) | Ya existe en el modelo de datos — solo se visualiza |
| `consola-ficha.js` → `renderFicha(dane)` | **Nuevo.** Arma la ficha a partir de `db.registro(dane)` + los dos anteriores |
| Tabla de historial | **Nueva.** Itera `reg.historico` + fila vigente, con la resta de `total_presupuesto` entre versiones — no hace falta librería de diffing |
| Edición de secciones 1-4 | Se invoca desde la ficha (botón "Editar") reutilizando `formulario.js` tal cual — sus validaciones y cálculos (unidad, capítulo, A/U/IVA) no se tocan |
| Verificación (sección 5) | Se traslada el bloque que hoy pinta un modal en `consola.js` (~línea 480+) para que sea parte de `renderFicha()` en vez de un modal aparte |
| PDF | Se reubica el botón (`pdf.generar(db.registro(...))`, ya existe en `consola.js:507`) — sin cambios de lógica en `pdf.js` |

**Qué NO cambia:** la lógica de cálculo de `formulario.js`, la lógica de `pdf.js`, y el versionado de
`storage.js::guardarRegistro` — ya funcionan correctamente y esta fase solo los lee/reubica.

**Qué no se resuelve en esta fase:** el mapeo `ESTADO_SEGUN_RESULTADO` sigue provisional, pendiente
de aval de Planeación (Q-7). Se traslada tal cual a la ficha unificada, con la misma advertencia
visible.

---

## 8. Verificación de cierre

- [ ] Desde el nivel municipio (fase 1), clic en una sede abre su ficha completa.
- [ ] La ficha muestra identificación, contraste contra el modelo (o la nota de "sin base"),
      historial de versiones y las 5 secciones del formato.
- [ ] Una sede con 2+ versiones en `reg.historico` muestra ambas filas con su diferencia de total.
- [ ] Editar y guardar incrementa la versión correctamente (comportamiento ya existente, solo se
      verifica que la ficha lo refleje).
- [ ] El botón de PDF genera el mismo documento que hoy genera `consola.js`.
- [ ] Guardar una verificación desde la ficha actualiza el estado igual que el modal anterior.

Con esto en verde queda completo el núcleo funcional del sistema (módulos 2 y 3): lo que ya no
depende de ningún bloqueo externo.
