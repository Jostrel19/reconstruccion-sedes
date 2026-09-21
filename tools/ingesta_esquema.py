"""Esquema común al que convergen todos los lectores de presupuesto de alcaldía.

Cada municipio manda un formato distinto (ver docs/diseno/DISENO_04_MODULO_INGESTA.md),
así que hay un lector por familia de formato. Ninguno de esos lectores conoce a los
demás: todos devuelven lo mismo, `RegistroIngesta` + `Hallazgo`, para que el resto
del sistema (informe de validación, módulo 2, módulo 3) no tenga que saber de dónde
vino cada dato.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path


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


def exportar_json(ruta: Path, municipio: str, registros: list[RegistroIngesta], hallazgos: list[Hallazgo]) -> None:
    """Escribe el mismo resultado que ya imprime `imprimir_informe()` a un
    archivo JSON (D-23): es lo que la pantalla Cargas del sistema recibe para
    mostrar el informe y, si el arquitecto confirma, volcarlo. Solo serializa
    lo que un lector real ya calculó — nunca genera nada por su cuenta.

    `esquema: 1` viaja en el archivo a propósito (mismo patrón que D-12 en el
    sistema anterior): si el contrato cambia alguna vez, la pantalla puede
    reconocer un archivo viejo y rechazarlo en vez de leerlo mal.
    """
    payload = {
        "esquema": 1,
        "municipio": municipio,
        "generado_en": datetime.now(timezone.utc).isoformat(),
        "registros": [asdict(r) for r in registros],
        "hallazgos": [asdict(h) for h in hallazgos],
    }
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nEscrito: {ruta} ({len(registros)} registros, {len(hallazgos)} hallazgos)")
