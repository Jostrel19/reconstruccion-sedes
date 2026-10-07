# Conflictos y hallazgos — reconstrucción de sedes

Discrepancias entre fuentes que no se resuelven por cuenta propia: se reportan aquí y se
espera confirmación antes de tratarlas como resueltas (`CLAUDE.md` de la práctica, §7).

---

## Abiertos

| # | Fuente | Hallazgo | Estado |
|---|---|---|---|
| H-1 | `data/entregas_excel/AGUADAS/PPTO INFRAESTRUCTURA EDUCATIVA...xlsx`, hoja `MEJORAMIENTO IE `, celda B2 | El encabezado dice *"ALCALDÍA MUNICIPAL DE SALAMINA, CALDAS."* en el archivo que mandó Aguadas — parece una plantilla reciclada de otro municipio sin actualizar. No afecta la lectura de los datos (el resto del archivo sí corresponde a Aguadas por el contenido), pero conviene que la alcaldía lo confirme antes de citar este documento en algo oficial. | Abierto |
| H-2 | `data/insumos/PrimerasPriorizadas.xlsx` vs. `data/entregas_excel/SAN JOSE/` y `VICTORIA/` | San José y Victoria enviaron presupuesto de infraestructura educativa, pero **ninguno de los dos municipios aparece en las 33 sedes priorizadas**. No se sabe si entran en un lote posterior o se procesan por fuera de esta priorización. | Abierto — no se construye su lector hasta que se aclare el orden |
| H-3 | `data/entregas_excel/BELALCAZAR/.../SEDES EDUCATIVAS` | La hoja índice de sedes de Belalcázar no trae código DANE (columna "RUD" viene vacía en las 12 filas). El cruce contra el catálogo tendrá que hacerse por nombre de sede, con revisión uno por uno — no se hace automático. | Abierto |
| H-4 | `data/entregas_excel/SAMANA/PRESUPUESTO ESTIMADO I.E.xlsx F.xlsx`, hoja `I.E PIO XII`, fila 4 | La sede "ESCUELA BERNARDO OCAMPO HERRERA" trae DANE `21766200280204` (14 dígitos). Según `PrimerasPriorizadas.xlsx` (orden 33), su DANE correcto es `217662002631`. **Esta es una de las 33 sedes priorizadas** — mientras no se corrija en la fuente, el cruce automático para esta sede específica no se puede hacer. | Abierto — requiere que Samaná confirme el DANE correcto |
| H-5 | Mismo archivo, hoja `I.E PIO XII`, filas 3, 6, 8, 9, 11 | Otros 5 DANE de la misma hoja tienen entre 5 y 14 dígitos en vez de 12. Ninguno corresponde a una de las 33 priorizadas (verificado), así que no bloquean el lote actual, pero quedan sin volcar hasta que se corrijan. | Abierto |
| H-6 | Mismo archivo, hojas `I.E FELIX NARANJO` (filas 5, 13) y `I.E RANCHO LARGO ` (filas 11, 19) | En vez de un código DANE, la columna trae texto: *"fuera de servisio por falta de estudiantes"*, *"NO ES"*, *"NO EST"*. Parecen sedes cerradas o inactivas, pero no se interpreta así por cuenta propia — se dejan fuera del volcado. | Abierto |

### Hallazgos del formato APU (Aguadas y Aranzazu) — 2026-09-15

| # | Fuente | Hallazgo | Estado |
|---|---|---|---|
| H-7 | `AGUADAS/PPTO INFRAESTRUCTURA...xlsx`, hoja `MEJORAMIENTO IE ` | **El 24 % de las celdas trae errores de fórmula** (`#N/A`, `#REF!`) y **ninguna de sus 14 sedes tiene total calculable**. La hoja buena del mismo libro es **`MEJORAMIENTOS`**. Riesgo: quien abra el archivo y mire la primera hoja verá un presupuesto que no suma. Conviene pedir a la alcaldía que retire o corrija la hoja rota | Abierto |
| H-8 | `ARANZASU/...JUAN CRISOSTOMO OSORIO.xlsx`, hoja `PRESUPUESTO` | **5 de las 9 sedes presupuestadas no existen en `fctMaestra` con ese nombre**: CAMELIA PEQUEÑA, CAMELIA ALTA, LA MESETA, BUENAVISTA y SAN RAFAEL. Suman $24,7 M. O están con otro nombre en el maestro, o son sedes no registradas | Abierto — requiere que Aranzazu identifique el DANE de cada una |
| H-9 | Ambos municipios | **Administración al 30 % del costo directo** (Aguadas también 25 % en su hoja rota), muy por encima del umbral de alerta del instrumento (12 %) y del doble de la referencia de mercado (10 %). No hay tope legal, pero requiere sustentación | Abierto |
| H-10 | Ambos vs. `PrimerasPriorizadas.xlsx` | **Los presupuestos casi no cubren el lote priorizado.** Aranzazu presupuestó 9 sedes y solo **1 de sus 4 priorizadas** (Camelia Baja). Aguadas presupuestó 20 y solo **1 de sus 5** (Encimadas). Las demás priorizadas no tienen presupuesto | Abierto — bloquea el lote 1 |
| H-11 | `AGUADAS`, hoja `MEJORAMIENTOS` | **15 de las 20 sedes tienen presupuesto en $0** (ítems con cantidad cero). Solo 5 sedes traen valores reales, por $44,9 M | Abierto |
| H-12 | `AGUADAS`, hoja `MEJORAMIENTOS`, filas 130 y 147 | «SEDE SIETE CUEROS» aparece **dos veces**, bajo I.E. Encimadas y bajo I.E. El Edén. Ambas cruzan al mismo DANE `217013001145` | Abierto |
| H-13 | `fctMaestra` / catálogo, municipio Aguadas | Dos problemas de nomenclatura que impiden el cruce automático: el catálogo escribe **«RIOARRIBA»** en una palabra y las alcaldías **«RIO ARRIBA»**; y la I.E. Víboral tiene **dos sedes que el catálogo deja como principal** (`217013001111` «INSTITUCION EDUCATIVA VIBORAL - SEDE PRINCIPAL» y `217013000017` «SEDE VIBORAL»), así que una fila que dice solo «SEDE PRINCIPAL» no se puede resolver sola | Abierto — el lector ya tolera lo primero; lo segundo exige decisión humana |
| H-14 | Ambos municipios | **Ningún presupuesto incluye IVA sobre la utilidad.** El «COSTO TOTAL DE LA OBRA» de Aranzazu es costo directo + A + I + U, sin IVA. La decisión D-5 lo exige (Decreto 1372/1992 art. 3) | Abierto |

### Hallazgos de Belalcázar — 2026-09-15

El paquete de Belalcázar no es un archivo sino tres, separados por nivel de afectación
(`docs/REGISTRO_DESARROLLO.md`, entrada del mismo día). Ninguno trae DANE.

| # | Fuente | Hallazgo | Estado |
|---|---|---|---|
| H-15 | `10 INST - AFECTACION INTERMEDIA/...xlsx`, hojas `4. LA TURQUEZA`, `5. VERDUM`, `8. GAVIOTAS` | Los nombres de estas 3 sedes **no existen en el catálogo** de Belalcázar bajo ninguna institución (San Isidro, El Madroño). VERDUM es probablemente «ESCUELA NUEVA VERDUN» con variante de escritura, pero no se cruza automático porque la regla del proyecto exige coincidencia defendible, no la más parecida. TURQUEZA y GAVIOTAS no tienen candidata ni por aproximación | Abierto — requiere que Belalcázar confirme el nombre oficial de cada una |
| H-16 | Mismo archivo, hoja `3. ESCUELA SAN ISIDRO` | El nombre «ESCUELA SAN ISIDRO» es ambiguo: el catálogo tiene **dos** sedes de la I.E. San Isidro que califican como principal — `217088000080` «ESCUELA SAN ISIDRO» y `217088000535` «INSTITUCIÓN EDUCATIVA SAN ISIDRO - SEDE PRINCIPAL». No se puede elegir sola | Abierto — requiere decisión humana |
| H-17 | Mismo archivo, hoja `10. AULAS MOVILES` | «Aulas móviles» no es una sede física con DANE — es mobiliario itinerante. Con presupuesto pero sin sede que lo reciba, no se puede volcar | Abierto — decidir si se excluye del universo de sedes o se asigna a una sede anfitriona |
| H-18 | `4 INST- AFECTACION GRAVE/PPTOS COLEGIOS...xlsm`, hoja `Presupuesto`, y `presupuesto cubierta manuela beltran.xlsx` | **Los presupuestos de afectación grave son por INSTITUCIÓN, no por sede** (El Águila $600.782.132, El Madroño $73.976.609, San Isidro $45.914.334, Manuela Beltrán $207.198.086 de costo directo). El lector propone la sede principal de cada institución en el catálogo porque las sedes rurales de esas mismas instituciones ya están cubiertas por el lote de afectación intermedia y la matrícula es del orden correcto, pero es una inferencia, no un dato del archivo | Abierto — requiere que infraestructura confirme que el alcance de cada presupuesto es la sede principal completa y no varias sedes a la vez |
| H-19 | `presupuesto cubierta manuela beltran.xlsx`, hoja `Table 1` | El archivo llama «INSTITUCIÓN EDUCATIVA MANUELA BELTRÁN» a lo que en `fctMaestra`/catálogo es una **sede** («CENTRO DOCENTE MANUELA BELTRAN») de la I.E. Cristo Rey. Cruza igual por nombre de sede, pero conviene que quien mandó el archivo sepa que institucionalmente no es una I.E. aparte | Abierto — informativo, no bloquea el cruce |

### Hallazgo de la corrida del hito 1 — 2026-09-25

| # | Fuente | Hallazgo | Estado |
|---|---|---|---|
| H-20 | `SAMANA/PRESUPUESTO ESTIMADO I.E.xlsx F.xlsx` vs. `dimDañosInfraestructura.xlsx` | **Samaná presupuesta 20 sedes en las que el censo no reporta daño:** de las 51 volcadas, **17 son tipo 5 «sin afectación»** ($29.403.200) y **3 tipo 6 «no es posible determinar»** ($5.005.800) — $34,4 M de los $103,0 M del municipio. Además, 40 de las 51 traen exactamente el mismo valor ($1.688.600 o $1.658.600): parece un paquete estándar de materiales por sede más que un levantamiento de cada una (el archivo es una lista de ferretería, ver `CLAUDE.md` §3). O el censo está desactualizado para esas sedes, o el municipio presupuesta sin daño verificado. El sistema hoy solo detecta el caso contrario (declarar «sin afectación» sobre una sede con daño). Las 20 sedes: tipo 5 — `217662000191` `217662000921` `217662000387` `217662000760` `217662000336` `217662000743` `217662001995` `217662000093` `217662002738` `217662000158` `217662000417` `217662002045` `217662000280` `217662000085` `217662002550` `217662000344` `217662000352`; tipo 6 — `217662000603` `217662001987` `217662000298` | Abierto — con el censo del 2026-09-28, las 17 tipo 5 siguen igual y las 3 tipo 6 pasaron a tipo 4. Lo decide el arquitecto en la verificación o el jefe; si el sistema debe marcarlo solo, es decisión del hito 2 |
### Oficio a municipios para la confirmación de sedes — 2026-09-28

Contradicciones del «OFICIO A MUNICIPIOS 24_09_2026» (versión del 28-09) frente al censo y al sistema. La
jefatura las decidió el mismo día (D-48); siguen abiertas hasta que el texto del oficio se corrija. Texto aprobado en
`docs/PROPUESTA para jefatura - Certificado de alcaldes y ajustes al oficio v2.docx`.

| # | Fuente | Hallazgo | Estado |
|---|---|---|---|
| H-21 | Oficio vs. `dimDañosInfraestructura.xlsx` | El oficio lista 5 niveles de afectación; el censo tiene además «7. Sin revisar» (13 sedes en el censo del 2026-09-28) y los tipos 1 y 2 llevan «(PRIORITARIO)». El oficio dice que el nivel está «validado por la Unidad de Planeación», que no aplica a una sede sin revisar | Decidido 2026-09-28: se incluyen «7. Sin revisar» y «(PRIORITARIO)», y «registrado» en vez de «validado». El nivel no se responde ni se certifica. Falta corregir el oficio |
| H-22 | Oficio (interno) y `dimDaños` | «¿Hay reparaciones en curso?» («actualmente se adelantan obras») no cuadra con los estados Planeación y Contratación, en los que la obra no ha empezado; y no hay estado para obras terminadas, aunque el censo trae en `OBSERVACIONES PRESUPUESTO` «YA SE REALIZO LA REPARACION» (6 sedes) y «LA RECTORA REALIZO REPARACIONES MINIMAS» (2) | Decidido 2026-09-28: la pregunta pasa a «¿La sede tiene una intervención terminada o en proceso?» y se agrega el estado «4. Terminada». Falta corregir el oficio |
| H-23 | Oficio vs. sistema | El paso 1 dice «seleccione su municipio», pero el municipio sale del usuario, y el oficio no dice con qué correo se entra; va con copia a secretarios municipales que no tienen usuario | Decidido 2026-09-28: se entra con el correo del alcalde; se reescriben el paso 1 y el acceso. Falta corregir el oficio |
| H-24 | Oficio | «2. Gobernación» marcada en rojo en «Quién interviene» | Decidido 2026-09-28: se retira; las 9 opciones van sin numeración. Falta corregir el oficio |
| H-27 | Certificado (texto aprobado) vs. oficio final | El certificado aprobado dice «en atención a su oficio del 28 de septiembre de 2026», pero el oficio final lleva la fecha pendiente («[fecha de envío]», resaltada) y el archivo de la jefatura se llama «24_09_2026». Si el oficio sale con otra fecha, el certificado citaría un oficio con fecha distinta | **Resuelto 2026-09-29:** el oficio sale el 29 de septiembre de 2026 (confirmado por el usuario). Cambiado en `app/js/nucleo.js::CONFIRMACION_FECHA_OFICIO` y en la fecha del oficio («Manizales, 29 de septiembre de 2026») |

### Entrega del código de ingreso y datos de `Usuarios` — 2026-09-29

Hallados en la prueba desde otro PC. Detalle de la entrega por dominio en `REGISTRO_DESARROLLO.md`.

| # | Fuente | Hallazgo | Estado |
|---|---|---|---|
| H-28 | Correo del código vs. dominio `caldas.gov.co` | El código **no llega** a un correo `@caldas.gov.co` (Gobernación): figura en «Enviados» del Gmail del backend y no hay rebote. Su servidor de correo es FortiMail Cloud, que retiene o descarta en silencio. `@sedcaldas.edu.co` (Microsoft 365) y Outlook sí lo reciben | Abierto — no afecta a los alcaldes. Si un usuario de la Gobernación necesita entrar, TIC de la Gobernación puede revisar la cuarentena o autorizar el remitente |
| H-29 | Correo del código vs. dominio de Villamaría | 25 alcaldías usan Google Workspace (mismo proveedor que el remitente); **Villamaría** usa otro (`mail.1cero1.com`), sin probar | Abierto — vigilar el primer día; si no le llega, tener listo un correo alterno o el plan B de D-49 |
| H-30 | `Usuarios` (filas de rectores, del Directorio 2026) | 5 de las 161 filas de rectores traen un `correo` que no sirve para entrar: 4 con dos correos en la misma celda y 1 con números de teléfono en vez de correo | Abierto — sin efecto en la confirmación (los rectores no entran, D-48, y están inactivos). Corregir antes de habilitar a los rectores |
| H-31 | Pensilvania (llamada del encargado de la alcaldía, 2026-09-30) vs. universo de 975 | El encargado reporta que en la aplicación faltan 2 sedes de las 85 de Pensilvania. Al cruzar con `fctMaestra`, las candidatas más probables son `217541000533` ALTO CAUNCE y `217541000789` PLAYA RICA: activas en el DUE (hoja `Sedes`) pero sin matrícula, por lo que quedan fuera del universo declarado (oficiales + activas + con matrícula = 975). Se preparó para la alcaldía el listado de sus 85 sedes (fuera del repositorio, `trabajo30.09_pensilvania/`) para que confirme cuáles son | Abierto — a la espera de la jefatura: incluirlas cambia el universo y los datos de la campaña (congelada hasta el 2026-10-06). Mientras tanto, la alcaldía puede reportarlas por fuera del sistema |
| H-32 | Certificados cargados (campaña de confirmación, corte 2026-10-07) | Tres alcaldías (Manzanares, La Dorada y Aranzazu) cargaron el certificado sin el formato oficial de su alcaldía. El servidor nunca lee el PDF, así que no lo detecta: se supo al revisar los archivos. Causa probable: el paso del formato era una frase dentro del paso 2 y el paso 3 decía «Fírmela» (corregido en D-53, publicado el 2026-10-07, `?v=20`). Se preparó el correo con las instrucciones (fuera del repositorio) | Abierto — pendiente que rehagan y carguen otro escaneo; el anterior queda como historial (D-37). Revisión de cada PDF en el panel: propuesta pendiente |

### Actualización del censo — 2026-09-28

Al cruzar «BASE DE DATOS ACTUALIZADA 28_09_2026.xlsx» contra el censo del 2026-09-16 por DANE (975 de 975; 185
cambios de tipo). Se reporta lo que no se explica solo con «los arquitectos visitaron la sede».

| # | Fuente | Hallazgo | Estado |
|---|---|---|---|
| H-25 | Censo 28-09 vs. 16-09 | `217541001033` CENTRO EDUCATIVO PATIO BONITO (Pensilvania) pasó de «4. Afectaciones menores» a **«7. Sin revisar»**: una sede ya clasificada volvió a sin revisar, y su observación habla de controlar áreas afectadas mientras se hacen reparaciones, o sea que sí fue vista | **Resuelto 2026-09-28, decisión del usuario:** queda en «4. Afectaciones menores». Corregido en la copia de trabajo `dimDañosInfraestructura.xlsx` (respaldo `BACKUP-20260928-154644`); el archivo recibido no se toca. Si el próximo censo lo vuelve a traer como 7, hay que corregirlo otra vez: conviene que se corrija en la base de origen |
| H-26 | Censo 28-09 vs. 16-09 | Tres sedes dejan de ser tipo 2 y pasan a tipo 3: `217013000602` I.E. ENCIMADAS - SEDE PRINCIPAL (Aguadas), `217050000221` ESCUELA RURAL ANTONIA SANTOS y `217050000043` ESCUELA RURAL LA FLORESTA (Aranzazu). Entran 11 al tipo 1-2 (de 37 a 45). Si alguna estaba en un lote por ser tipo 1-2, sigue en él: los lotes no dependen del tipo (D-44) | Informativo |

## Resueltos

*(ninguno todavía)*
