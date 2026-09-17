"""Convierte los artefactos ya generados (catálogo, borrador de usuarios) al formato
exacto de las pestañas `Sedes` y `Usuarios` del backend de Apps Script (CLAUDE.md §6).

No escribe nada en Google — produce dos CSV en data/generado/ para pegar en el
Google Sheet (Archivo > Importar > Reemplazar hoja actual) la primera vez que se
carga cada pestaña (Paso 0 del plan de desarrollo).

Uso:
    python tools/build_catalogo.py              # si no está regenerado
    python tools/generar_usuarios_borrador.py    # idem
    python tools/exportar_backend.py
"""
from __future__ import annotations

import csv
import json

import rutas

COLUMNAS_SEDES = [
    "dane_sede", "municipio", "dane_ie", "institucion", "sede", "zona", "matricula",
    "estado_sede", "tipo_censo", "priorizada", "capitulos_dano", "valor_referencia",
    "estado_prestacion", "concepto_tecnico", "observaciones_censo",
]

COLUMNAS_USUARIOS = ["correo", "nombre", "rol", "tipo", "alcance", "activo"]

# El borrador de usuarios usa etiquetas legibles (D-24, generar_usuarios_borrador.py);
# el backend usa los enum de CLAUDE.md §6. Se traduce aquí, una sola vez, en vez de
# duplicar el mapeo en Apps Script.
ROL_A_ENUM = {
    "Administrador": "ADMINISTRADOR",
    "Verificador": "VERIFICADOR",
    "Responsable de sede": "RESPONSABLE_SEDE",
    "Consulta": "CONSULTA",
}


def exportar_sedes():
    data = json.loads(rutas.CATALOGO_JSON.read_text(encoding="utf-8"))
    salida = rutas.GENERADO / "backend_sedes.csv"
    with open(salida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS_SEDES)
        w.writeheader()
        for s in data["sedes"]:
            w.writerow({
                "dane_sede": s["dane_sede"],
                "municipio": s["municipio"],
                "dane_ie": s["dane_ie"],
                "institucion": s["institucion"],
                "sede": s["sede"],
                "zona": s["zona"],
                "matricula": s["matricula"],
                "estado_sede": s["estado_sede"],
                "tipo_censo": s["tipo_censo"],
                "priorizada": "TRUE" if s["priorizada"] else "FALSE",
                "capitulos_dano": ",".join(str(c) for c in s.get("capitulos_dano") or []),
                "valor_referencia": s.get("valor_referencia") or 0,
                "estado_prestacion": s.get("estado_prestacion", ""),
                "concepto_tecnico": s.get("concepto_tecnico", ""),
                "observaciones_censo": s.get("observaciones_censo", ""),
            })
    print(f"{len(data['sedes'])} sedes -> {salida}")


def exportar_usuarios():
    origen = rutas.GENERADO / "usuarios_borrador.csv"
    if not origen.exists():
        print(f"AVISO: no existe {origen} — corre generar_usuarios_borrador.py primero")
        return
    salida = rutas.GENERADO / "backend_usuarios.csv"
    with open(origen, newline="", encoding="utf-8-sig") as f_in, \
         open(salida, "w", newline="", encoding="utf-8-sig") as f_out:
        w = csv.DictWriter(f_out, fieldnames=COLUMNAS_USUARIOS)
        w.writeheader()
        n = 0
        for r in csv.DictReader(f_in, delimiter=";"):
            rol = ROL_A_ENUM.get(r["rol"], r["rol"])
            if r["tipo"] == "interno":
                alcance = "TODO_EL_DEPARTAMENTO"
            elif r["tipo"] == "alcalde":
                # D-24: todas las sedes de SU municipio, no del departamento. El borrador
                # ya trae el municipio en su propia columna — se usa tal cual, el backend
                # filtra Sedes por municipio == alcance para este tipo.
                alcance = r["municipio"]
            else:  # rector
                alcance = r["alcance"]  # ya viene como "dane1 | dane2 | ..." (D-24)
            w.writerow({
                "correo": r["correo"],
                "nombre": r["nombre"],
                "rol": rol,
                "tipo": r["tipo"],
                "alcance": alcance,
                "activo": "TRUE",
            })
            n += 1
    print(f"{n} usuarios -> {salida}")


if __name__ == "__main__":
    exportar_sedes()
    exportar_usuarios()
