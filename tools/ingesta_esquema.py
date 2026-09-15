"""Esquema común al que convergen todos los lectores de presupuesto de alcaldía.

Cada municipio manda un formato distinto (ver docs/diseno/DISENO_04_MODULO_INGESTA.md),
así que hay un lector por familia de formato. Ninguno de esos lectores conoce a los
demás: todos devuelven lo mismo, `RegistroIngesta` + `Hallazgo`, para que el resto
del sistema (informe de validación, módulo 2, módulo 3) no tenga que saber de dónde
vino cada dato.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RegistroIngesta:
    # None cuando el archivo NO trae DANE y hubo que proponerlo por nombre.
    # Un registro con dane_sede None NO se vuelca: espera confirmación humana.
    dane_sede: int | None
    municipio: str
    costo_directo: float
    sede: str = ""
    archivo_origen: str = ""
    # Cómo se obtuvo el DANE: 'archivo' (venía en el Excel) o 'propuesto'
    # (lo dedujo el lector cruzando por nombre, y hay que confirmarlo).
    dane_origen: str = "archivo"
    dane_propuesto: int | None = None
    # Lo que el lector quiera conservar para auditoría (hoja, fila, columnas
    # que sumó...). No tiene forma fija porque cada lector audita cosas distintas.
    detalle: dict = field(default_factory=dict)


@dataclass
class Hallazgo:
    severidad: str  # 'error' (no se vuelca) | 'advertencia' (se vuelca con nota)
    motivo: str
    referencia: str = ""  # hoja/fila, para poder ir a mirar el original


def imprimir_informe(municipio: str, registros: list[RegistroIngesta], hallazgos: list[Hallazgo]) -> None:
    """Informe de validación (DISENO_04 §3.3): nunca se vuelca nada en silencio."""
    errores = [h for h in hallazgos if h.severidad == "error"]
    advertencias = [h for h in hallazgos if h.severidad == "advertencia"]

    print(f"\n=== {municipio} ===")
    print(f"{len(registros)} sedes leídas correctamente")

    if errores:
        print(f"\nERROR — no se vuelcan ({len(errores)})")
        for h in errores:
            print(f"  {h.referencia}: {h.motivo}")

    if advertencias:
        print(f"\nADVERTENCIA — se vuelcan con nota ({len(advertencias)})")
        for h in advertencias:
            print(f"  {h.referencia}: {h.motivo}")

    if not errores and not advertencias:
        print("Sin errores ni advertencias.")
