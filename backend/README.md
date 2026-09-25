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
| `Setup.gs` | Crea las pestañas con las columnas de `CLAUDE.md` §6 — desde 2026-09-24 también `Lotes` y `LotesSedes` (D-44) | Paso 0 | ✅ desplegado 2026-09-24; `crearHojas()` corrido (8 pestañas) |
| `Codigo.gs` | `doGet` (ping) + `doPost` con registro de acciones; cada respuesta devuelve `accion` (el navegador descarta respuestas que no son de su pedido); registra `volcarCarga` | Paso 0 | ✅ `accion` desplegado 2026-09-24 · ✅ `volcarCarga` desplegado (confirmado 2026-09-25: el `/exec` publicado la reconoce) |
| `Auth.gs` | Login por código de un solo uso, token de sesión firmado (D-20); el token deja de valer si el usuario se desactiva o cambia de rol/alcance (caché de 5 min) | Paso 1 | ✅ desplegado 2026-09-24 |
| `Sedes.gs` | Listado de sedes filtrado por rol/alcance del lado del servidor (D-24, D-25), con el resumen del presupuesto vigente de cada sede y la bitácora de movimientos; sin `valor_referencia` (D-43); `lote` por sede y lista de lotes (D-44); `archivo_origen` en el resumen, para que Cargas no ofrezca de nuevo lo ya volcado | Paso 2 | ✅ D-43 y D-44 desplegados y probados en real 2026-09-24 · ✅ `archivo_origen` desplegado (confirmado por el usuario 2026-09-25) |
| `Backup.gs` | Respaldo diario del Sheet completo a Drive, con retención de 30 días (D-38) | — resiliencia, no es un paso del plan | ✅ |
| `Presupuestos.gs` | Guardar/obtener presupuesto, versionado real sin sobrescritura (D-37), historial completo; catálogo en caché (`olvidarCatalogo()` tras regenerar `Sedes`); correo de confirmación al radicar a mano; un borrador sobre un radicado queda en espera sin reemplazarlo y los hallazgos solo se detectan al radicar (D-45); `volcarCarga`: Cargas vuelca hasta 15 sedes por pedido bajo un candado, idempotente, sin volcar filas en $0 | Paso 3 | ✅ D-45 y `volcarCarga` desplegados (confirmado 2026-09-25); falta probarlos en real con `docs/GUION_CASO_DE_EXITO.md` |
| `Verificaciones.gs` | Bandeja departamental + emitir concepto (D-21, D-22, D-39) + `_verificacionDe` para la Ficha (D-30); sin `valor_referencia` en la bandeja (D-43) | Paso 4 | ✅ desplegado y probado en producción 2026-09-21; cambio D-43 desplegado y probado 2026-09-24; **aviso por correo a quien radicó al emitir el concepto (hito 0, punto 7): escrito y probado en el arnés y desplegado el 2026-09-25**; falta verlo llegar a Outlook (hito 1) |
| `Fotos.gs` | Registro fotográfico en Drive, carpeta por DANE sede; `listarFotos` devuelve enlace y miniatura, nunca el contenido; valida que el archivo sea JPEG/PNG real (D-29 sección 4, D-42); comparte al subir, no en cada consulta | — | ✅ cambio 2026-09-24 desplegado |
| `Hallazgos.gs` | Listar y resolver hallazgos (Administrador, Verificador); detección automática al radicar o cargar: AIU sobre umbral, costo $0, «sin afectación» sobre tipo 1-2, DANE confirmado a mano (D-42); textos sin referencias internas | Paso 6 | ✅ cambio 2026-09-24 desplegado |
| `Usuarios.gs` | Listar, crear y activar/desactivar usuarios, con validación de rol/tipo/alcance (solo Administrador); cada cambio corta la sesión abierta de esa persona | Paso 6 | ✅ cambio 2026-09-24 desplegado |
| `Lotes.gs` | **Nuevo (D-44).** Listar, crear, agregar sedes, quitar sede y cerrar lote (solo Administrador para escribir); una sede en un solo lote vigente, nada se borra | — | ✅ desplegado y probado en real 2026-09-24 |

**Falta:** (histórico; el frontend vive en `app/` desde 2026-09-25 y llama al backend real) Hallazgos (Paso 6), Usuarios (Paso 6) y el correo de confirmación
del radicado. Cada uno se agrega como una entrada nueva en el objeto `manejadores` de `Codigo.gs`, sin
tocar lo que ya funciona. **`Presupuestos.gs` (D-40), `Verificaciones.gs`, `Fotos.gs` y `Codigo.gs`
ya están pegados y desplegados** sobre la implementación existente ("Paso 0 — 6 pestañas...").
`obtenerBandejaVerificacion`/`emitirConcepto` se probaron de punta a punta contra el backend real
(login, radicación, concepto, D-39 confirmado con mutación de una sola celda y con el candado de
concurrencia). **Cargas también confirmado en producción el mismo día**: `guardarPresupuesto` con
`origen: CARGA` desde Administrador, con `ingesta_ARANZAZU.json` real — ver
`docs/PLAN_DESARROLLO.md` Paso 5 para el detalle. **Fotos, el concepto de verificación en la Ficha y
el PDF también confirmados en producción 2026-09-21** — ver `docs/PLAN_DESARROLLO.md` para el
detalle de la prueba (radicación de prueba en 217050000060, Buenos Aires - Aranzazu, con concepto
emitido y foto real subida a Drive; pendiente de limpieza igual que las pruebas anteriores).

## Decisiones que este código ya aplica

- **D-20** — código de un solo uso, nunca se revela si un correo tiene cuenta.
- **D-43** (reemplaza a D-6 en este punto) — `valor_referencia` no llega al navegador de **ningún** rol: `Sedes_listar` y
  `Verificaciones_bandeja` la quitan de la respuesta. El sistema solo muestra lo que se registra en él.
- **D-24 / D-25** — alcance por municipio (alcalde), por lista de sedes (rector), departamental sin
  restricción (Verificador).
- El secreto de firma de los tokens se genera solo y se guarda en las Propiedades del script — no
  vive en ningún archivo de este repo.
- **D-38** — `validarCodigo` bloquea un código tras 5 intentos fallidos; respaldo diario automático;
  ver `docs/RUNBOOK_CONTINUIDAD.md` para qué hacer si la cuenta que despliega esto deja de estar
  disponible.
- **D-37** — `Presupuestos_guardar` nunca sobrescribe una fila: cada guardado agrega una versión
  nueva y solo apaga `vigente` en la anterior (`Presupuestos.gs::_presupuestoVigente`).
- **D-45** — excepción: un borrador guardado sobre una versión radicada entra con `vigente=FALSE`
  («en espera») y no apaga la radicada; solo al radicar se apaga
  (`Presupuestos.gs::_vigenteYUltimaVersion`).
- **D-27** — `valor_referencia` vive únicamente en `Sedes`; `Presupuestos_guardar` nunca la lee, la
  copia ni la sobrescribe. Desde D-43 tampoco se envía al navegador; la columna sigue en la hoja.
- **D-42** — candado (`LockService`) en `Presupuestos_guardar` y `Verificaciones_emitir`; validación de
  los bytes reales de la foto; detección automática de hallazgos (solo se detecta, nunca se resuelve solo).
- **D-39** — `Verificaciones_emitir` extiende la misma excepción de D-37 al campo `estado`: un único
  `setValue` dirigido sobre la fila vigente, nunca una versión nueva, porque el concepto no cambia el
  contenido del presupuesto. El registro de auditoría completo vive aparte, en `Verificaciones`.
- **D-40** — `Presupuestos_guardar` admite `origen: CARGA` desde el rol `VERIFICADOR` además de
  `MANUAL` desde `RESPONSABLE_SEDE`/Administrador.
