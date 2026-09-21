# Backend — Google Apps Script (D-19)

Código fuente del backend. Se mantiene aquí para tener historial y revisión, pero **se despliega
pegándolo a mano en script.google.com** — no hay `clasp` configurado todavía. Cada vez que se edite
un archivo `.gs` acá, hay que copiar el cambio también al proyecto real.

## Desplegar desde cero (Paso 0 del plan)

1. **Crear un Google Sheet nuevo** con el Gmail personal desde el que se despliega
   `circular122` (D-19 precisada — el dominio institucional es Microsoft 365, no existe cuenta de
   Google con ese correo). Nombrarlo, por ejemplo, "Reconstrucción de sedes — backend".

2. **Extensiones → Apps Script.** Se abre un proyecto ligado a ese Sheet.

3. Crear un archivo de script por cada uno de los que hay en esta carpeta (`Setup`, `Codigo`,
   `Auth`, `Sedes`, `Backup`, `Presupuestos`, `Verificaciones` — el nombre del archivo en Apps Script
   no necesita la extensión `.gs`) y pegar el contenido tal cual.

4. **Ejecutar `crearHojas` una vez** (desplegable de funciones, arriba del editor → seleccionar
   `crearHojas` → ▶ Ejecutar). Autorizar los permisos que pida. Esto crea las 6 pestañas con las
   columnas exactas de `CLAUDE.md` §6.

4.b **Ejecutar `configurarRespaldoAutomatico` una vez** (mismo mecanismo, archivo `Backup`). Crea un
   disparador que copia el Sheet completo a una carpeta de Drive todos los días — ver
   `docs/RUNBOOK_CONTINUIDAD.md`. Pedirá autorizar permisos de Drive además de los de Sheets.

5. **Cargar los datos reales:**
   ```bash
   python tools/build_catalogo.py
   python tools/generar_usuarios_borrador.py
   python tools/exportar_backend.py
   ```
   Produce `data/generado/backend_sedes.csv` y `data/generado/backend_usuarios.csv`. En el Sheet:
   `Archivo → Importar → Subir`, elegir el CSV, **"Reemplazar datos en la hoja actual"**, con la
   pestaña correspondiente (`Sedes` o `Usuarios`) ya seleccionada antes de importar.

6. **Desplegar como Web App:** `Implementar → Nueva implementación → Aplicación web`.
   `Ejecutar como: Yo`, `Quién tiene acceso: Cualquiera`. Copiar la URL `/exec` — es la que va en
   `ENDPOINT_URL` del frontend.

7. **Probar sin frontend**, con `curl` o Postman:
   ```bash
   curl "https://script.google.com/macros/s/TU_ID/exec"
   curl -X POST "https://script.google.com/macros/s/TU_ID/exec" \
     -d '{"accion":"solicitarCodigo","correo":"data@sedcaldas.edu.co"}'
   ```
   El segundo comando debe hacer llegar un correo con un código de 6 dígitos. Con ese código:
   ```bash
   curl -X POST "https://script.google.com/macros/s/TU_ID/exec" \
     -d '{"accion":"validarCodigo","correo":"data@sedcaldas.edu.co","codigo":"123456"}'
   ```
   Responde `{"ok":true,"token":"...","rol":"ADMINISTRADOR",...}`. Ese `token` es el que se manda
   en `listarSedes` y en todo lo que se agregue después.

## Qué hay hecho y qué falta (ver `docs/PLAN_DESARROLLO.md` §3 para el orden completo)

| Archivo | Qué resuelve | Paso del plan | Desplegado |
|---|---|---|---|
| `Setup.gs` | Crea las 6 pestañas con las columnas de `CLAUDE.md` §6 | Paso 0 | ✅ |
| `Codigo.gs` | `doGet` (ping) + `doPost` con registro de acciones | Paso 0 | ✅ |
| `Auth.gs` | Login por código de un solo uso, token de sesión firmado (D-20) | Paso 1 | ✅ |
| `Sedes.gs` | Listado de sedes filtrado por rol/alcance del lado del servidor (D-6, D-24, D-25) | Paso 2 | ✅ |
| `Backup.gs` | Respaldo diario del Sheet completo a Drive, con retención de 30 días (D-38) | — resiliencia, no es un paso del plan | ✅ |
| `Presupuestos.gs` | Guardar/obtener presupuesto, versionado real sin sobrescritura (D-37), historial completo | Paso 3 | ✅ |
| `Verificaciones.gs` | Bandeja departamental + emitir concepto (D-21, D-22, D-39) | Paso 4 | ✅ desplegado y probado en producción 2026-09-21 |

**Falta:** enrutado y migas del frontend real (hoy solo existe el mockup estático — `docs/diseno/mockup_v6.html`
ya llama al backend real desde ahí), Hallazgos (Paso 6), y el PDF y correo de confirmación. Cada uno
se agrega como una entrada nueva en el objeto `manejadores` de `Codigo.gs`, sin tocar lo que ya
funciona. **`Presupuestos.gs` (D-40) y `Verificaciones.gs` ya están pegados y desplegados** sobre la
implementación existente ("Paso 0 — 6 pestañas..."). `obtenerBandejaVerificacion`/`emitirConcepto`
se probaron de punta a punta contra el backend real (login, radicación, concepto, D-39 confirmado
con mutación de una sola celda y con el candado de concurrencia). **Cargas también confirmado en
producción el mismo día**: `guardarPresupuesto` con `origen: CARGA` desde Administrador, con
`ingesta_ARANZAZU.json` real — ver `docs/PLAN_DESARROLLO.md` Paso 5 para el detalle.

## Decisiones que este código ya aplica

- **D-20** — código de un solo uso, nunca se revela si un correo tiene cuenta.
- **D-6** — `valor_referencia` no llega al navegador de un Responsable de sede.
- **D-24 / D-25** — alcance por municipio (alcalde), por lista de sedes (rector), departamental sin
  restricción (Verificador).
- El secreto de firma de los tokens se genera solo y se guarda en las Propiedades del script — no
  vive en ningún archivo de este repo.
- **D-38** — `validarCodigo` bloquea un código tras 5 intentos fallidos; respaldo diario automático;
  ver `docs/RUNBOOK_CONTINUIDAD.md` para qué hacer si la cuenta que despliega esto deja de estar
  disponible.
- **D-37** — `Presupuestos_guardar` nunca sobrescribe una fila: cada guardado agrega una versión
  nueva y solo apaga `vigente` en la anterior (`Presupuestos.gs::_presupuestoVigente`).
- **D-27** — `valor_referencia` vive únicamente en `Sedes`; `Presupuestos_guardar` nunca la lee, la
  copia ni la sobrescribe.
- **D-39** — `Verificaciones_emitir` extiende la misma excepción de D-37 al campo `estado`: un único
  `setValue` dirigido sobre la fila vigente, nunca una versión nueva, porque el concepto no cambia el
  contenido del presupuesto. El registro de auditoría completo vive aparte, en `Verificaciones`.
- **D-40** — `Presupuestos_guardar` admite `origen: CARGA` desde el rol `VERIFICADOR` además de
  `MANUAL` desde `RESPONSABLE_SEDE`/Administrador.
