"""Borrador de la pestaña `Usuarios` del sistema nuevo (D-17, backend Apps Script).

Genera, a partir del catálogo ya construido (`build_catalogo.py`), una fila por
alcalde y una fila por rector con el rol «Responsable de sede» y su alcance:

- Alcalde: alcance = todo el municipio (todas sus sedes).
- Rector: alcance = las sedes de su institución en el catálogo (puede ser una
  sola o hasta 18 — depende de lo que diga `fctMaestra`, nunca se asume).

No incluye a los usuarios internos de la SED (Administrador, Verificador): esos
los da el jefe/practicante a mano, porque no salen de ninguna fuente de datos.

Esto es un BORRADOR para revisar, no se sube solo al backend — el correo de
contacto del catálogo puede estar desactualizado y conviene que alguien lo
confirme antes de dar acceso real al sistema.
"""
from __future__ import annotations

import csv
import json

import rutas


def generar():
    data = json.loads(rutas.CATALOGO_JSON.read_text(encoding="utf-8"))
    filas = []

    for m in data["municipios"]:
        if not m.get("correo_alcaldia"):
            continue
        filas.append({
            "correo": m["correo_alcaldia"],
            "nombre": m.get("alcalde", ""),
            "rol": "Responsable de sede",
            "tipo": "alcalde",
            "municipio": m["municipio"],
            "alcance": "TODO EL MUNICIPIO",
            "n_sedes_alcance": m.get("total_sedes", ""),
            "celular": m.get("celular_alcaldia", ""),
        })

    por_ie: dict[str, dict] = {}
    for s in data["sedes"]:
        dane_ie = s.get("dane_ie")
        if not dane_ie or not s.get("correo_ie"):
            continue
        por_ie.setdefault(dane_ie, {
            "correo": s["correo_ie"],
            "nombre": s.get("rector", ""),
            "municipio": s.get("municipio", ""),
            "institucion": s.get("institucion", ""),
            "celular": s.get("celular_ie", ""),
            "sedes": [],
        })["sedes"].append(s.get("dane_sede"))

    for ie in por_ie.values():
        filas.append({
            "correo": ie["correo"],
            "nombre": ie["nombre"],
            "rol": "Responsable de sede",
            "tipo": "rector",
            "municipio": ie["municipio"],
            "alcance": " | ".join(str(d) for d in ie["sedes"]),
            "n_sedes_alcance": len(ie["sedes"]),
            "celular": ie["celular"],
        })

    salida = rutas.RAIZ / "data" / "generado" / "usuarios_borrador.csv"
    with open(salida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=[
            "correo", "nombre", "rol", "tipo", "municipio",
            "alcance", "n_sedes_alcance", "celular",
        ], delimiter=";")
        w.writeheader()
        w.writerows(filas)

    alcaldes = sum(1 for f in filas if f["tipo"] == "alcalde")
    rectores = sum(1 for f in filas if f["tipo"] == "rector")
    print(f"{len(filas)} filas generadas ({alcaldes} alcaldes, {rectores} rectores) -> {salida}")

    sin_correo_m = sum(1 for m in data["municipios"] if not m.get("correo_alcaldia"))
    sin_correo_ie = len({s.get("dane_ie") for s in data["sedes"] if s.get("dane_ie")}) - len(por_ie)
    if sin_correo_m or sin_correo_ie:
        print(f"AVISO: {sin_correo_m} municipios y {sin_correo_ie} instituciones sin correo en el "
              f"catálogo — quedan fuera del borrador, hay que completarlos a mano")

    return filas


if __name__ == "__main__":
    generar()
