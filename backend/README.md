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
   `Auth`, `Sedes` — el nombre del archivo en Apps Script no necesita la extensión `.gs`) y pegar el
   contenido tal cual.

4. **Ejecutar `crearHojas` una vez** (desplegable de funciones, arriba del editor → seleccionar
   `crearHojas` → ▶ Ejecutar). Autorizar los permisos que pida. Esto crea las 6 pestañas con las
   columnas exactas de `CLAUDE.md` §6.

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

| Archivo | Qué resuelve | Paso del plan |
|---|---|---|
| `Setup.gs` | Crea las 6 pestañas con las columnas de `CLAUDE.md` §6 | Paso 0 |
| `Codigo.gs` | `doGet` (ping) + `doPost` con registro de acciones | Paso 0 |
| `Auth.gs` | Login por código de un solo uso, token de sesión firmado (D-20) | Paso 1 |
| `Sedes.gs` | Listado de sedes filtrado por rol/alcance del lado del servidor (D-6, D-24, D-25) | Paso 2 |

**Falta:** enrutado y migas del frontend real (hoy solo existe el mockup estático), escritura de
Presupuestos/Items (Paso 3), Verificaciones (Paso 4), Cargas (Paso 5), Hallazgos (Paso 6), y el PDF
y correo de confirmación. Cada uno se agrega como una entrada nueva en el objeto `manejadores` de
`Codigo.gs`, sin tocar lo que ya funciona.

## Decisiones que este código ya aplica

- **D-20** — código de un solo uso, nunca se revela si un correo tiene cuenta.
- **D-6** — `valor_referencia` no llega al navegador de un Responsable de sede.
- **D-24 / D-25** — alcance por municipio (alcalde), por lista de sedes (rector), departamental sin
  restricción (Verificador).
- El secreto de firma de los tokens se genera solo y se guarda en las Propiedades del script — no
  vive en ningún archivo de este repo.
