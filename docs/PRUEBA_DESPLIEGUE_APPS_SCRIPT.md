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

// Prueba aparte, no la llama el Web App: confirma que MailApp entrega a un
// correo Office 365 (@sedcaldas.edu.co), no solo a Gmail. Correr una vez
// desde el editor (botón "Ejecutar" con esta función seleccionada), poniendo
// el propio correo institucional como destino.
function probarCorreoInstitucional() {
  var destino = "PON_AQUI_TU_CORREO@sedcaldas.edu.co";
  MailApp.sendEmail(destino,
    "Prueba - Reconstruccion de sedes",
    "Si esto llego a su bandeja de Outlook, el envio a correos institucionales funciona. " +
    "Codigo de prueba: " + Math.floor(100000 + Math.random() * 900000));
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

## 3.b Probar el envío a un correo Office 365

Las cuentas institucionales de la SED son de Microsoft 365, no de Google — vale la pena confirmarlo
aparte de la prueba de despliegue:

1. En el editor de Apps Script, en la función `probarCorreoInstitucional`, cambiar
   `PON_AQUI_TU_CORREO@sedcaldas.edu.co` por tu correo real.
2. Seleccionar esa función en el desplegable de arriba y darle **Ejecutar**.
3. La primera vez pedirá autorizar permisos de envío de correo — es normal, es tu propio script
   actuando en tu nombre.
4. Revisar la bandeja de Outlook (y la carpeta de spam, por si acaso la primera vez).

Si llega, queda confirmado que `MailApp` entrega sin problema a Office 365: es correo normal por
SMTP, el mismo protocolo que usa cualquier remitente para llegar a cualquier bandeja — no hay
integración especial entre Google y Microsoft de por medio, ni el destinatario necesita cuenta de
Google en ningún momento.

## 4. Resultado

| Resultado | Qué significa |
|---|---|
| Se ve el JSON sin pedir login | **Funciona.** Se puede construir el backend real sobre Apps Script tal como está diseñado (D-19) |
| Pide iniciar sesión / error de permisos | El dominio bloquea despliegues públicos. Hay que resolverlo con el administrador del Workspace institucional, o evaluar alternativa (Cloudflare Worker / Azure Function, ya descartadas antes por costo pero seguirían siendo un plan B) |
| No aparece la opción "Cualquier usuario" al desplegar | Misma señal: hay una política de organización restringiendo el tipo de despliegue |

Registrar el resultado en `docs/REGISTRO_DESARROLLO.md` al terminar, y borrar este proyecto de
prueba de Apps Script si el resultado es positivo (no se necesita conservarlo).
