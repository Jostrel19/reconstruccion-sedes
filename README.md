# Reconstrucción de sedes — SED Caldas

Sistema interno de trazabilidad del presupuesto de reconstrucción de infraestructura educativa
afectada por el sismo del 10 de agosto de 2026: presupuesto real por sede (radicado por alcaldes y
rectores, o cargado por los arquitectos desde Excel), verificación técnica, y control administrativo
completo.

Secretaría de Educación de Caldas — practicante TIC.

- **Qué es el sistema y hasta dónde llega, en un solo documento:** [`docs/ALCANCE_Y_REQUISITOS.md`](docs/ALCANCE_Y_REQUISITOS.md)
- **Decisiones, reglas de datos y estado — la fuente de verdad:** [`CLAUDE.md`](CLAUDE.md)
- **Plan de construcción, orden de pasos, qué falta:** [`docs/PLAN_DESARROLLO.md`](docs/PLAN_DESARROLLO.md)
- **Bitácora cronológica de cómo se llegó hasta acá:** [`docs/REGISTRO_DESARROLLO.md`](docs/REGISTRO_DESARROLLO.md)
- **Discrepancias de datos sin resolver:** [`docs/CONFLICTOS_Y_HALLAZGOS.md`](docs/CONFLICTOS_Y_HALLAZGOS.md)

> Varios documentos en `docs/` describen el **aplicativo anterior** (2026-09-09 y antes: formulario
> público para alcaldes con token, backend SharePoint/Power Automate). Ese diseño se retiró como
> puerta de entrada — ver D-17/D-18 en `CLAUDE.md` — y cada uno de esos archivos lleva un aviso al
> inicio. La arquitectura vigente es la de este README y la de `CLAUDE.md`.

---

## Qué es hoy

Cuatro roles, un mismo backend:

| Rol | Qué hace |
|---|---|
| **Administrador** | Control total: usuarios, hallazgos, todas las pantallas |
| **Verificador** (arquitecto) | Revisa y emite concepto sobre lo radicado, todo el departamento |
| **Responsable de sede** (alcalde o rector) | Digita el presupuesto de sus sedes, sección por sección |
| **Consulta** (directivo) | Ve el panorama completo, solo lectura |

Dos caminos de captura que terminan en el mismo registro versionado: **diligenciamiento manual**
(alcaldes/rectores, ítem por ítem) y **carga masiva** (arquitectos, desde el Excel que ya mandó el
municipio). El detalle completo de objetivos, alcance por rol y capítulos de presupuesto está en
`docs/PLAN_DESARROLLO.md` §1-2.

---

## Arquitectura

```
Frontend (GitHub Pages, sin build, sin dependencias)
   docs/diseno/mockup_v6.html   ← diseño aprobado, HTML/CSS/JS autocontenido
   (el frontend real se construye a partir de este archivo, ver Paso 2 del plan)
        │  fetch — login por código de correo (D-20)
        ▼
Backend — Google Apps Script (D-19), desplegado desde Gmail personal (D-19 precisada)
   Web App (doGet/doPost) ── MailApp (código de un solo uso, entrega SMTP normal a Office 365)
        │
        ▼
Google Sheet, 6 pestañas — columnas exactas en CLAUDE.md §6
   Sedes · Presupuestos · Items · Verificaciones · Usuarios · Hallazgos
```

**Por qué Apps Script y no SharePoint/Power Automate:** la Gobernación no tiene licencia Premium de
Power Automate (D-1, anulada) y las cuentas institucionales son de Microsoft 365, no de Google — no
hay forma de desplegar con una cuenta "de la Secretaría". Se sigue el mismo patrón que `circular122`
(otro sistema de la SED): Apps Script desplegado desde el Gmail personal de quien lo mantiene, gratis
y sin registro en Entra ID. El correo de un solo uso llega igual a Outlook por SMTP normal — ningún
usuario final inicia sesión en Google.

**`tools/` no es parte del sistema en producción.** Genera el catálogo que alimenta la pestaña
`Sedes` y lee los Excel que mandan los municipios antes de que existiera la carga masiva dentro del
sistema — son utilidades de preparación de datos, no el backend.

---

## Estructura del proyecto

```
reconstruccion-sedes/
├── CLAUDE.md                    decisiones, reglas de datos, estado — fuente de verdad
├── docs/
│   ├── PLAN_DESARROLLO.md         plan vigente: objetivos, roles, pasos, pendientes
│   ├── REGISTRO_DESARROLLO.md     bitácora cronológica
│   ├── CONFLICTOS_Y_HALLAZGOS.md  19 discrepancias de datos abiertas
│   ├── PRUEBA_DESPLIEGUE_APPS_SCRIPT.md
│   ├── diseno/
│   │   ├── mockup_v6.html           diseño vigente, ejecutable (ver «Probar el diseño»)
│   │   └── DISENO_00..05_*.md       diseño previo a D-26, parcialmente desactualizado
│   └── (ANALISIS_*, AUTOMATIZACION_*, GUIA_SHAREPOINT_*, GUION_*, HANDOFF_*)
│       — documentan el aplicativo anterior, cada uno con aviso de vigencia al inicio
├── backend/                      código fuente del backend Apps Script (D-19) — se pega a mano
│   │                             en script.google.com, ver backend/README.md
│   ├── Setup.gs                   crea las 6 pestañas (Paso 0)
│   ├── Codigo.gs                  doGet/doPost, registro de acciones
│   ├── Auth.gs                    login por código de un solo uso (D-20)
│   └── Sedes.gs                   listado de sedes filtrado por rol/alcance (D-6, D-24, D-25)
├── tools/
│   ├── rutas.py                    punto único de rutas — nada más trae rutas absolutas
│   ├── build_catalogo.py           fuentes oficiales -> catalogo_sedes.json (975 sedes)
│   ├── exportar_backend.py         catalogo_sedes.json / usuarios_borrador.csv -> CSV del Sheet
│   ├── ingesta.py                  registro de lectores de Excel por municipio
│   ├── ingesta_samana.py · ingesta_apu.py · ingesta_belalcazar.py
│   ├── ingesta_esquema.py          esquema común de salida (RegistroIngesta, Hallazgo)
│   ├── generar_usuarios_borrador.py  borrador de la pestaña Usuarios
│   ├── servir.py · versionar.py    utilidades del aplicativo anterior, aún válidas
│   └── _retirado/                  8 scripts del circuito SharePoint/Power Automate, con LEEME.md
├── web/                          aplicativo anterior (D-18): retirado como puerta de entrada,
│   │                             pdf.js/formulario.js/config.js se reutilizan al construir
│   │                             «Registrar presupuesto» (D-33)
│   └── assets/js/...
└── data/
    ├── generado/                   catalogo_sedes.json y artefactos — NO se versiona
    ├── insumos/                    fctMaestra, dimDaños, usuarios_manual.csv — NO se versiona
    ├── entregas_excel/             Excel reales de municipios — NO se versiona
    └── privado/                    NO se versiona
```

`data/` no está en git salvo su estructura implícita — son documentos oficiales, presupuestos reales
de municipios y contactos personales (ver `.gitignore`). Las fuentes institucionales (`fctMaestra`,
etc.) viven fuera del proyecto; su ubicación se resuelve en `tools/rutas.py` y se puede sobrescribir
con `SED_FUENTES`.

---

## Puesta en marcha

```bash
pip install -r tools/requirements.txt
```

### Regenerar el catálogo de sedes

```bash
python tools/build_catalogo.py
```

Cruza `fctMaestra.xlsx`, `dimDañosInfraestructura.xlsx` (censo de daños, D-26), el Directorio de I.E.
y la base de funcionarios; escribe `data/generado/catalogo_sedes.json` — es lo que alimenta la
pestaña `Sedes` del backend. Imprime cada cruce difuso para verificarlo uno por uno.

### Leer un presupuesto real de un municipio

```bash
python tools/ingesta.py SAMANA
python tools/ingesta.py BELALCAZAR "data/entregas_excel/BELALCAZAR"
```

Un lector por municipio, registrado en `tools/ingesta.py::LECTORES`. Nunca se adivina el lector de un
municipio cuyo Excel no se ha visto (ver `docs/diseno/DISENO_04_MODULO_INGESTA.md`). Hoy hay lector
para Samaná, Aguadas, Aranzazu y Belalcázar; el resultado imprime un informe con lo que se pudo leer
y lo que quedó como hallazgo, nunca vuelca algo dudoso en silencio.

### Probar el diseño vigente

```bash
python tools/servir.py
```

Abrir `docs/diseno/mockup_v6.html`. El selector **«Ver como»** cambia entre los cuatro roles: las
pantallas fuera de alcance quedan tachadas y el valor de referencia desaparece para Responsable de
sede (D-6).

---

## Dónde vive cada cosa — y qué no se versiona

| Qué | Dónde | ¿En git? |
|---|---|---|
| Decisiones y reglas de negocio | `CLAUDE.md` | Sí |
| Diseño aprobado | `docs/diseno/mockup_v6.html` | Sí |
| Catálogo de sedes generado | `data/generado/catalogo_sedes.json` | No — se regenera |
| Fuentes institucionales (`fctMaestra`, `dimDaños`) | `data/insumos/` | No — datos oficiales |
| Presupuestos reales de municipios | `data/entregas_excel/` | No — cifras institucionales, contactos |
| Lista de usuarios internos confirmados | `data/insumos/usuarios_manual.csv` | No — nombres y correos reales |
| Backend Apps Script (por construir) | Google Sheet + proyecto de Apps Script, fuera del repo | N/A — vive en Google, no en archivos locales |

El proyecto no depende de rutas absolutas: se puede mover completo sin editar nada, salvo
`SED_FUENTES` si las fuentes institucionales quedan en otro lugar.
