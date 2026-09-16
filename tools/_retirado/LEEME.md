# Herramientas retiradas — no usar

**Retiradas el 2026-09-16.** Se conservan como evidencia de cómo funcionaba el circuito anterior, no
porque sirvan. **Nada de esta carpeta se ejecuta ni se cita como fuente.**

Pertenecen al circuito que ya retiraron **D-17** (giro a sistema interno) y **D-18** (se quita el
aplicativo de los alcaldes):

> alcalde con enlace + token → paquete `.json` → carpeta de SharePoint → consolidado

Ese camino ya no existe. Hoy el flujo es: el Excel de la alcaldía → lector de `tools/ingesta*.py` →
pantalla de importación del sistema (D-23).

| Archivo | Qué hacía | Por qué se retira |
|---|---|---|
| `consolidar.py` | Carpeta de entregas `.json` → Excel consolidado (D-14) | Ya no hay paquetes `.json`; el consolidado lo reemplaza el backend (D-19) |
| `vigilar.py` | Rehacía el consolidado al llegar un paquete (D-15) | Vigila una carpeta que ya no se alimenta |
| `gen_demo.py` | Recolección simulada de Marulanda para la demostración | **Rompía** (`KeyError: valor_modelo`) desde D-26. Su papel lo cumple `gen_mockup_datos.py` |
| `gen_esquema_flujo.py` | Esquema y columnas para el flujo de Power Automate | El flujo se descartó (§8.1); el backend es Apps Script (D-19) |
| `generar_enlaces.py` | Tokens y enlaces por municipio | D-18 lo dejó sin uso: ya no hay enlace público con token |
| `preparar_publicacion.py` | Verificaba que no se publicara `valor_modelo` | Verifica un campo que ya no existe (D-26) |
| `gen_instructivo.py` | Instructivo en Word para las alcaldías | Instruye sobre el aplicativo retirado |
| `gen_resumen_ejecutivo.py` | Resumen ejecutivo de una página | Describe el estado del sistema anterior |

**D-14 y D-15 pasan a ser históricas.** No se reproponen ni se reviven: quedan como registro de por
qué se eligió ese camino cuando no había backend disponible.

Si alguna vez hace falta algo de aquí, se reescribe contra el modelo de datos actual — no se
descongela. Varios leen campos que el catálogo ya no tiene (`valor_modelo`, `orden_priorizacion`,
`en_alcance`, `nivel_censo`).
