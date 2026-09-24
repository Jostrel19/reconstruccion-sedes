# Caso de uso de éxito — recorrido de aceptación en real

**Para qué sirve:** demostrar, con datos reales y en el sistema desplegado, que el sistema cumple su
propósito: **registrar** presupuestos, **controlarlos** (verificación técnica y hallazgos) y
**seguirlos** sede por sede, y que queda listo para el **seguimiento de obra**. Es a la vez el guion de
la presentación al jefe y la prueba de aceptación: se recorre **una vez, en orden**; lo que falle se
anota, se corrige y se repite solo ese paso. No se prueban pantallas sueltas fuera de este orden.

**Fecha de redacción:** 2026-09-24. **Sistema:** `mockup_v6.html` + backend Apps Script (D-19).

---

## La historia que cuenta

> El sismo del 10 de agosto de 2026 dejó sedes afectadas en 26 municipios. Las alcaldías mandan sus
> presupuestos de dos formas: unas en Excel, otras diligenciándolos directamente. La Secretaría
> necesita saber, para cada sede, **cuánto cuesta repararla, si un arquitecto lo avaló y en qué va**.

Dos caminos de entrada, un solo registro:

| Camino | Quién | Dato real que se usa |
|---|---|---|
| **A. Diligenciado a mano** (D-33) | Responsable de sede (alcalde/rector) | Aranzazu, `217050000060` ESCUELA RURAL BUENOS AIRES — los mismos ítems de su radicado de prueba ($659.500 de costo directo) |
| **B. Carga de Excel** (D-23, D-41) | Arquitecto (Verificador) o Administrador | Samaná, `PRESUPUESTO ESTIMADO I.E.xlsx F.xlsx` leído por `tools/ingesta.py SAMANA --json`: 77 filas, **51 volcables** por $102.977.300 de costo directo |

---

## Antes de empezar

- [ ] Desplegados los `.gs` vigentes (nueva versión de la implementación existente): al 2026-09-24
      faltan `Presupuestos.gs` (D-45 + `volcarCarga`), `Codigo.gs` (registra `volcarCarga`) y
      `Sedes.gs` (`archivo_origen` en el resumen).
- [ ] `data/generado/ingesta_SAMANA.json` regenerado (`python tools/ingesta.py SAMANA --json`).
- [ ] Un usuario **Responsable de sede de prueba** con alcance ARANZAZU (se desactiva al terminar).
- [ ] Sesión de Administrador abierta en otra ventana o navegador.

---

## El recorrido

### 1. Registrar — camino A (Responsable de sede)

| # | Acción | Se verifica |
|---|---|---|
| 1.1 | Entrar con el correo de prueba → llega el código → entrar | Solo ve **su** municipio; no ve Lotes, Verificación ni Usuarios |
| 1.2 | Buscar `217050000060` → Ficha → «Editar presupuesto» | Identificación y tipo del censo precargados; el DANE no se digita |
| 1.3 | Ítems por capítulo, A/U, plazo, descripción (≥ 60 caracteres). **Guardar borrador** | Aviso: la versión radicada anterior **sigue vigente** (D-45) |
| 1.4 | Adjuntar una foto de celular | Miniatura visible en Registrar y en la Ficha |
| 1.5 | **Radicar** → revisar el resumen → confirmar | Número de radicado `217050000060-vN`; **correo de confirmación recibido** |

### 2. Registrar — camino B (Administrador o arquitecto)

| # | Acción | Se verifica |
|---|---|---|
| 2.1 | Cargas → subir `ingesta_SAMANA.json` | 77 leídas · 51 premarcadas · 18 «sin valor» · 7 «no está en el catálogo» · 1 repetida. Errores y advertencias del lector visibles |
| 2.2 | Volcar las 51 | Termina en tandas de 10 con contador; diálogo «51 radicados nuevos · N s» |
| 2.3 | Subir **otra vez** el mismo archivo | 51 «Ya volcada desde este archivo», 0 marcadas (no se duplica) |
| 2.4 | (Opcional) Un JSON de DANE propuesto (Belalcázar): elegir 1 sede en el desplegable y volcarla | Queda un **hallazgo de advertencia** «DANE confirmado a mano» |

### 3. Controlar — verificación técnica y hallazgos (Administrador/arquitecto)

| # | Acción | Se verifica |
|---|---|---|
| 3.1 | Verificación | La bandeja trae el radicado de Aranzazu y los de Samaná, con **días esperando** y semáforo |
| 3.2 | Abrir Aranzazu → emitir concepto «Corresponde» con observación | Estado pasa a **Aprobado**; sale de la bandeja; la Ficha muestra quién, cuándo y qué dijo |
| 3.3 | Emitir «Corresponde parcialmente» a una sede de Samaná | Estado **Requiere ajuste** (D-22) |
| 3.4 | Hallazgos | Los detectados solos al radicar o volcar (AIU sobre el umbral, DANE propuesto si se hizo 2.4); textos sin referencias internas. Marcar uno resuelto → queda quién lo resolvió |

### 4. Seguir — control y seguimiento (cualquier rol interno)

| # | Acción | Se verifica |
|---|---|---|
| 4.1 | Lotes → crear «Fase 1 — demostración» con Aranzazu 060 + las de Samaná | Tablero filtrado por el lote: conteos y valor radicado cuadran con lo volcado |
| 4.2 | Tablero | Radicadas, en verificación, aprobadas y valor radicado por municipio (barras por estado); bitácora con los movimientos del día |
| 4.3 | Ficha de Aranzazu 060 | Historial de versiones (ninguna borrada), cruce daño↔capítulo, línea de tiempo: borrador → radicado → concepto → fotos |
| 4.4 | Exportar a Excel (CSV) desde el Tablero y desde el lote | Abre en Excel con tildes y columnas correctas |
| 4.5 | Responsable de sede (sesión de 1.1) vuelve a entrar | Ve el concepto del arquitecto en su Ficha |

### 5. Obra — lo que el sistema deja listo

Hoy el ciclo termina en **Aprobado**: es exactamente el punto donde empieza la contratación. Lo que ya
sirve para el seguimiento de obra: cada sede tiene un **valor aprobado, versionado y avalado por un
arquitecto con nombre y fecha**, fotos del daño como línea base, lotes para agrupar la fase de
ejecución, y una línea de tiempo por sede a la que se le agregan eventos.

**Lo que falta y de quién depende (Q-14):** qué datos del contrato o mecanismo de ejecución se van a
registrar. No se inventan: se definen con el jefe/Planeación antes de construir el módulo 4 (D-17).

### 6. Cierre

- [ ] Desactivar el Responsable de sede de prueba → su sesión se corta en ≤ 5 min.
- [ ] Anotar resultados, tiempos y fallas en `docs/REGISTRO_DESARROLLO.md`.

---

## Resultado de la corrida

| Paso | Resultado | Observación |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
