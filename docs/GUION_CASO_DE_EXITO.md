# Caso de uso de éxito — recorrido de aceptación en real (hito 1)

**Para qué sirve:** demostrar, con datos reales y contra el backend desplegado, que el sistema cumple su
propósito: **registrar** presupuestos, **controlarlos** (verificación técnica, correo al municipio y
hallazgos) y **seguirlos** sede por sede, y que queda listo para el **seguimiento de obra**. Es a la vez
el guion de la presentación al jefe (hito 2) y la prueba de aceptación del hito 1
(`docs/PLAN_DESARROLLO.md` §3.c): se recorre **una vez, en orden**; lo que falle se anota, se corrige y se
repite solo ese paso. No se prueban pantallas sueltas fuera de este orden.

**Redactado:** 2026-09-24. **Actualizado:** 2026-09-25, con lo del hito 0 (Inicio, Sedes con las 975,
«Contar sobre», lista «Antes de radicar», precarga de la Ficha, Lotes sin recarga, correo del concepto,
accesibilidad). **Sistema:** `app/` servido en local (se publica en el hito 3) + backend Apps Script (D-19).

> **Esto escribe datos reales y envía correos reales.** Todo lo que se radique, cargue o verifique queda
> en el Sheet (nada se borra, D-37). Los datos de prueba se quedan para la demostración y se quitan antes
> de invitar municipios reales (decisión del hito 2).

---

## La historia que cuenta

> El sismo del 10 de agosto de 2026 dejó sedes afectadas en 26 municipios. Las alcaldías mandan sus
> presupuestos de dos formas: unas en Excel, otras diligenciándolos directamente. La Secretaría
> necesita saber, para cada sede, **cuánto cuesta repararla, si un arquitecto lo avaló y en qué va**.

Dos caminos de entrada, un solo registro:

| Camino | Quién | Dato real que se usa |
|---|---|---|
| **A. Diligenciado a mano** (D-33) | Responsable de sede (alcalde/rector) | Aranzazu, `217050000060` ESCUELA RURAL BUENOS AIRES (tipo 3 en el censo; ya tiene un radicado v1 de pruebas anteriores) — los mismos ítems de su radicado de prueba ($659.500 de costo directo) |
| **B. Carga de Excel** (D-23, D-41) | Arquitecto (Verificador) o Administrador | Samaná, `PRESUPUESTO ESTIMADO I.E.xlsx F.xlsx` leído por `tools/ingesta.py SAMANA --json` (el 2026-09-24: 77 filas, **51 volcables** por $102.977.300 de costo directo) |

**Personas en la corrida.** Dos sesiones a la vez, en dos navegadores (o una ventana normal y una
privada, porque la sesión vive en `sessionStorage` de cada pestaña):

- **Administrador** — la cuenta de siempre.
- **Responsable de sede de prueba** — alcance `ARANZAZU`, tipo `alcalde`, con un correo al que el
  practicante tenga acceso. **El correo no se escribe en este documento: el repositorio es público.**

**Correos que gasta la corrida** (cupo de la cuenta personal: 100 al día, medido el 2026-09-25): ≈ 4
códigos de ingreso + 2 confirmaciones de radicado + 2 avisos de concepto ≈ **8**. Los conceptos sobre
presupuestos de Cargas no envían correo.

---

## Antes de empezar

- [x] Backend al día: `Presupuestos.gs`, `Codigo.gs` y `Sedes.gs` confirmados el 2026-09-25;
      `Verificaciones.gs` (correo del concepto) desplegado el 2026-09-25.
- [ ] Servidor local arriba: `python -m http.server 8779 --bind 127.0.0.1 --directory app` (o la
      configuración `app-local`) y abrir `http://localhost:8779`. **Recargar forzando** (Ctrl+F5) la
      primera vez, para que el navegador tome `?v=3` y no scripts viejos de la caché.
- [ ] `data/generado/ingesta_SAMANA.json` regenerado (`python tools/ingesta.py SAMANA --json`); anotar
      las cifras que imprime el lector, que son las que se comparan en 2.1.
- [ ] Una foto tomada con celular (jpg), para 1.5.
- [ ] Cronómetro a mano: los pasos marcados con ⏱ se miden.

---

## El recorrido

### 0. Preparar (Administrador)

| # | Acción | Se verifica |
|---|---|---|
| 0.1 | Entrar como Administrador → llega el código → entrar | Abre en **Inicio**: «Hola, …», tarjetas de «Requiere su atención» con cifra y botón, «Cómo vamos» y últimos movimientos. La pestaña del navegador dice «Inicio — Reconstrucción de sedes» |
| 0.2 | Usuarios → agregar el Responsable de sede de prueba (alcance ARANZAZU) | Aparece activo con su alcance |
| 0.3 | Sedes | **975 sedes** en los municipios; el pie dice el criterio («oficiales, activas y con matrícula; sin Manizales») |
| 0.4 | Selector «Contar sobre» → «Con daño reportado (tipos 1 a 4)» | Las cifras de Sedes y Tablero se recalculan y el pie lo declara; volver a «Todas» |

### 1. Registrar — camino A (Responsable de sede)

| # | Acción | Se verifica |
|---|---|---|
| 1.1 | Entrar con el correo de prueba → llega el código → entrar | Abre en **Inicio** con sus tareas (Devueltas para ajuste, Borradores sin radicar, Con daño y sin presupuesto, En verificación), la tabla «Sedes que requieren su acción» y los 4 pasos. El menú lateral solo tiene **Inicio y Sedes**: no ve Tablero, Verificación, Cargas, Lotes, Hallazgos ni Usuarios. Solo ve Aranzazu |
| 1.2 | Buscar `217050000060` → Ficha → «Editar presupuesto» | Identificación y tipo del censo precargados; el DANE no se digita |
| 1.3 | Mirar el panel **«Antes de radicar»** antes de tocar nada | Dice qué falta (en rojo) y qué se recomienda (en dorado), o «Listo para radicar»; cada pendiente lleva a su sección |
| 1.4 | Ítems por capítulo, A/U (A 25 %, como declara Aranzazu), plazo, descripción (≥ 60 caracteres). **Guardar borrador** | La lista pasa a «Listo para radicar» con el aviso de A/U; aviso de que la **v1 radicada sigue vigente** (borrador en espera, D-45) |
| 1.5 | Adjuntar la foto de celular | Miniatura visible en Registrar y en la Ficha; el aviso «sin fotografías» desaparece de la lista |
| 1.6 | **Radicar** → revisar el resumen → confirmar | Número de radicado `217050000060-vN`; **correo de confirmación recibido** en el buzón de prueba |

### 2. Registrar — camino B (Administrador o arquitecto)

| # | Acción | Se verifica |
|---|---|---|
| 2.1 | Cargas → subir `ingesta_SAMANA.json` | Las cifras del lector anotadas antes (el 2026-09-24: 77 leídas · 51 premarcadas · 18 «sin valor» · 7 «no está en el catálogo» · 1 repetida). Errores y advertencias visibles |
| 2.2 | ⏱ Volcar las marcadas | Termina en tandas de 10 con contador; diálogo «N radicados nuevos · N s». Anotar el tiempo |
| 2.3 | Subir **otra vez** el mismo archivo | Todas «Ya volcada desde este archivo», 0 marcadas (no se duplica) |
| 2.4 | (Opcional) Un JSON de DANE propuesto (Belalcázar): elegir 1 sede en el desplegable y volcarla | Queda un **hallazgo de advertencia** «DANE confirmado a mano» |

### 3. Controlar — verificación, correo y corrección

| # | Acción | Se verifica |
|---|---|---|
| 3.1 | Administrador: Inicio | «Esperando concepto» con la cifra y la antigüedad de la más vieja; el botón lleva a Verificación |
| 3.2 | Verificación | La bandeja trae el radicado de Aranzazu y los de Samaná, con **días esperando** y semáforo |
| 3.3 | Abrir Aranzazu → **devolver**: «Corresponde parcialmente» con una observación concreta (≥ 20 caracteres) | Estado **Requiere ajuste** (D-22); el aviso de la pantalla dice «Se le avisó por correo a quien lo radicó» |
| 3.4 | Buzón de prueba | Correo «Presupuesto devuelto para ajuste - 217050000060-vN»: sede, DANE, municipio, concepto, quién y cuándo, **la observación** y «radique una versión nueva» |
| 3.5 | Responsable de sede: Inicio (Actualizar) | Tarjeta **«Devueltas para ajuste: 1»** y la sede en «Sedes que requieren su acción» con el botón **Corregir**; la Ficha muestra el concepto y la observación |
| 3.6 | «Corregir» → ajustar lo observado → Radicar | Radicado `vN+1`; segundo correo de confirmación; la vN no se borra (historial) |
| 3.7 | Administrador: aprobar la `vN+1` con «Corresponde» | Estado **Aprobado**; deja de contar en «Esperando concepto»; **correo «Presupuesto aprobado»** en el buzón de prueba |
| 3.8 | Emitir «Corresponde parcialmente» a una sede de Samaná | Estado **Requiere ajuste**; **no** se envía correo (vino de Cargas) y el aviso no lo menciona |
| 3.9 | Hallazgos | Los detectados solos al radicar o volcar (AIU sobre el umbral por la A de 25 %, DANE propuesto si se hizo 2.4); textos sin referencias internas. Marcar uno resuelto → queda quién lo resolvió |

### 4. Seguir — control y seguimiento (roles internos)

| # | Acción | Se verifica |
|---|---|---|
| 4.1 | ⏱ Lotes → crear «Fase 1 — demostración» con Aranzazu 060 + las de Samaná | El lote aparece **al instante** (sin esperar la recarga de las 975). Anotar el tiempo |
| 4.2 | ⏱ Quitar una sede del lote y volverla a agregar | Cada operación en unos segundos, sin recargar todo |
| 4.3 | «Contar sobre» → el lote | Tablero: avance, valor por municipio y tipo de afectación cuadran con lo volcado; el pie dice que cuenta sobre el lote |
| 4.4 | Inicio → últimos movimientos | Los del día: radicados, concepto devuelto, corrección, aprobado |
| 4.5 | ⏱ Sedes → Aranzazu → pasar el cursor sobre la fila de 060 un segundo → abrirla | La Ficha abre **con el detalle ya cargado** (precarga). Anotar el tiempo; comparar abriendo una sede de Samaná sin detenerse antes |
| 4.6 | Ficha de Aranzazu 060 | Historial de versiones (ninguna borrada), cruce daño↔capítulo, línea de tiempo: borrador → radicado → devuelto → radicado → aprobado → fotos |
| 4.7 | Municipio de Samaná → filtros «Con presupuesto · Sin presupuesto · Con daño y sin presupuesto» | Los conteos de cada filtro suman el total del municipio |
| 4.8 | Exportar a Excel (CSV) desde el Tablero y desde el lote | Abre en Excel con tildes y columnas correctas |
| 4.9 | Responsable de sede: Inicio | Ya no tiene devueltas; la sede figura aprobada en «Lo último de sus sedes» |

### 5. Accesibilidad — comprobación rápida (Resolución MinTIC 1519 de 2020)

| # | Acción | Se verifica |
|---|---|---|
| 5.1 | Recargar, y sin tocar el ratón pulsar Tab | Lo primero es «Saltar al contenido»; Enter lleva al contenido |
| 5.2 | Recorrer Registrar con Tab | Todo se alcanza y el foco se ve (contorno dorado oscuro) |
| 5.3 | Abrir un diálogo (p. ej. «Quitar sede del lote») y pulsar Tab varias veces, luego Esc | El foco no sale del diálogo; Esc lo cierra y vuelve al botón |
| 5.4 | Ampliar el navegador al 200 % (Ctrl +) en Inicio, Sedes y Registrar | Nada se corta ni obliga a desplazar a lo ancho |

### 6. Obra — lo que el sistema deja listo

Hoy el ciclo termina en **Aprobado**: es exactamente el punto donde empieza la contratación. Lo que ya
sirve para el seguimiento de obra: cada sede tiene un **valor aprobado, versionado y avalado por un
arquitecto con nombre y fecha**, fotos del daño como línea base, lotes para agrupar la fase de
ejecución, y una línea de tiempo por sede a la que se le agregan eventos.

**Lo que falta y de quién depende (Q-14):** qué datos del contrato o mecanismo de ejecución se van a
registrar. No se inventan: se definen con el jefe/Planeación antes de construir el módulo 4 (D-17).

### 7. Cierre

- [ ] Desactivar el Responsable de sede de prueba → su sesión se corta en ≤ 5 min (intentar Actualizar
      en su ventana: debe volver al ingreso con «Su sesión venció o sus permisos cambiaron»).
- [ ] El lote «Fase 1 — demostración» se deja abierto para la presentación del hito 2.
- [ ] Anotar resultados, tiempos y fallas en `docs/REGISTRO_DESARROLLO.md` y en la tabla de abajo.

---

## Resultado de la corrida

| Paso | Resultado | Tiempo (⏱) | Observación |
|---|---|---|---|
| 0 | | | |
| 1 | | | |
| 2 | | 2.2: | |
| 3 | | | |
| 4 | | 4.1: · 4.2: · 4.5: | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
