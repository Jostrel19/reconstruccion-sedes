# app/ — frontend del sistema

Es lo que se publica en GitHub Pages: HTML, CSS y JS sin build, sin framework y sin dependencias
externas. Habla con el backend de Apps Script (D-19); no guarda datos propios.

Nació el 2026-09-25 al dividir `docs/diseno/mockup_v6.html` (ahora
`mockup_v6.SUPERADA_20260924.html`, que no se usa como fuente). La división fue mecánica: al
volver a juntar las piezas se obtiene el archivo original carácter por carácter.

## Probar en local

Con la configuración `app-local` de `.claude/launch.json`, o a mano:

```bash
python -m http.server 8779 --bind 127.0.0.1 --directory app
```

y abrir `http://localhost:8779`. No abrirlo con `file://`: la sesión (`sessionStorage`) y la carga
de los scripts necesitan un servidor.

Sintaxis de todos los scripts:

```bash
for f in app/js/*.js; do node --check "$f"; done
```

## Estructura

```
app/
├── index.html        marcado de todas las pantallas; carga el CSS y los JS en orden
├── css/estilos.css   tokens y estilos (DISENO_01)
├── css/claro.css     rediseño claro, fase 1 (D-52): se carga después de estilos.css y solo lo sobrescribe (armazón, botones,
│                     estados, diálogo, avisos, panel de la campaña, pantalla del alcalde y Usuarios). Quitar su <link> en
│                     index.html devuelve el aspecto anterior
├── img/              logos de la pantalla de ingreso y del riel; `logo-certificado.png` ya no se usa (el certificado va sin logo desde el 2026-09-30) y queda porque de él sale el favicon; `favicon.png`, el escudo solo, para la pestaña del navegador
└── js/               un archivo por pantalla o tema, en este orden de carga:
    nucleo.js         configuración (BACKEND_URL, roles, rutas), estado global, formatos, navegación
    transporte.js     backend(): el ÚNICO que llama a fetch
    sesion.js         sesión en sessionStorage
    avisos.js         avisos, diálogos propios, botones en espera
    login.js          ingreso con código de un solo uso (D-20)
    registrar.js      Registrar presupuesto y fotos
    ficha.js          Ficha de sede, con memoria y precarga del detalle por DANE
    pdf.js            PDF del formato oficial
    verificacion.js   bandeja y concepto
    hallazgos.js      Hallazgos
    usuarios.js       Usuarios
    cargas.js         Cargas del JSON de ingesta
    tablero.js        Tablero (informe) y la franja de cifras que comparte con Inicio
    inicio.js         Inicio: pendientes por rol, cómo vamos, últimos movimientos (D-46)
    sedes.js          Sedes (las 975, por municipio) y vista de municipio con filtros
    lotes.js          Lotes
    exportar.js       CSV para Excel
    confirmacion.js   confirmación de sedes (D-48): pantalla del alcalde y lo que comparte con avance.js
    certificado.js    certificación que firma el alcalde: en Word, para pasarla al formato de la alcaldía (D-50); la impresión con el formato de la aplicación (iframe + imprimir, como pdf.js) queda sin botón, como respaldo de caché
    avance.js         «Confirmación de alcaldes»: avance de los 26 que ve la Secretaría
    cabecera.js       encabezado de cada vista
    buscador.js       buscador de sedes y migas
    arranque.js       pintar(), eventos de la página y arranque — SIEMPRE el último
```

## Reglas que sostienen la división

1. **Scripts clásicos, no módulos.** Todos comparten el ámbito global, porque los `onclick="…"` del
   HTML llaman funciones por su nombre. Con `type="module"` esos nombres dejarían de ser globales.
2. **Fuera de `arranque.js`, solo declaraciones.** Ningún otro archivo ejecuta nada al cargarse: ni
   `addEventListener`, ni llamadas, ni constantes que llamen funciones. Una función declarada en
   `lotes.js` todavía no existe mientras se ejecuta `cargas.js`; solo existe cuando ya cargaron
   todos, que es cuando corre `arranque.js`.
3. **Un nombre global por cosa.** Como el ámbito es compartido, dos archivos no pueden declarar el
   mismo `const` o `function`: el navegador lo rechaza al cargar. Antes de crear un nombre, buscarlo.
4. **`transporte.js` es el único que llama al backend** y **`BACKEND_URL` vive solo en `nucleo.js`**.
   Si cambia la URL del despliegue (ver `docs/RUNBOOK_CONTINUIDAD.md`), se cambia ahí.
5. **Todo lo que lleva a una sede declara su DANE** en `data-dane` (o `data-ficha`): de ahí lo toma la
   precarga de la Ficha (`arranque.js`, `ficha.js::precargarFicha`). Una fila nueva que abra una Ficha
   debe llevarlo.
6. **Caché:** `index.html` pide cada archivo con `?v=N`. Al publicar un cambio hay que subir ese
   número en todas las referencias a la vez, o los navegadores seguirán con la versión anterior.

## Publicación

Se publica en GitHub Pages desde el 2026-09-29, adelantado por la campaña de los alcaldes (D-48, fase 5).
El flujo `.github/workflows/pages.yml` sube **solo esta carpeta** cada vez que llega a `master` un cambio en
`app/`; se puede correr a mano desde la pestaña Actions («Run workflow»). Requisito único, en GitHub:
Settings › Pages › Source = «GitHub Actions». El sitio no contiene datos: todo lo que muestra llega del
backend después de iniciar sesión. Un cambio en `app/` solo llega a los usuarios con commit y push, y
subiendo el `?v=N`.

## Accesibilidad (WCAG 2.1 AA — Resolución MinTIC 1519 de 2020, Anexo 1)

Revisada el 2026-09-25. Al tocar la interfaz, mantener:

- **Todo campo con nombre**: `<label for>` o `aria-label` (en tablas editables, «Cantidad del ítem N»).
- **Contraste**: texto ≥ 4,5:1; bordes de campos y foco ≥ 3:1. `--borde-f` es solo para bordes decorativos,
  **nunca para texto ni para el borde de un campo** (da 2:1); los campos usan `--gris`, el texto secundario
  `--tx-sec`, el foco `--oro-osc` (en el riel oscuro, `--oro`).
- **Teclado**: lo clicable es `<button>`/`<a>`, o lleva `tabindex="0"` y responde a Enter. Los diálogos
  (`avisos.js::mostrarDialogo`) retienen el foco con Tab y cierran con Esc.
- **Estructura**: «Saltar al contenido» es lo primero del armazón; el área principal es `#contenido`
  (`role="main"`); el título de la pestaña dice la pantalla (`cabecera.js`).
- Probar a **320 px de ancho** (equivale a 400 % de ampliación): ninguna pantalla debe desbordar.

## Campaña de confirmación (D-48)

`nucleo.js::CAMPANA_CONFIRMACION` enciende la campaña: el alcalde (usuario `RESPONSABLE_SEDE` de tipo `alcalde`)
entra directo a «Confirmación de sedes» y no ve nada más; Verificador y Consulta entran directo a «Confirmación de alcaldes» y no ven
nada más (D-51); el Administrador ve «Confirmación de alcaldes» en el riel junto a sus demás pantallas. En `false`, el alcalde vuelve a ser un Responsable de sede como los demás. Esto solo decide la pantalla: el servidor aplica la misma regla por su cuenta (D-49,
`Codigo.gs::_bloqueoCampana`, propiedad del script `CAMPANA_CONFIRMACION`). Al terminar la campaña hay que apagar las dos.
Ahí mismo están el plazo (`CONFIRMACION_PLAZO` y `CONFIRMACION_PLAZO_FECHA`; vacíos = «Plazo en ampliación», sin fecha ni cuenta regresiva, D-53) y la fecha del oficio que cita el certificado
(`CONFIRMACION_FECHA_OFICIO`, hoy «29 de septiembre de 2026»: H-27, resuelto). Los permisos reales los revisa el servidor en cada acción.
