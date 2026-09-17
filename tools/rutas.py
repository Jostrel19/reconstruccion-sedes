"""Rutas del proyecto — punto único de configuración.

Todo lo que depende de dónde vive el proyecto se resuelve aquí. Ningún otro
script debe traer rutas absolutas: al migrar a producción se cambia este archivo
y nada más.

Las rutas internas se calculan desde la ubicación de este archivo, así que el
proyecto se puede mover completo sin tocar nada.

Las fuentes institucionales (los .xlsx de la Secretaría) viven FUERA del
proyecto porque son documentos oficiales con su propio ciclo de vida. Su
ubicación se puede sobrescribir con la variable de entorno SED_FUENTES:

    SED_FUENTES="D:/datos/sed" python tools/build_catalogo.py
"""
from __future__ import annotations

import os
from pathlib import Path

# --- Raíz del proyecto -------------------------------------------------------
RAIZ = Path(__file__).resolve().parent.parent

WEB = RAIZ / "web"
JS = WEB / "assets" / "js"
CSS = WEB / "assets" / "css"

DATA = RAIZ / "data"
GENERADO = DATA / "generado"
PRIVADO = DATA / "privado"
DOCS = RAIZ / "docs"

# Excel reales de presupuesto tal como los mandan las alcaldías (módulo de
# ingesta, D-17 fase 3). Un subdirectorio por municipio; nunca se editan.
ENTREGAS_EXCEL = DATA / "entregas_excel"

# --- Artefactos generados ----------------------------------------------------
CATALOGO_JSON = GENERADO / "catalogo_sedes.json"

DATA_JS = JS / "data.js"          # catálogo público, sin el valor del modelo
DATA_SED_JS = JS / "data-sed.js"  # catálogo reservado, uso interno

# --- Fuentes institucionales -------------------------------------------------
# Por defecto, la carpeta que contiene este proyecto y sus hermanas
# (gobernacionCaldasPractica). El proyecto vive en la raíz desde el 2026-09-09
# (antes colgaba de «trabajo 8.09», que además fue renombrada a
# «trabajoInstrumentoControlReconstruccion» — ambos cambios se reflejan aquí).
_DEFECTO = RAIZ.parent
FUENTES = Path(os.environ.get("SED_FUENTES", _DEFECTO))

F_MAESTRA = FUENTES / "trabajo 27.08" / "fctMaestra.xlsx"
F_DIRECTORIO = FUENTES / "trabajo 3.09" / "Directorio Instituciones Educativas 2026.xlsx"
F_FUNCIONARIOS = FUENTES / "trabajoInstrumentoControlReconstruccion" / "Base de datos Funcionarios 2026.xlsx"

# Censo de daños vivo, mantenido por los arquitectos (D-26). Reemplaza como
# fuente a «ESTIMACION COSTOS RECONSTRUCCION SEDES OFICIALES 08_09_2026.xlsx»,
# el modelo paramétrico, que queda RETIRADO del sistema: ya no se lee, no se
# contrasta contra él y su valor no se guarda en ningún lado.
#
# Vive dentro del proyecto (data/insumos/) y no en FUENTES porque no es un
# entregable cerrado de otra dirección: es un archivo que se actualiza a medida
# que los arquitectos visitan sedes y que se vuelve a leer en cada build.
F_DIM_DANOS = DATA / "insumos" / "dimDañosInfraestructura.xlsx"
H_DIM_DANOS = "EstadoInfraestructura"

# --- Salida del consolidado --------------------------------------------------
# Dónde quedan CONSOLIDADO.xlsx, los fechados y las fotografías extraídas. Por
# defecto dentro del proyecto; se apunta a una carpeta de OneDrive para que la
# jefatura vea el consolidado sin depender de este equipo:
#
#     SED_SALIDA="C:/Users/.../OneDrive - .../Consolidado" python tools/vigilar.py ...
#
# CUIDADO: esta carpeta NO puede ser la que se comparte con las alcaldías ni
# estar dentro de ella. El consolidado contiene el valor estimado por el modelo
# y los datos de los 26 municipios; ponerlo ahí rompería D-6 y le mostraría a
# cada alcalde lo que reportaron los demás.
SALIDA = Path(os.environ.get("SED_SALIDA", GENERADO))

# --- Parámetros de publicación ----------------------------------------------
# Debe coincidir con APP_CONFIG.VERSION en web/assets/js/config.js.
# Al subirla hay que refrescar el sufijo ?v= de los HTML (tools/versionar.py).
VERSION = "0.9.2"


def verificar_fuentes() -> list[Path]:
    """Devuelve las fuentes que no se encuentran, para fallar con un mensaje
    claro en vez de con un traceback de openpyxl."""
    return [p for p in (F_MAESTRA, F_DIM_DANOS, F_DIRECTORIO, F_FUNCIONARIOS)
            if not p.exists()]


def exigir_fuentes() -> None:
    faltan = verificar_fuentes()
    if faltan:
        print("No se encontraron estas fuentes institucionales:")
        for p in faltan:
            print(f"  - {p}")
        print(f"\nRuta base actual: {FUENTES}")
        print("Ajústela con la variable de entorno SED_FUENTES o edite tools/rutas.py")
        raise SystemExit(1)


def asegurar_directorios() -> None:
    for d in (GENERADO, SALIDA, PRIVADO, JS, DOCS):
        d.mkdir(parents=True, exist_ok=True)
