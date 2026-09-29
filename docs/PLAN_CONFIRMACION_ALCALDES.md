# Plan de desarrollo — Confirmación de sedes por los alcaldes (D-48)

**2026-09-29.** Visto bueno del usuario para desarrollar: «Sí, arranca con el desarrollo del módulo. Realiza un
plan para hacer el desarrollo por fases y que se haga todo completo.» La definición está cerrada en **D-48**
(`CLAUDE.md` §2) y el texto del certificado, en `docs/PROPUESTA para jefatura - Certificado de alcaldes y ajustes
al oficio v2.docx`. **Plazo de los alcaldes: viernes 2026-10-02.**

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
