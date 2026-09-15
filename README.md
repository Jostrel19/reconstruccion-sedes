# Informe técnico-presupuestal por sede

Aplicativo web para que las 26 alcaldías de los municipios no certificados de Caldas radiquen, sede
por sede, el presupuesto de reparación de la infraestructura educativa afectada por el sismo del
10 de agosto de 2026.

Secretaría de Educación de Caldas — Dirección de Planeación.

- **Qué hace y por qué está diseñado así:** [`docs/GUIA_SHAREPOINT_Y_FUNCIONAMIENTO.md`](docs/GUIA_SHAREPOINT_Y_FUNCIONAMIENTO.md)
- **Análisis del instrumento:** [`docs/ANALISIS_INSTRUMENTO_PRESUPUESTAL.md`](docs/ANALISIS_INSTRUMENTO_PRESUPUESTAL.md)
- **Decisiones, reglas de datos y estado:** [`CLAUDE.md`](CLAUDE.md)

---

## Estructura

```
presupuesto-sedes/
├── web/                        raíz publicable — esto y solo esto va al hosting
│   ├── index.html                aplicativo de la alcaldía
│   ├── consola.html              consola de verificación (uso interno, no publicar)
│   └── assets/
│       ├── css/styles.css
│       └── js/                   ver «Capas» más abajo
├── tools/                      generación de artefactos (no se publica)
│   ├── rutas.py                  punto único de configuración de rutas
│   ├── build_catalogo.py         fuentes oficiales -> catálogo
│   ├── generar_enlaces.py        tokens, hashes y enlaces por alcaldía
│   ├── gen_instructivo.py        instructivo en Word
│   ├── versionar.py              sube la versión y refresca la caché
│   ├── servir.py                 servidor local de pruebas
│   └── requirements.txt
├── data/
│   ├── generado/                 catalogo_sedes.json  (artefacto, regenerable)
│   └── privado/                  tokens en claro y enlaces — NUNCA se publican
└── docs/                       análisis, guía de montaje e instructivo
```

**El límite importante es `web/`.** Todo lo que está ahí es público; todo lo demás no. Dos
excepciones que viven en `web/` pero **no deben publicarse** y están en `.gitignore`:
`consola.html` y `assets/js/data-sed.js`, porque llevan el valor estimado por el modelo.

---

## Capas del cliente

El aplicativo es HTML, CSS y JavaScript sin framework ni dependencias externas: no carga nada de
terceros. Los archivos están separados por responsabilidad y se cargan en orden de dependencia.

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Configuración | `config.js` | Parámetros de negocio: backend, IVA, umbrales, catálogos cerrados |
| Datos | `data.js` · `data-sed.js` · `tokens.js` | Catálogos y hashes. **Generados: no editar a mano** |
| Utilidades | `util.js` | Formato, escape, etiquetas. Compartido por las dos pantallas |
| Persistencia | `storage.js` | Borradores, registros, versionado, importación |
| Transporte | `api.js` | Único punto que conoce el backend |
| Presentación | `pdf.js` | Formato oficial diligenciado |
| Interfaz | `tablero.js` · `formulario.js` · `consola.js` | Pantallas |
| Arranque | `app.js` | Enrutado, token, sesión |

Reglas que sostienen la separación:

- **`api.js` es el único que sabe cómo se envía.** Cambiar de backend es cambiar `BACKEND` y
  `ENDPOINT_URL` en `config.js`; ninguna pantalla se entera.
- **`storage.js` es el único que toca `localStorage`.**
- **Los archivos generados no se editan:** se regeneran con `tools/`.
- **Los parámetros de negocio viven en `config.js`,** no dispersos en la lógica. Los umbrales de
  alerta de A y U se ajustan ahí sin tocar código.

---

## Puesta en marcha

```bash
pip install -r tools/requirements.txt
```

Los `.xlsx` de la Secretaría viven fuera del proyecto porque son documentos oficiales con su propio
ciclo de vida. Si no están donde `tools/rutas.py` espera:

```bash
SED_FUENTES="D:/ruta/a/las/fuentes" python tools/build_catalogo.py
```

### Regenerar el catálogo

```bash
python tools/build_catalogo.py
```

Cruza `fctMaestra.xlsx`, el anexo de estimación, el Directorio de I.E. y la base de funcionarios, y
escribe `data/generado/catalogo_sedes.json`, `web/assets/js/data.js` y `web/assets/js/data-sed.js`.
Imprime cada cruce difuso para que se verifique uno por uno.

### Generar los enlaces

```bash
python tools/generar_enlaces.py
python tools/generar_enlaces.py https://mi-dominio.gov.co/presupuesto/   # otra URL base
```

Los tokens se conservan entre ejecuciones: regenerar el catálogo **no invalida enlaces ya
repartidos**. Escribe `data/privado/tokens.json` (en claro, no se publica),
`web/assets/js/tokens.js` (solo hashes) y `data/privado/enlaces_alcaldias.csv`.

### Probar en local

```bash
python tools/servir.py
```

Sirve `web/` sin caché en `http://127.0.0.1:8777`. El token de cada municipio está en
`data/privado/tokens.json`.

### Consolidar lo que entregaron los municipios

```bash
python tools/consolidar.py "C:/Users/<usuario>/OneDrive - .../Entregas"
```

Lee todos los `.json` de la carpeta —OneDrive la sincroniza al disco— y escribe
`data/generado/CONSOLIDADO_<fecha>.xlsx` con cuatro hojas: avance por municipio, un registro por
sede, el detalle de actividades y las sedes que faltan por radicar. Extrae también las fotografías
a `data/generado/fotos/<dane_sede>/`.

Escribe además `data/generado/CONSOLIDADO.xlsx`, de nombre fijo. **Power BI se conecta a ese**: si
apuntara al fechado, la conexión se rompería cada día. Los fechados quedan como histórico.

Se puede correr las veces que se quiera. Si un municipio reenvía una sede, conserva la versión más
alta y reporta cuántos reenvíos ignoró.

### Que el consolidado se rehaga solo

```bash
python tools/vigilar.py "C:/Users/<usuario>/OneDrive - .../Entregas"
```

Mira la carpeta cada 20 segundos y vuelve a consolidar en cuanto un municipio sube algo. Espera a
que OneDrive termine de sincronizar antes de leer —un `.json` a medio bajar es un `.json` roto— y si
el libro está abierto en Excel avisa y reintenta en la siguiente vuelta en lugar de detenerse.

### Preparar lo que se sube al hosting

```bash
python tools/preparar_publicacion.py
```

Sube la versión, refresca el sufijo `?v=` y rehace `data/generado/publicar/` con los 13 archivos
publicables. Excluye `consola.html`, `consola.js` y `data-sed.js`, y **se detiene** si algo de lo que
iba a publicar menciona `valor_modelo`. Siempre publicar desde esa carpeta: una copia hecha a mano se
queda vieja y termina subiendo una versión que no es la actual.

Acepta `1.0.0` para fijar la versión o `--misma` para no tocarla. Sin argumentos sube el último
número, que es lo correcto al publicar una corrección.

### Publicar una corrección

```bash
python tools/versionar.py 0.2.0
```

Sube `APP_CONFIG.VERSION` y refresca el sufijo `?v=` de todos los recursos en los dos HTML. **Sin
esto, quien ya entró seguirá con el JavaScript viejo en caché** y la corrección no le llegará.

---

## Migración a producción

1. Publicar el contenido de `web/` (sin `consola.html` ni `data-sed.js`).
2. Ajustar `URL_BASE` en `tools/rutas.py` — o pasarla como argumento — y regenerar los enlaces.
3. Desplegar `consola.html` y `data-sed.js` en un sitio interno, no público.
4. Montar el SharePoint según [`docs/GUIA_SHAREPOINT_Y_FUNCIONAMIENTO.md`](docs/GUIA_SHAREPOINT_Y_FUNCIONAMIENTO.md).
5. Cuando exista el flujo de Power Automate, cambiar `BACKEND` a `'http'` y poner su URL en
   `ENDPOINT_URL`. El resto del aplicativo no cambia.

El proyecto no depende de rutas absolutas: se puede mover completo a otra carpeta, a otro equipo o
a un repositorio sin editar nada, salvo `SED_FUENTES` si las fuentes quedan en otro lugar.
