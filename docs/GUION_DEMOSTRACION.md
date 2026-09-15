# Guion de la demostración

Doce minutos. El objetivo es que se avale el instrumento y se autorice continuar, no lucir el
desarrollo.

---

## Antes de empezar (5 minutos, a solas)

**1. Levantar el aplicativo**

```
python tools/servir.py
```

**2. Cargar los datos de demostración en la consola**

Abrir `http://127.0.0.1:8778/consola.html` → botón **«Cargar paquetes .json»** → seleccionar
**los 9 archivos** de `docs/demo/`.

Debe quedar así:

| | |
|---|---|
| Registros | 11 |
| Con presupuesto | 8 |
| Sin afectación | 3 |
| Discrepancias | 1 |
| Costo directo comparable | $396.000.000 |
| Valor del modelo | $325.250.000 |
| **Desviación** | **+21,8 %** |

**3. Dejar abiertas dos pestañas**

- `http://127.0.0.1:8778/index.html?m=RIOSUCIO&t=BAGG8CQZX2` — el aplicativo de la alcaldía
- `http://127.0.0.1:8778/consola.html` — la consola de la Secretaría

**4. Tener a mano** el PDF de una sede ya generado, por si falla la impresión en vivo.

> Los tokens de todos los municipios están en `data/privado/tokens.json`.

---

## La demostración

### 1. El problema, en treinta segundos

> «La Dirección de Planeación estimó $23.348 millones para reparar 456 sedes. Pero el oficio dice
> que esa cifra no constituye presupuesto de obra. Para sustentarla ante el Ministerio hay que
> pedirle a cada municipio el presupuesto real, sede por sede. Son 975 sedes en 26 municipios. Esto
> es lo que evita que eso se haga con archivos de Excel por correo.»

### 2. El tablero de la alcaldía — Riosucio

Abrir la pestaña de Riosucio.

> «Este es el enlace que recibe el alcalde de Riosucio. Sus 92 sedes ya están cargadas, con lo que
> encontró la visita técnica del 27 de agosto. No tiene que buscar nada ni escribir ningún código
> DANE.»

**Oprimir «Confirmar las 30 sin afectación».**

> «Treinta sedes resueltas en un segundo. Le quedan las 58 que sí necesitan presupuesto. Esto es lo
> que hace la diferencia entre que se cumpla y que no.»

### 3. El formulario — una sede

Abrir cualquier sede tipo 3.

Señalar, sin detenerse mucho:
- El DANE viene del catálogo y **no se puede digitar**.
- La clasificación del censo se muestra pero **no se puede modificar**.
- El capítulo de daño y la unidad son listas cerradas.

**Escribir cantidad `1.200` y valor unitario `85.000`, con puntos.**

> «El total lo calcula el sistema: costo directo, administración, utilidad e IVA sobre la utilidad.
> El alcalde no suma nada. En el formato en Word los tres valores se digitan y nunca cuadran.»

**Subir `A%` a 20.** Aparece la alerta.

> «Avisa, pero deja radicar. No existe un tope legal de AIU en Colombia —cada entidad es autónoma—
> así que lo correcto es señalar la desviación frente a la práctica de mercado, no bloquear.»

### 4. El PDF

Generar el PDF de una sede.

> «Es el mismo formato que ya aprobó Planeación, diligenciado, con las casillas marcadas y el
> espacio de firma.»

### 5. La consola — aquí está el argumento

Pasar a la consola.

> «Esto es lo que ve la Secretaría. Marulanda ya terminó: 11 sedes, 8 con presupuesto, 3 sin
> afectación.»

Señalar la desviación: **+21,8 %**.

> «Al lado de cada presupuesto municipal está lo que estimó la Secretaría. Marulanda pidió 396
> millones donde el modelo estimó 325. La diferencia es esperada: el modelo no incluye AIU ni IVA.
> Lo importante es que ahora se puede sustentar sede por sede.»

Señalar **La Alejandría, +61 %**.

> «Esta se sale del patrón y queda marcada para revisión. Sin este instrumento habría pasado
> inadvertida entre 554 presupuestos.»

Señalar la **discrepancia** de Mercedes Ábrego.

> «El censo la clasificó sin afectación y el municipio declara que sí la tiene. El sistema no lo
> impide: lo registra, exige justificación y lo deja para que la Secretaría decida. Así no quedan
> dos verdades sobre la misma sede.»

**Abrir «Verificar»** en cualquier sede: mostrar los cuatro resultados del formato, las
observaciones y la firma con nombre y cédula.

### 6. Cierre — qué se necesita

> «El instrumento está funcionando y auditado. Para salir mañana falta una sola cosa: el sitio de
> SharePoint con una carpeta por alcaldía. Eso no lo puedo hacer yo solo, necesita autorización.»

---

## Si preguntan

**«¿Cuánto cuesta?»**
Cero. No requiere comprar licencias. Se usa lo que ya tiene la Gobernación.

**«¿Y no teníamos que comprar Power Automate?»**
Se descartó ese camino. El que quedó funciona con los conectores estándar que ya vienen incluidos.

**«¿Cuándo lo pueden usar los municipios?»**
El mismo día que esté el SharePoint. Recomiendo empezar con uno o dos municipios pequeños y
acompañarlos por teléfono antes de mandarlo a los 26.

**«¿Esto reemplaza el formato en Word?»**
No: lo reproduce. Genera el mismo documento, diligenciado y con los cálculos correctos.

**«¿Qué pasa si un alcalde se equivoca?**
Puede corregir y volver a radicar. Queda la versión 2 y la 1 se conserva.

**«¿Se puede ver todo en un tablero?»**
Sí. Está especificado y es el siguiente paso: el municipio sube, la información entra sola a las
listas y Power BI se actualiza. Ahí usted abre el tablero y ve el avance sin pedirle nada a nadie.

**«¿Esto ya se probó?»**
Sí, y aparecieron tres defectos que se corrigieron: los campos rechazaban cifras escritas como
`1.500.000`, los borradores se perdían en municipios grandes, y las fotografías se dañaban al
reabrir una sede. Los tres están corregidos y verificados.

---

## Lo que conviene decir sin que lo pregunten

**Que hubo tres defectos y se corrigieron.** Que un instrumento haya sido auditado antes de salir es
un argumento a favor. Si aparecen después, en manos de un alcalde, el costo es otro.

**Que hay un paso manual del alcalde**: descarga un archivo y lo sube a su carpeta. No es «oprimir
enviar». Quitarlo requiere una pieza adicional que cuesta centavos pero necesita autorización de
TI. Mejor que lo sepa ahora.

**Que los borradores viven en el computador donde se digitó.** Si el alcalde cambia de equipo, los
pierde. Está advertido en el instructivo.

---

## Después de la demostración

Borrar los datos de demostración antes de usar la consola con información real: en la consola,
consola del navegador (F12) → `localStorage.clear()` → recargar.

Los archivos de `docs/demo/` están marcados con `"_demostracion": true` y no deben subirse a
SharePoint.
