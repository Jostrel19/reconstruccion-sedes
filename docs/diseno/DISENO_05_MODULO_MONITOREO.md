# Diseño — Módulo 4: Plan de acción y monitoreo (Fase 4 — APLAZADA)

**No se diseña todavía a nivel de pantalla.** Decisión expresa en
`HANDOFF_REDISENO_SISTEMA.md` §3 y §5: se define cuando exista la información de contratación
(Q-14: número de contrato, contratista, valor, plazo, actas). Diseñar pantallas antes de saber qué
datos trae el contrato sería inventar campos — exactamente lo que `CLAUDE.md` del proyecto prohíbe
(§7: «no inventar cifras, normas ni decisiones»).

---

## 1. Lo único que se reserva ahora

- **La llave**: `dane_sede`, igual que en los otros tres módulos. Cuando el módulo 4 se diseñe, se
  cuelga de la misma ficha de sede del módulo 3 (`DISENO_03`), no de una pantalla aparte con su
  propio buscador de sede.
- **Un lugar en la navegación**: en la miga de pan / ficha de sede (`DISENO_02`, `DISENO_03`) se dejará
  un espacio para una pestaña o sección "Ejecución de obra", pero mientras Q-14 no se resuelva esa
  sección no se construye ni se muestra como placeholder vacío al usuario final — un espacio vacío
  en un sistema de trabajo se lee como "está roto", no como "está pendiente".

## 2. Qué sí se puede afirmar hoy sobre su forma, sin diseñarla

Por analogía con el módulo 3 (que ya sigue el patrón "ficha + historial + tabla, nunca gráfico
decorativo"), es razonable anticipar que el módulo 4 seguirá el mismo lenguaje visual: estado de
ejecución como franja de color, hitos de avance en tabla o lista, no en línea de tiempo gráfica. Pero
esto es una expectativa de consistencia, no un diseño — se confirma o se corrige cuando lleguen los
datos reales de contratación.

## 3. Construcción — qué se hace en cuanto llegue Q-14

1. Inspeccionar los datos de contratación reales (misma disciplina que con el Excel de Q-10: no
   asumir estructura).
2. Ampliar §1-2 de este archivo con el diseño real de pantallas (estado de ejecución, hitos,
   contraste plazo vs. avance).
3. Añadir aquí mismo, con el mismo nivel de detalle que `DISENO_02`/`DISENO_03`: qué se construye,
   dónde vive el código, qué se reutiliza, checklist de verificación de cierre.
4. Definir si el estado de ejecución se alimenta manualmente (el practicante lo actualiza) o si hay
   una fuente periódica (informes de interventoría, actas) que se pueda cargar como en el módulo de
   ingesta.

## 4. Disparador para retomar este documento

Retomar en cuanto se resuelva **Q-14** (`CLAUDE.md` del proyecto, §8, tabla de pendientes).
