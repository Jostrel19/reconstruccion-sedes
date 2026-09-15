# HANDOFF — Rediseño del instrumento a sistema de gestión

**Fecha de la decisión:** 2026-09-09
**Para retomar:** 2026-09-10
**Estado:** definido el rumbo, **bloqueado por insumos** (ver §6)

---

## 1. Qué cambia

Hasta hoy el instrumento era un **formulario para que 26 alcaldes digitaran**. A partir de mañana
es un **sistema interno de consolidación y seguimiento que opera el practicante**.

| | Antes | Ahora |
|---|---|---|
| Quién digita | Cada alcalde, sede por sede | Nadie digita: se **carga el Excel** que manda la alcaldía |
| Entrada | Formulario web con token | Archivo `.xlsx` recibido, analizado y volcado automáticamente |
| Quién opera | 26 personas externas | Una persona interna |
| Qué resuelve | Levantar la información | Levantar, **centralizar y hacerle seguimiento** |

El giro es sensato y conviene decirlo con todas las letras: **elimina la dependencia de que 26
alcaldías aprendan a usar una herramienta nueva en una semana**, que era el mayor riesgo del plan
anterior. Lo que llega hoy son Excel por correo; el sistema se adapta a eso en vez de pelearlo.

**Costo del cambio, que hay que aceptar a conciencia:** se pierde la validación en origen. El
formulario obligaba a unidad de medida, capítulo de daño, mínimo de fotos y cálculo automático de
A/U/IVA. Un Excel libre no obliga a nada. Por eso el módulo de ingesta **no es un lector de
archivos: es un validador** — ahí se traslada todo lo que antes hacía el formulario.

---

## 2. Qué se conserva del sistema actual

Se toma como base lo construido; no se empieza de cero.

| Pieza | Destino |
|---|---|
| `data/generado/catalogo_sedes.json` — 975 sedes, 26 municipios, 161 I.E. | **Se conserva.** Es la espina dorsal |
| `tools/build_catalogo.py` | **Se conserva.** Sigue siendo la vía para actualizar el catálogo |
| `tools/consolidar.py` — dedup por versión, avance, contraste, pendientes | **Se conserva la lógica**, cambia la fuente: de `.json` a `.xlsx` |
| `tools/vigilar.py` | **Se conserva** |
| `web/assets/js/pdf.js` — formato oficial de 5 secciones | **Se conserva** |
| `web/consola.html` + `consola.js` | **Es el germen del nuevo sistema.** Sobre esto se construye |
| Reglas de negocio de `config.js` (IVA sobre utilidad, umbrales A/U, capítulos, unidades) | **Se conservan** |
| `web/index.html`, `tablero.js`, `tokens.js`, enlaces por municipio | **Se retiran** (D-18). La lógica de cálculo de `formulario.js` se reutiliza para la edición interna |

Las decisiones D-2 a D-7 y D-11 a D-16 siguen vigentes. **D-2 («el alcalde diligencia») queda
anulada** por este cambio.

---

## 3. Arquitectura objetivo — cuatro módulos

```
┌─ 1. INGESTA ──────────────────────────────────────────────┐
│  Excel de la alcaldía  →  validación  →  registro normalizado │
│  Reporta: qué entró, qué se rechazó y por qué                │
└──────────────────────────────────────────────────────────┘
                              ↓
┌─ 2. INICIO / PANORAMA ────────────────────────────────────┐
│  26 municipios · 975 sedes · avance · alertas             │
│  Entrar a un municipio → sus sedes → una sede             │
└──────────────────────────────────────────────────────────┘
                              ↓
┌─ 3. PRESUPUESTO Y TRAZABILIDAD ───────────────────────────┐
│  El formato oficial por sede, con su historial de versiones │
│  Contraste contra el modelo paramétrico · PDF · exportación │
└──────────────────────────────────────────────────────────┘
                              ↓
┌─ 4. PLAN DE ACCIÓN Y MONITOREO ───── PENDIENTE ───────────┐
│  Estado de ejecución por sede: contrato, avance, entrega   │
│  NO se construye todavía (ver §5)                          │
└──────────────────────────────────────────────────────────┘
```

### Módulo 1 — Ingesta

Lo verdaderamente nuevo. Un Excel de alcaldía se convierte en registro solo si pasa por:

1. **Identificación de la sede.** Cruce por `DANE SEDE` de 12 dígitos contra el catálogo. Si el
   Excel no trae DANE o lo trae mal, se cruza por municipio + nombre y **se reporta como dudoso**,
   nunca se resuelve en silencio.
2. **Normalización de cantidades.** Unidades a catálogo cerrado; `mt2`, `M2` y `metro cuadrado` son
   lo mismo. Números en formato colombiano (`1.500.000`).
3. **Recálculo, no lectura.** Costo directo, A, U, IVA y total se **recalculan** desde las
   cantidades. Si el total del Excel no coincide con el recalculado, se reporta la diferencia; manda
   el recalculado.
4. **Clasificación por capítulo de daño.** Necesaria para el contraste contra el modelo. Si la
   alcaldía no la trae, queda «sin clasificar» y aparece en la lista de pendientes de depuración.
5. **Versionado.** Un registro vigente por sede; los reenvíos no pisan, versionan.

**Todo Excel que entra queda archivado tal como llegó.** Es la evidencia de lo que mandó el
municipio y el respaldo de cualquier cifra que se reporte después.

### Los municipios NO mandan el mismo formato

Confirmado por el practicante el 2026-09-09: *«están mandando de distinta forma»*. Esto descarta el
diseño obvio —un lector fijo de columnas— y descarta también la tentación de adivinar el layout por
heurística, que falla en silencio justo cuando dos columnas se parecen.

**Diseño que esto exige: mapeo asistido con perfil por municipio.**

1. La primera vez que llega un Excel de un municipio, el sistema muestra sus encabezados reales y
   pide confirmar qué columna es cuál (DANE, sede, actividad, unidad, cantidad, valor unitario…).
2. Ese mapeo se guarda como **perfil del municipio**.
3. Los envíos siguientes de ese municipio entran solos.
4. Si un Excel llega con encabezados que no coinciden con el perfil guardado, **no se procesa a la
   fuerza**: se avisa que el formato cambió y se pide revisar el mapeo.

Son 26 mapeos que se hacen una vez. Es mucho menos trabajo que depurar a mano 975 sedes, y deja
constancia de cómo se interpretó cada archivo — que es lo que permite defender una cifra después.

### Módulo 2 — Inicio

Pantalla de entrada. Tres niveles de profundidad: **Caldas → municipio → sede**.

Por municipio: sedes totales, radicadas, pendientes, % de avance, costo directo, valor del modelo,
desviación, y alertas (discrepancias, A/U fuera de umbral, sin clasificar).

### Módulo 3 — Presupuesto y trazabilidad

Por sede: el formato oficial de cinco secciones, el historial de versiones con qué cambió entre
una y otra, el contraste contra el modelo, las fotografías, el PDF y la verificación de la SED.

### Módulo 4 — Plan de acción y monitoreo

**Explícitamente aplazado.** Se define cuando exista la información de contratación. Se deja el
espacio previsto en la navegación y el modelo de datos con el `dane_sede` como llave, para que
encaje sin rehacer nada.

---

## 4. Identidad visual

Pedido: profesional, moderno, marca de la Gobernación, paleta pastel corporativa.

**Logo recibido** (2026-09-09): `web/assets/img/logo-sed-caldas.png`, 450×60 px, fondo transparente.
Lockup horizontal «Gobierno de CALDAS | Secretaría de EDUCACIÓN» con el escudo.

**Paleta tomada del propio logo**, no inventada — muestreada de los píxeles del archivo:

| Color | Valor | Uso |
|---|---|---|
| Gris pizarra | `#6E7A7B` | Color dominante del lockup. **Texto institucional y marca** |
| Verde escudo | `#006B39` | Acento institucional. Estados positivos, elementos de marca |
| Oro escudo | `#D8AE23` | Acento de atención. Alertas suaves, destacados |

Sobre esa base se construye la paleta pastel de superficie: fondos muy claros derivados del gris
pizarra, tarjetas blancas, bordes suaves, y los estados (verde, ámbar, rojo) desaturados para que
informen sin gritar. El verde y el oro del escudo dan el tono institucional sin recurrir a un azul
que la marca no usa.

**Consecuencia para el sistema actual:** el azul `#12395f` que usa hoy el aplicativo **no es de la
marca**. Se reemplaza por el gris pizarra como color de autoridad y el verde como acento.

Criterios que no se negocian, porque es un sistema de trabajo y no una campaña:

- **El dato manda sobre el adorno.** Cifras en tabular, alineadas a la derecha, legibles de un
  vistazo.
- **El color significa algo.** Verde, ámbar y rojo se reservan para estado; nunca decorativos.
- **Contraste suficiente.** Pastel en fondos, no en texto.
- Sin dependencias externas: nada de CDN ni tipografías remotas, como hasta ahora.

Queda pendiente el manual de identidad de la Gobernación, si existe: definiría tipografía y usos
mínimos del lockup. Sin él se trabaja con la paleta muestreada, que es fiel al archivo real.

---

## 5. Lo que NO se hace mañana

- **El módulo 4.** Aplazado por decisión expresa.
- **Rehacer el catálogo.** Funciona y está verificado.
- **Rescatar el aplicativo del alcalde.** Se retira (D-18). Lo único que se rescata es la lógica de
  cálculo y el PDF.
- **Tocar `fctMaestra.xlsx` ni ninguna fuente oficial.**

---

## 6. Bloqueantes — sin esto no se puede empezar

| # | Qué se necesita | Por qué bloquea |
|---|---|---|
| **Q-10** | **Excel reales de los que están mandando las alcaldías.** Confirmado que **difieren entre municipios**, así que hacen falta **varios ejemplos distintos**, no uno. Llegan el 2026-09-10 | Bloqueante duro. Sin ver las estructuras reales —hojas, encabezados, dónde va el DANE, celdas combinadas, cantidades como texto— cualquier lector es adivinación, y adivinar aquí es meter cifras mal leídas en un consolidado oficial. Cuantos más ejemplos distintos, mejor queda el mapeo asistido |
| **Q-11** | ¿El aplicativo de los alcaldes se retira, o queda como opción para quien quiera usarlo? | Define si los tokens, los 26 enlaces y `index.html` siguen manteniéndose |
| **Q-12** | «El catálogo que próximamente se subirá»: ¿es una versión actualizada del catálogo de sedes, o un catálogo de precios unitarios para validar los valores de los presupuestos? | Son dos cosas muy distintas y cambian el diseño del módulo 1 |
| ~~Q-13~~ | ~~Logo oficial~~ → **RESUELTO 2026-09-09:** `web/assets/img/logo-sed-caldas.png`. Falta solo el manual de identidad, si existe | — |
| **Q-14** | Qué datos trae el contrato o el mecanismo de ejecución (número, contratista, valor, plazo, actas) | Define el modelo de datos del módulo 4 |

**Q-10 es el único que impide arrancar.** Con ese archivo en mano, mañana se puede tener el módulo
de ingesta leyendo y validando. Sin él, lo único que se puede adelantar es el inicio y la navegación
sobre los datos que ya existen.

---

## 7. Orden sugerido de trabajo

1. Inspeccionar el Excel real y documentar su estructura (no asumirla).
2. Módulo 1: lector + validador + informe de lo rechazado.
3. Módulo 2: inicio y navegación Caldas → municipio → sede.
4. Identidad visual aplicada, con el logo real.
5. Módulo 3: ficha de sede, historial, contraste y PDF.
6. Módulo 4: cuando lleguen los datos de contratación.

Lo primero que hay que probar con el Excel real no es que el sistema lo lea, sino **que rechace bien
lo que está mal**. Un lector que acepta todo es peor que no tener lector.
