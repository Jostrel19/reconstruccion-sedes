# Prueba de despliegue — Apps Script (pendiente #3)

Confirma que la cuenta institucional puede desplegar un Web App de Apps Script sin que una
política de dominio lo bloquee, antes de construir el backend real sobre esto (D-19).

## 1. Crear el proyecto

En [script.google.com](https://script.google.com), con la cuenta institucional (no personal),
"Nuevo proyecto". Reemplazar el contenido de `Code.gs` por:

```javascript
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      mensaje: "Reconstruccion de sedes - prueba de despliegue",
      hora: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, recibido: body }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 2. Desplegar

`Implementar` → `Nueva implementación` → tipo **Aplicación web**.

- **Ejecutar como:** Yo (tu cuenta institucional).
- **Quién tiene acceso:** "Cualquier usuario" — esto es lo que el frontend en GitHub Pages
  necesita para poder llamarlo. **Esta es la opción que algunas cuentas de Workspace bloquean por
  política de administrador** — si no aparece o da error al guardar, ESO es la señal que estamos
  buscando.

Clic en `Implementar`. Copia la URL que termina en `/exec`.

## 3. Probar desde fuera

Abrir esa URL en el navegador directamente. Debe verse:

```json
{"ok":true,"mensaje":"Reconstruccion de sedes - prueba de despliegue","hora":"..."}
```

Si en vez de eso aparece una pantalla de Google pidiendo iniciar sesión, o un error de permisos,
**el dominio está bloqueando el acceso anónimo** — hay que avisar a quien administra el Workspace
institucional o revisar la opción de acceso al desplegar de nuevo.

## 4. Resultado

| Resultado | Qué significa |
|---|---|
| Se ve el JSON sin pedir login | **Funciona.** Se puede construir el backend real sobre Apps Script tal como está diseñado (D-19) |
| Pide iniciar sesión / error de permisos | El dominio bloquea despliegues públicos. Hay que resolverlo con el administrador del Workspace institucional, o evaluar alternativa (Cloudflare Worker / Azure Function, ya descartadas antes por costo pero seguirían siendo un plan B) |
| No aparece la opción "Cualquier usuario" al desplegar | Misma señal: hay una política de organización restringiendo el tipo de despliegue |

Registrar el resultado en `docs/REGISTRO_DESARROLLO.md` al terminar, y borrar este proyecto de
prueba de Apps Script si el resultado es positivo (no se necesita conservarlo).
