"""Punto de entrada de la ingesta de presupuestos de alcaldía (D-17 fase 3).

Registro de lectores: un municipio, una función lectora. Empieza vacío salvo
por lo que ya se ha visto de verdad; se le agrega una entrada cada vez que se
escribe el lector de un municipio nuevo, sin tocar los demás. Nunca se
adivina el lector de un municipio cuyo archivo no se ha visto — ver
docs/diseno/DISENO_04_MODULO_INGESTA.md.

Uso:
    python tools/ingesta.py SAMANA
        (busca el primer .xlsx/.xlsm en data/entregas_excel/SAMANA/)
    python tools/ingesta.py SAMANA "data/entregas_excel/SAMANA/archivo.xlsx"
        (ruta explícita)
"""
from __future__ import annotations

import sys
from pathlib import Path

import rutas
from ingesta_esquema import imprimir_informe
import ingesta_samana
import ingesta_apu
import ingesta_belalcazar

LECTORES = {
    "SAMANA": ingesta_samana.leer,
    "ARANZASU": ingesta_apu.leer,   # la carpeta llegó escrita así; el municipio es ARANZAZU
    "ARANZAZU": ingesta_apu.leer,
    "AGUADAS": ingesta_apu.leer,    # el lector sirve; el archivo actual está roto (ver H-7)
    "BELALCAZAR": ingesta_belalcazar.leer,
}

# Lectores que reciben la CARPETA del municipio en vez de un solo archivo:
# Belalcázar mandó tres excels en subcarpetas fijas, no uno solo (ver
# ingesta_belalcazar.py), así que no aplica el "primer .xlsx de la carpeta".
LECTORES_POR_CARPETA = {"BELALCAZAR"}

# El nombre de la carpeta no siempre es el nombre del municipio en el catálogo.
MUNICIPIO_CANONICO = {"ARANZASU": "ARANZAZU"}


def _archivo_por_defecto(municipio: str) -> Path:
    carpeta = rutas.ENTREGAS_EXCEL / municipio
    if not carpeta.is_dir():
        raise SystemExit(f"No existe {carpeta}")
    candidatos = sorted(carpeta.glob("*.xlsx")) + sorted(carpeta.glob("*.xlsm"))
    if not candidatos:
        raise SystemExit(f"No hay .xlsx/.xlsm directamente en {carpeta}")
    if len(candidatos) > 1:
        print(f"Aviso: hay {len(candidatos)} archivos en {carpeta}, se usa el primero: {candidatos[0].name}")
    return candidatos[0]


def main():
    if len(sys.argv) not in (2, 3):
        print("Uso: python tools/ingesta.py <MUNICIPIO> [ruta_al_excel]")
        raise SystemExit(1)

    municipio = sys.argv[1].upper()
    lector = LECTORES.get(municipio)
    if not lector:
        print(f"No hay lector para {municipio} todavía. Lectores disponibles: {sorted(LECTORES)}")
        raise SystemExit(1)

    if len(sys.argv) == 3:
        ruta = Path(sys.argv[2])
    elif municipio in LECTORES_POR_CARPETA:
        ruta = rutas.ENTREGAS_EXCEL / municipio
        if not ruta.is_dir():
            raise SystemExit(f"No existe {ruta}")
    else:
        ruta = _archivo_por_defecto(municipio)
    canonico = MUNICIPIO_CANONICO.get(municipio, municipio)
    registros, hallazgos = lector(str(ruta), canonico)
    imprimir_informe(canonico, registros, hallazgos)
    return registros, hallazgos


if __name__ == "__main__":
    main()
