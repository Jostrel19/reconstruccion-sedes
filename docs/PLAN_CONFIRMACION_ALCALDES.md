# Plan de desarrollo — Confirmación de sedes por los alcaldes (D-48)

**2026-09-29.** Visto bueno del usuario para desarrollar: «Sí, arranca con el desarrollo del módulo. Realiza un
plan para hacer el desarrollo por fases y que se haga todo completo.» La definición está cerrada en **D-48**
(`CLAUDE.md` §2) y el texto del certificado, en `docs/PROPUESTA para jefatura - Certificado de alcaldes y ajustes
al oficio v2.docx`. **Plazo de los alcaldes: martes 2026-10-06** (era el viernes 2026-10-02; lo cambió la jefatura el 2026-09-29).

**Objetivo:** que cada uno de los 26 alcaldes entre con su correo, responda por cada sede oficial de su
municipio si tiene una intervención terminada o en proceso (quién, nombre y estado), genere la certificación,
la firme y la cargue en PDF; y que la Secretaría vea el avance y descargue los PDF firmados.

**Regla de alcance:** los campos son **solo** los de D-48. Nada se agrega a lo que se recoge.

---

## Fases

| Fase | Qué | Quién | Condición de salida |
|---|---|---|---|
| 0 | Censo del 28-09 en el sistema, logo, definición | Usuario + Claude | ✅ 2026-09-29: 975 sedes, 702 con daño, huella idéntica al CSV |
| 1 | Backend: hojas, `Confirmaciones.gs`, registro de acciones, `tipo` en el ingreso | Claude | ✅ 2026-09-29: arnés 71/71 y regresión 68/68; `node --check` de los 4 `.gs` |
| 2 | Pantalla del alcalde: responder, guardar, generar e imprimir la certificación, cargarla | Claude | ✅ 2026-09-29: simulador (Riosucio 92, Marulanda 11); certificado a PDF con Edge: 6 y 2 páginas |
| 3 | Panel de la Secretaría: avance de los 26, detalle por municipio, descarga de PDF, exportar | Claude | ✅ 2026-09-29: simulador (26 municipios, todos los estados) |
| 4 | Despliegue y prueba en real | Usuario (pasos) + Claude (verificación) | ✅ 2026-09-29: ciclo completo en real con un alcalde de prueba; prueba retirada y hojas protegidas |
| 5 | Antes de enviar el enlace | Usuario / jefatura | Pages publicado, rectores desactivados, oficio completo |

La documentación (`CLAUDE.md`, `PLAN_DESARROLLO.md`, `REGISTRO_DESARROLLO.md`, `backend/README.md`,
`app/README.md`) se actualiza al cerrar cada fase, no al final.

---

## Fase 1 — Backend

**Hojas nuevas** (`Setup.gs::crearHojas`), mismo criterio de no sobrescribir de D-37:

- `Confirmaciones`: `dane_sede · municipio · tiene_intervencion · quien_interviene · nombre_quien_interviene ·
  estado_obra · registrado_por · fecha_registro · vigente`. Una fila por respuesta guardada. Corregir una sede
  agrega una fila y apaga `vigente` de la anterior (escritura dirigida a una celda); guardar lo mismo no crea fila.
- `Certificaciones`: `id_certificacion · municipio · evento · codigo_verificacion · n_sedes · correo · fecha ·
  archivo_id · archivo_nombre · tamano_bytes · sha256`. **Solo se agregan filas**: `GENERADO` al generar la
  certificación (no se repite si el código es el mismo), `CARGADO` al subir el PDF firmado.

**`backend/Confirmaciones.gs`** — cinco acciones:

| Acción | Quién | Qué hace |
|---|---|---|
| `listarConfirmaciones` | Alcalde (su municipio); Administrador, Verificador y Consulta (todos) | Sedes con su respuesta vigente y el estado de cada municipio |
| `guardarConfirmaciones` | Solo alcalde | Guarda varias respuestas en un pedido, con candado; valida cada una |
| `generarCertificado` | Solo alcalde | Exige todas las sedes respondidas; calcula el código; registra `GENERADO`; devuelve los datos a imprimir |
| `subirCertificado` | Solo alcalde | Valida el PDF, lo guarda en Drive sin compartir, registra `CARGADO` |
| `descargarCertificado` | Secretaría; alcalde, el suyo | Devuelve el PDF cargado |

- **Alcalde** = usuario `RESPONSABLE_SEDE` con `tipo = alcalde` en `Usuarios`; su municipio es su alcance. Los
  rectores reciben «La confirmación de sedes es solo para los alcaldes».
- **Validación de cada respuesta:** DANE del municipio del alcalde; `Sí`/`No`; con `Sí`, quién (una de las 9
  opciones de D-48) y estado (Planeación, Contratación, Ejecución, Terminada); nombre obligatorio con Donante,
  Cofinanciación o Cooperación y vacío con las demás; con `No`, los tres vacíos. Nombre de hasta 200 caracteres;
  si empieza por `= + - @` se guarda como texto (no como fórmula).
- **Código de verificación:** SHA-256 de las respuestas vigentes del municipio (DANE, respuesta, quién, nombre,
  estado), en formato `XXXX-XXXX-XXXX`. El nivel de afectación no entra: no se certifica.
- **Estado del municipio** (lo calcula el servidor): Sin empezar · En diligenciamiento · Por generar
  certificación · Certificación generada · Certificación cargada · Desactualizada (se cargó y después cambió
  una respuesta).
- **Validación del PDF:** hasta 10 MB; empieza por `%PDF-`; `%%EOF` en los últimos 1.024 bytes; se rechaza si
  trae alguno de estos nombres (también escritos con `#xx`): `/JavaScript /Launch /EmbeddedFile(s) /RichMedia /XFA
  /SubmitForm /ImportData /GoToE /Encrypt`. Huella SHA-256 guardada. Carpeta de Drive propia, **sin compartir**.
  Límite conocido y aceptado: lo que viaja comprimido dentro del PDF no se inspecciona, y no hay antivirus (D-48).
  Repetir el mismo archivo no duplica (misma huella).
- **Cambios en archivos existentes:** `Codigo.gs` registra las 5 acciones; `Auth.gs::Auth_validarCodigo`
  devuelve también `tipo`; `Setup.gs` crea las 2 hojas.

**Verificación:** arnés en Node (`<scratchpad>/harness_confirmaciones.js`) con permisos por rol, validaciones,
versionado sin duplicados, código estable, estados, PDF válido e inválido (sin encabezado, sin `%%EOF`, con
`/JavaScript`, con `/J#61vaScript`, cifrado, más de 10 MB) e idempotencia del cargue.

## Fase 2 — Pantalla del alcalde

- **Interruptor** `CAMPANA_CONFIRMACION` en `nucleo.js`. Encendido: el alcalde entra directo a «Confirmación de
  sedes» y no ve nada más (sin buscador ni riel de seguimiento).
- **Pantalla** (`app/js/confirmacion.js`): avance del municipio; los tres pasos (responder · generar e imprimir ·
  cargar) con el que sigue resaltado; tabla de sedes con el nivel del censo en solo lectura y las cuatro
  respuestas; quién, nombre y estado se ocultan con «No», el nombre solo aparece cuando es obligatorio; filtros
  (todas, sin responder, con intervención, sin intervención); barra «N cambios sin guardar · Guardar cambios ·
  Deshacer»; aviso al salir con cambios sin guardar; aviso antes de cambiar algo ya certificado.
- **Certificado** (`app/js/certificado.js`): texto aprobado, carta horizontal, logo del membrete
  (`app/img/logo-certificado.png`), resumen, tabla con el código DANE de la sede, firma con nombre del alcalde
  y cédula a mano, código de verificación y «Página n de m» al pie. Iframe + imprimir, como `pdf.js`.
- **Cargue:** el navegador revisa extensión, tamaño y encabezado antes de enviar; confirmación; tiempo de espera
  de 5 minutos para este pedido (conexiones lentas); el panel muestra el PDF cargado y su historial.

**Verificación:** backend simulado en el panel (Riosucio 92 sedes, Marulanda 11): responder, guardar parcial,
generar, cargar, cambiar después de cargar → desactualizada. Certificado impreso a PDF con Edge sin interfaz
para revisar paginación y pie. Sin desborde a 320 px.

## Fase 3 — Panel de la Secretaría

- «Confirmación de alcaldes» en el riel (Administrador, Verificador, Consulta; solo lectura): cifras (municipios
  con certificación cargada de 26, sedes respondidas de 975…), tabla de los 26 con alcalde, avance, estado y
  descarga del PDF vigente.
- Detalle por municipio: respuestas por sede y el historial de certificaciones con descarga.
- «Exportar a Excel»: las respuestas vigentes de las 975 sedes (los campos de D-48 más la identificación de la sede).
- De paso: quitar la opción «6» del filtro de tipo en Lotes (el tipo 6 ya no existe en el censo).

**Verificación:** backend simulado; descarga de un PDF simulado; CSV abierto con las columnas esperadas.

## Fase 4 — Despliegue y prueba en real (pasos del usuario)

1. Pegar `Confirmaciones.gs` (nuevo), `Codigo.gs`, `Auth.gs` y `Setup.gs` completos en Apps Script.
2. Correr `crearHojas()` → aparecen `Confirmaciones` y `Certificaciones`.
3. Proteger las dos hojas (D-37 capa 2), igual que las demás.
4. **Nueva versión de la implementación existente** con descripción (no una implementación nueva).
5. Prueba en real con un **alcalde de prueba** (un correo del usuario, `tipo = alcalde`, alcance = un municipio):
   responder algunas sedes, completar, generar, imprimir a PDF, cargar, ver el avance y descargar como
   Administrador. **Después:** desactivar el usuario de prueba y borrar a mano sus filas de `Confirmaciones` y
   `Certificaciones` y su PDF de Drive, para que el municipio arranque en cero.

## Fase 5 — Antes de enviar el enlace (no es código)

- Publicar `app/` en GitHub Pages (requiere autorización del usuario para commit y push; revisar datos personales antes).
- Desactivar los 161 rectores activos en `Usuarios` (D-48: los rectores no entran).
- Decidir A1-A2 del cupo de correo (`PLAN_DESARROLLO.md`, «En discusión» punto 2): cada ingreso gasta un correo de 100 al día.
- Completar el oficio: fecha, enlace, QR, firmante y cargo; enviarlo a los mismos correos registrados.

## Riesgos anotados

- **Cupo de correo:** 26 alcaldes entrando varias veces al día caben en 100, pero no si además entran otros usuarios.
- **Conexión lenta en municipios rurales:** un PDF de 10 MB viaja como ~13 MB; por eso el tiempo de espera de 5
  minutos y la recomendación de escanear en blanco y negro o escala de grises.
- **La aplicación no puede leer el PDF escaneado:** el código de verificación impreso lo compara a ojo la
  Secretaría contra el que muestra el panel.

---

## Resultado de las fases 1 a 3 (2026-09-29)

- **Arnés** (`<scratchpad>/harness_confirmaciones.js`, 71 comprobaciones): permisos por rol (rector, administrador,
  verificador, consulta, alcalde de otro municipio), las 7 validaciones de respuesta, versionado sin duplicados
  (también con un nombre que empieza por `=`), límite de 150 por pedido, código estable y reversible, los seis
  estados, PDF rechazado por cada causa (PNG, sin `%%EOF`, `/JavaScript`, `/J#61vaScript`, cifrado, adjuntos,
  `/Launch`, más de 10 MB, base64 dañado) sin tocar Drive ni la hoja, PDF válido en carpeta sin compartir con su
  SHA-256, cargue idempotente, descarga idéntica, desactualización y vuelta atrás, `tipo` en el ingreso y las 5
  acciones registradas. El arnés anterior (68) sigue en verde.
- **Simulador en el navegador** (pestaña aparte, sin sesión real): el alcalde ve solo su pantalla (sin buscador,
  sin riel de seguimiento, una sola petición al entrar); Sí/No muestra u oculta campos; el nombre aparece solo con
  Donante, Cofinanciación o Cooperación; guardado parcial; fila incompleta marcada y no enviada; generar
  deshabilitado con cambios sin guardar; cargue con revisión previa (no PDF, más de 10 MB, falso PDF);
  cambiar después de cargar pide confirmación y deja la certificación desactualizada; Deshacer y Salir con cambios
  preguntan. Panel: 26 municipios con estado, alcalde (incluidos «Sin usuario» y «Alcalde inactivo»), detalle,
  descarga y exportación a CSV con los campos de D-48. Sin desborde de página a 320 px.
- **Certificado** impreso a PDF con Edge sin interfaz, con sedes reales del catálogo y respuestas ficticias:
  encabezado de tabla repetido en cada página, «Código de verificación · Página n de m» al pie. Riosucio (92
  sedes) en 6 páginas, Marulanda (11) en 2.

**Corregido durante la prueba:** la tabla medía ~1.400 px y obligaba a desplazarse de lado en un portátil de 1366
px: el nombre de quién interviene pasó a la misma celda de «Quién interviene», debajo, y solo cuando se pide
(ahora cabe: 1.094 px). El control Sí/No chocaba con una clase `.seg` que ya existía (barra del mosaico): se
renombró `.sino`. Certificado: anchos de columna fijos (`colgroup`), Riosucio pasó de 9 a 6 páginas.

## Fase 4 — avance (2026-09-29)

**Hecho por el usuario y verificado:** los 4 `.gs` pegados, `crearHojas()` corrido y versión publicada. El `/exec`
responde a las 5 acciones nuevas («Sesión inválida o vencida» sin token, no «Acción desconocida»).
`listarConfirmaciones` con la sesión del Administrador (solo lectura, 3,7 s): 975 sedes, 26 municipios con sus
sedes (Riosucio 92 … Marulanda 11; suma 975), los 26 en «Sin empezar», 0 respuestas, 0 certificaciones; Patio
Bonito en tipo 4. **Sin verificar desde aquí:** la protección de `Confirmaciones` y `Certificaciones` (paso 3).

**Hallado en `Usuarios`** (lectura con `listarUsuarios`):
- **Los 26 alcaldes están inactivos** (0 de 26). Hasta activarlos, ninguno puede entrar. Se activan desde la pantalla
  Usuarios justo antes de enviar el oficio.
- **Los 161 rectores ya están inactivos** (0 de 161): el pendiente «desactivar los rectores» de la fase 5 ya está cumplido.
- En Aranzazu hay un segundo usuario alcalde, **«Jose Prueba»**, con el correo personal del practicante, inactivo.
  Sirve como alcalde de prueba para el paso 5: activarlo, hacer el ciclo en Aranzazu (30 sedes), desactivarlo y
  borrar a mano sus filas de `Confirmaciones` y `Certificaciones` y su PDF de Drive.

**Prueba en real con el alcalde de prueba — pasó (2026-09-29, ~1:30 a. m.).** El usuario activó «Jose Prueba»
(Aranzazu), entró con su correo y código, respondió las 30 sedes, generó la certificación, la guardó en PDF desde la
ventana de impresión de Chrome y la cargó. Verificado desde la sesión del Administrador (solo lectura):
- Aranzazu en «Certificación cargada»: 30 de 30 respondidas, 4 con intervención (Planeación 1, Contratación 1, Ejecución 1,
  Terminada 1), 26 sin; todas registradas por el correo del alcalde de prueba. Ningún otro municipio tiene datos.
- `Certificaciones`: `C-1` GENERADO y `C-2` CARGADO, ambos con el código `F6E4-D621-F9A8` (el mismo que muestra la pantalla).
- El PDF descargado desde el panel es el mismo que se cargó (SHA-256 idéntico): 206.824 bytes, `%PDF-1.4`, 3 páginas,
  generado por Chrome, con el logo del certificado incrustado (imagen de 784 × 107).
- Panel «Confirmación de alcaldes»: «1 de 26 municipios con la certificación cargada», «30 / 975 sedes respondidas».

**Falta:** retirar la prueba (desactivar «Jose Prueba», borrar a mano las filas de `Confirmaciones` y `Certificaciones` y el
PDF de Drive — solo el archivo, no las carpetas) y confirmar la protección de las dos hojas nuevas.

**Decisión del usuario (2026-09-29):** los datos de la prueba y el usuario «Jose Prueba» **se dejan activos** para mostrarle el módulo al jefe el 2026-09-30 a primera hora. Se retiran después de la demostración y **antes de activar a los 26 alcaldes**: si no, el alcalde real de Aranzazu vería como propias las 30 respuestas y la certificación de prueba.

**Prueba retirada y hojas protegidas (2026-09-29).** El usuario borró las filas de prueba de `Confirmaciones` y `Certificaciones` y el PDF de Drive, desactivó a «Jose Prueba» y protegió las dos hojas nuevas (esto último según el usuario; no se puede comprobar desde la aplicación). Verificado con `listarConfirmaciones`/`listarUsuarios`: 26 municipios en «Sin empezar», 0 respuestas, 0 certificaciones; 0 alcaldes y 0 rectores activos. **La fase 4 queda cerrada.** Si se vuelve a usar «Jose Prueba» para la demostración al jefe, hay que repetir esta limpieza antes de activar a los 26 alcaldes.

**2026-09-29, cierre de la sesión:** el usuario confirma que también borró los PDF de prueba de Drive. La fase 5 (activar los 26 alcaldes, H-27, GitHub Pages, cupo de correo, oficio) queda pendiente para después de la demostración al jefe del 2026-09-30.

**Demostración al jefe (2026-09-29, mañana; se adelantó del 30) — correcta y con visto bueno.** El usuario reactivó a
«Jose Prueba», hizo el ciclo completo en Aranzazu y lo mostró. Durante la preparación, Google Apps Script respondió muy
lento (9 a 107 s por pedido, algunas respuestas perdidas; el panel Ejecuciones mostraba 0,5 a 3,5 s por ejecución): se
ajustó el navegador para tolerarlo (`?v=7`, ver `docs/REGISTRO_DESARROLLO.md`). El servidor local lo detuvo la aplicación
de Claude a las 9:42 a. m. y se volvió a encender. **Hay que volver a limpiar** antes de activar a los 26 alcaldes:
desactivar «Jose Prueba», borrar las filas de `Confirmaciones` y `Certificaciones` hasta el final (Ctrl+Fin) y borrar solo
el PDF de Drive, no las carpetas.

### 2026-09-29 (mañana) — Ajustes tras la demostración, antes de publicar (`?v=8`)

Pedidos del usuario al revisar el PDF de la demostración:
1. **Logo roto en la certificación.** Causa: la certificación se generó a las 9:59 y el servidor local se había apagado
   a las 9:42 (lo detuvo la aplicación de Claude); el logo se enlazaba y no cargó. Ahora `certificado.js` lo descarga una
   vez al pintar la pantalla del alcalde (`precargarLogoCertificado`) y lo **incrusta como data URI** en el documento: no
   depende del servidor al imprimir. Si no se pudo obtener, no imprime y avisa que se pulse «Imprimir de nuevo».
   Verificado con Edge sin interfaz (Marulanda, logo visible) y con impresión simulada en el navegador (logo 784 px).
2. **Nombre del archivo.** Chrome y Edge proponen como nombre del PDF el título de la página. Al imprimir, el título pasa a
   «Confirmación de sedes — Reconstrucción de sedes <MUNICIPIO>» (igual en el documento impreso y en su encabezado) y
   vuelve al anterior al cerrar el diálogo.
3. **Instrucciones siempre visibles.** «Qué se responde en cada sede» era un bloque plegado; ahora es «Cómo responder cada
   sede», abierto, en 4 pasos numerados (nivel de afectación → Sí/No → datos si es Sí → Guardar) y 3 ejemplos. Los
   conceptos son los del oficio; los ejemplos son ilustrativos y no agregan campos.
4. **Demoras.** No se pueden acortar desde el código (son de Google). Se agregó: aviso «El servidor está tardando más de
   lo normal. No cierre ni recargue la página…» cuando un botón lleva 12 s esperando (`avisos.js::ocupar`), y texto de
   espera mientras cargan las sedes del alcalde.
5. **Correos de los alcaldes (no son @sedcaldas.edu.co).** Nada lo restringe: el ingreso busca el correo tal cual está en
   `Usuarios`. Se cambió el texto de ejemplo del campo («El correo con el que está registrado») y se agregó «Si el código no
   le llega en unos minutos, revise la carpeta de correo no deseado (spam)»: el código sale de una cuenta de Gmail y el
   servidor de correo de una alcaldía puede filtrarlo.

Publicación preparada: `.github/workflows/pages.yml` (sube solo `app/`) y `.gitignore` excluye las dos propuestas a la
jefatura (traen un teléfono). Revisión de datos personales en lo que se sube: sin correos ni teléfonos nuevos; los
correos que ya están en `docs/REGISTRO_DESARROLLO.md` y `docs/PLAN_DESARROLLO.md` ya estaban publicados en commits
anteriores (pendiente aparte: datos personales en el historial).

### 2026-09-29 — D-49: la campaña en el servidor y tope de códigos

Tras la auditoría de seguridad previa al despliegue: el servidor aplica el modo campaña (un Responsable de sede solo
usa la confirmación) y el envío de códigos tiene tope (3 sin usar por correo cada 6 h). Probado en el arnés (50/50, más
68/68 y 71/71). **Desplegado el 2026-09-29** (`Codigo.gs`, `Auth.gs` y `Usuarios.gs`, nueva versión de la
implementación) y comprobado en real en la prueba desde otro PC. Detalle: `CLAUDE.md` D-49 y
`docs/REGISTRO_DESARROLLO.md`.

**H-27 resuelto (2026-09-29):** el oficio sale hoy. `CONFIRMACION_FECHA_OFICIO` = «29 de septiembre de 2026» (el
certificado dice «…en atención a su oficio del 29 de septiembre de 2026»; comprobado generando uno de prueba) y el oficio
dice «Manizales, 29 de septiembre de 2026», ya sin el resaltado de pendiente (respaldo previo
`…BACKUP-20260929-112634.docx`). En el oficio quedan pendientes, resaltados: el enlace, el código QR, el firmante y el cargo.

## 2026-09-29 — Publicada en GitHub Pages: https://jostrel19.github.io/reconstruccion-sedes/

Al habilitar Pages quedó elegida primero la publicación desde la rama y GitHub publicó **todo el repositorio** (README
como portada, `docs/*.html`, `CLAUDE.html`, `backend/*.gs`) a las 11:27 a. m. Lo detectó el usuario («dice que ya está
publicada»); no expuso nada nuevo (el repositorio ya es público y sin los datos del equipo desde `a7413dc`). Corregido el
mismo día: el usuario creó `.github/workflows/pages.yml` desde la web (commit `388f506`; la credencial local no tiene
permiso `workflow`) con la fuente en «GitHub Actions». El flujo publica **solo `app/`**. Verificado: la raíz sirve la
aplicación (`?v=10`, plazo martes 6 de octubre, oficio del 29 de septiembre, logos), `docs/`, `CLAUDE.html` y `backend/`
responden 404, y desde `github.io` el navegador llega al backend (CORS) en 1,7 s. Avisos del flujo (Node 20 en desuso,
cambio de Ubuntu el 19 de octubre): informativos, sin efecto. Copia local al día con `git pull`.

**Entrega del código por dominio (2026-09-29):** 25 alcaldías usan Google Workspace (entrega confiable desde Gmail);
Villamaría usa otro proveedor (`mail.1cero1.com`, vigilar); `caldas.gov.co` (Gobernación, FortiMail) no recibió el código.
Detalle en `docs/REGISTRO_DESARROLLO.md`.

## 2026-09-29 — Defecto: los alcaldes de municipios con tilde perdían la sesión al entrar

Hallado en la prueba desde otro PC con un alcalde de prueba de **CHINCHINÁ**: el ingreso funcionaba, pero el pedido
siguiente respondía «Sesión inválida o vencida» y la aplicación lo sacaba («Su sesión venció o sus permisos cambiaron»).
Con Aranzazu y Anserma, sin tilde, no pasaba.

**Causa:** `Auth.gs::_crearToken` codificaba el token con `Utilities.base64EncodeWebSafe(texto)`, que no usa UTF-8, y
`verificarToken` lo leía en UTF-8. La «Á» llegaba cambiada, el alcance del token dejaba de coincidir con la hoja
`Usuarios` y la sesión se rechazaba. Además, el navegador no podía leer el vencimiento de ese token
(`sesion.js::venceToken`), así que al recargar lo habría dado por vencido. **Afectaba a 7 de los 26 municipios:**
Belalcázar, Chinchiná, Pácora, Samaná, San José, Supía y Villamaría. El arnés no lo vio porque su simulador codificaba
en UTF-8.

**Corrección:** el token se arma solo con caracteres ASCII (las tildes van escapadas como `\u00c1`); un token sin
tildes queda idéntico al de antes, así que no se cierra ninguna sesión abierta. El simulador ahora codifica como Apps
Script (Latin-1 sin juego de caracteres). El arnés reprodujo el defecto antes de corregir (2 fallas en «municipio con
tilde») y después da **55 de 55**; 68/68 y 71/71 sin cambios. Comprobado además que los 7 nombres vuelven iguales.
**Desplegado el 2026-09-29 (versión 15 de la implementación) y comprobado en real el mismo día** con el alcalde de
prueba de Chinchiná desde otro PC: entra y conserva la sesión, responde las 32 sedes, genera y carga la certificación.
El panel «Confirmación de alcaldes» muestra Chinchiná con 32 de 32 y «Certificación cargada». El usuario confirmó
además el resto del proceso sin novedades.

**Caída de 15 minutos al desplegar.** La versión 14 se creó con el archivo `Usuarios` mal pegado y sin guardar:
`doPost` fallaba con `ReferenceError: Usuarios_listar is not defined` y el navegador recibía la página de error de
Google en vez de JSON. Se arregló con la versión 15, sin efecto hacia afuera (los alcaldes siguen inactivos).
Verificado después: JSON en «Acción desconocida», «Sesión inválida o vencida» y `solicitarCodigo`. **Lección:**
una versión es copia del código *guardado*; guardar todos los archivos (Ctrl+S) antes de crearla (`backend/README.md`).

### 2026-09-29 (cierre del día) — Dónde quedó: lista para el envío del correo

Verificado en la app publicada: versión 10, campaña encendida, plazo «martes 6 de octubre de 2026», fecha del oficio
«29 de septiembre de 2026», servidor respondiendo (1,8 s). **Falta, en este orden:**

1. ~~**Limpiar la prueba**~~ (**hecho, verificado 2026-09-29**, ver abajo): desactivar los 3 usuarios de prueba; borrar en la hoja la fila del alcalde de
   prueba de Chinchiná, que usa el correo del Administrador real; devolverle a ese Administrador su correo
   `…@sedcaldas.edu.co` y activarlo **desde la app**; vaciar `Confirmaciones` y `Certificaciones` (hasta Ctrl+Fin) y
   borrar solo los PDF de Drive. Verificación: «Confirmación de alcaldes» con los 26 en «Sin empezar» y 0 respuestas.
2. ~~**Activar los 26 alcaldes**~~ (**26 de 26 activos, verificado 2026-09-29**). Si se activan en la hoja, activar el último desde la app o esperar 5 min
   antes de enviar (caché de usuarios activos).
3. **Oficio** (copia en `trabajo28.09_oficioAlcaldes/`): enlace, QR (opcional), firmante y cargo; quitar el resaltado;
   firmado en PDF.
4. **Correo** (`CORREO_ALCALDES_envio_del_enlace.md`): teléfono, firmante y cargo; oficio adjunto; a los 26 correos
   registrados en `Usuarios`, con copia oculta.
5. ~~*Recomendado:* quitar «Uso interno — no distribuir fuera de la Secretaría» del pie que ve el alcalde~~
   (**publicado 2026-09-29, `?v=11`**, junto con el ícono de la pestaña y el botón gris; ver la sección de abajo). Hallado en la auditoría de interfaz (fuera del repositorio:
   `trabajo29.09_auditoriaUI/`).

El primer día: vigilar Villamaría (H-29), el cupo de 100 correos al día y el panel de ejecuciones. No bloquea el envío:
commit de `Auth.gs` (token ASCII, ya desplegado) y de la documentación, a la espera de autorización.

### 2026-09-29 — Prueba retirada y 26 alcaldes activos (verificado en el panel)

El usuario hizo la limpieza y la activación; se verificó con su sesión de Administrador, solo lectura:

- **«Confirmación de alcaldes»:** 26 municipios en «Sin empezar», 0 de 975 sedes respondidas, 0 certificaciones
  generadas o cargadas. Las sedes por municipio suman 975. Aranzazu, Anserma y Chinchiná (los de la prueba) en 0.
- **`Usuarios`** (195 filas, leídas con `listarUsuarios`): **26 alcaldes activos, uno por municipio**, rol
  `RESPONSABLE_SEDE`, alcance idéntico al nombre del catálogo (también los 7 con tilde), `activo` booleano; sin
  correos repetidos ni mal formados. 0 de 161 rectores activos. Los usuarios de prueba que quedan («Jose Prueba» de
  Aranzazu y «Prueba Fase 4») están inactivos; los dos de Chinchiná y Anserma ya no están. El Administrador cuyo
  correo se usó en la prueba quedó activo con su correo `…@sedcaldas.edu.co`. Activos fuera de los alcaldes: 2
  Administradores, 2 Verificadores y 2 de Consulta.
- **Drive:** el usuario borró los PDF de prueba; no se ve desde la aplicación.

**Oficio y correo:** los completó el jefe el 2026-09-29 (enlace, QR, firmante, cargo, teléfono); el envío queda a
cargo de la jefatura. La versión final no está en `trabajo28.09_oficioAlcaldes/`: ahí siguen los borradores con los
marcadores. El pie «Uso interno» ya se oculta para el alcalde (`?v=11`, abajo).

**Mientras corre la campaña (hasta el 2026-10-06), acordado con el usuario:** el diseño y las funcionalidades nuevas
se trabajan, pero no se publican. Tres cosas afectan a los alcaldes en el acto y no se hacen salvo un defecto que les
impida responder: (1) un push a `master` que toque `app/` (el flujo de Pages publica solo); (2) una **Nueva versión**
de la implementación de Apps Script (la de los alcaldes es la misma; la caída de 15 minutos del 2026-09-29 salió de
ahí); (3) cambiar la estructura de las hojas (columnas, pestañas). El trabajo nuevo va en una rama aparte o sin
publicar, probado con el arnés y el simulador. Un commit de `backend/` o `docs/` a `master` no publica nada (el flujo
filtra `app/**`). **Seguimiento:** revisar el panel «Confirmación de alcaldes» (quién entró, quién cargó la
certificación), Villamaría (H-29), el cupo de correo y las ejecuciones de Apps Script. **Desde el 2026-10-07:**
rediseño por fases (`trabajo29.09_auditoriaUI/auditoria_y_propuesta_ui.md`) y la hoja de ruta (hito 2, decisiones del
jefe por escrito: `docs/PLAN_DESARROLLO.md` §3.c).

### 2026-09-29 — Ícono de la pestaña y dos ajustes en la pantalla del alcalde (`?v=11`)

Tres cambios visuales pequeños, pedidos por el usuario antes del envío («aprovechar a hacer los cambios pequeños
visuales… de una vez»); ninguno toca la lógica ni el backend:

1. **Ícono de la pestaña:** `app/img/favicon.png` (64 × 64, el escudo recortado de `logo-certificado.png`) y
   `<link rel="icon">` en `index.html`. Antes el navegador mostraba su ícono genérico.
2. **Pie «Uso interno — no distribuir fuera de la Secretaría» oculto para el alcalde** (`arranque.js`, junto a donde
   ya se oculta el buscador). El personal de la Secretaría lo sigue viendo. Es la fase 0 de la auditoría de interfaz.
   Se busca con `.pie-inst > .hace`, que existe también en el `index.html` anterior: un navegador con el HTML viejo en
   caché y el JS nuevo funciona igual.
3. **«Generar certificación» deshabilitado se ve gris** (`estilos.css`, regla acotada a los pasos del reporte, `.cp`):
   antes era un verde más claro que parecía activo. Los demás botones deshabilitados no cambian.

`?v=10` → **`?v=11`** en las 24 referencias. **Verificado con el simulador** (servidor local, pestaña aparte): ícono
cargado; pie oculto como alcalde y visible como Administrador, con el resto del pie intacto; botón gris
(`#F4F3F0`, texto `#556060`, opacidad 1) y deshabilitado; sin errores en la consola; `node --check` de los 20 scripts.
**Publicado el 2026-09-29** con autorización del usuario (commit `82d6bca`; `Auth.gs` y documentación en `609a81b`).
Comprobado en Pages: `index.html` con `?v=11` en las 24 referencias, `favicon.png` responde, `arranque.js` y
`estilos.css` con los cambios; `docs/` y `backend/` siguen sin publicarse (404). Es una excepción, decidida por el
usuario, al congelamiento de la interfaz del alcalde durante la campaña.

### 2026-09-30 — Enlace enviado: la campaña está en curso

La jefatura envió a los alcaldes el correo con el oficio y el enlace de ingreso (confirmado por el usuario el
2026-09-30; la hora exacta del envío no está registrada aquí). Sale sin A1-A2 del cupo de correo
(`PLAN_DESARROLLO.md` punto 2): no se publican durante la campaña. Rige el congelamiento hasta el 2026-10-06.

**Seguimiento diario:** panel «Confirmación de alcaldes» (quién entró, cuántas sedes respondió, quién cargó la
certificación); Villamaría (H-29), que no recibe por Google; el cupo de 100 correos (cada ingreso gasta uno) y las
ejecuciones de Apps Script con error. **Soporte a un alcalde que no recibe el código:** revisar correo no deseado;
usar solo el último código (cada solicitud nueva deja inválido el anterior); tras 3 códigos sin usar en 6 h, el
Administrador lo desactiva y lo vuelve a activar para liberarlo (D-49); si aun así no llega, el plan B de D-49.

### 2026-09-30 — Pensilvania: cambio de correo (primer caso de soporte)

La alcaldía de Pensilvania llamó: con el correo de la alcaldía no podían ingresar y pidieron usar el de un encargado
del alcalde (D-48 lo permite). Como la app no edita el correo de un usuario, el Administrador **creó un usuario nuevo**
(correo del encargado; nombre **del alcalde**, porque es el que se imprime bajo la firma de la certificación; rol
Responsable de sede, tipo alcalde, alcance PENSILVANIA) y **desactivó el anterior**, sin borrarlo. La firma manuscrita
sigue siendo del alcalde. El correo no se escribe aquí (repositorio público). **El encargado ingresó (confirmado por el usuario el 2026-09-30).**

### 2026-09-30 — Certificado sin logo (`?v=12`, excepción al congelamiento)

**Decisión del usuario:** el certificado lo firma el alcalde y no puede llevar el membrete de la Secretaría. Sin él, los
alcaldes no podían firmarlo y no terminaban el reporte, así que se publica durante la campaña como excepción.

- `app/js/certificado.js`: el documento ya no lleva el logo; empieza en el título. `precargarLogoCertificado` queda como
  función vacía a propósito: un navegador con el `confirmacion.js` anterior en caché todavía la llama, y sin ella la
  pantalla del alcalde fallaría.
- `app/js/confirmacion.js`: deja de precargar el logo.
- `?v=11` → **`?v=12`** en las 24 referencias de `index.html`. `app/img/logo-certificado.png` se conserva (de él sale el
  favicon). Sin cambios en el backend: el código de verificación y el texto aprobado no cambian.

**Verificado** en local: `node --check` de los 20 scripts; certificado de prueba con el arnés (sedes de Marulanda,
respuestas ficticias): 0 imágenes, empieza en el título, firma y cédula en blanco intactas; en la app, pintar la
pantalla del alcalde y generar la impresión (impresión interceptada) sin errores. **Los alcaldes que ya generaron o
cargaron la certificación con logo** no quedan invalidados por el sistema: el código de verificación no depende del
logo. Si la jefatura quiere que la rehagan, la regeneran con «Imprimir de nuevo» y cargan otro escaneo.
