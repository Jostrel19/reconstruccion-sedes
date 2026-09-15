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

## Resueltos

*(ninguno todavía)*
