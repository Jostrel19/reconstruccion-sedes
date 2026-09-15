"""Lector de Belalcázar (D-17 fase 3).

No es un formato: son TRES, repartidos en tres archivos distintos, y ninguno
trae código DANE (H-3). El paquete que mandó la alcaldía separa las sedes por
nivel de afectación, y cada nivel viene en una forma de documento diferente:

1. **Intermedia** (10 sedes) — `CANTIDADES POR INSTITUCION EDUCATIVA.xlsx`.
   Una hoja por sede, con el total ya declarado en una celda "PRESUPUESTO
   TOTAL" y una lista de materiales debajo. La hoja `SEDES EDUCATIVAS` es el
   índice que dice a qué institución pertenece cada una — sin él no hay forma
   de saber la institución, y sin institución no se puede proponer un DANE
   para una sede cuyo nombre se repite entre municipios.

2. **Grave, 3 instituciones** (El Águila, El Madroño, San Isidro) —
   `PPTOS COLEGIOS SISMO 10 AGOSTO 2026 BELALCAZAR V3.xlsm`, hoja
   `Presupuesto`. Aquí el presupuesto NO es por sede: es un presupuesto de
   obra completo (miles de actividades, formato profesional de constructora)
   con un total de costo directo por INSTITUCIÓN, en columnas paralelas.

3. **Grave, 1 institución aparte** (Manuela Beltrán) — archivo suelto
   `presupuesto cubierta manuela beltran.xlsx`, hoja `Table 1`, con su propio
   total de costo directo.

**El supuesto que hay que dejar explícito, no dar por bueno:** los tres
totales "grave" son por institución, pero el sistema necesita un DANE DE
SEDE. La hipótesis, verificada contra el catálogo antes de proponerla, es que
cada total corresponde a la SEDE PRINCIPAL de esa institución — porque las 10
sedes rurales de esas mismas tres instituciones ya están cubiertas por el
lote "intermedia", y la matrícula de la sede principal en el catálogo es del
orden de la que describe el archivo (Manuela Beltrán: 139 en el archivo
frente a 142 en `fctMaestra`, diferencia esperable). Aun así, es una
inferencia y se marca `dane_origen='propuesto'` como cualquier otra, nunca
`'archivo'`.
"""
from __future__ import annotations

import glob
import re

import openpyxl

from ingesta_apu import _catalogo_municipio, _norm, _proponer_dane
from ingesta_esquema import Hallazgo, RegistroIngesta

CARPETA = "AFECTACIONES INST- EDUCATIVAS"


def _archivo(ruta_base: str, subcarpeta: str, patron: str) -> str | None:
    candidatos = glob.glob(f"{ruta_base}/{CARPETA}/{subcarpeta}/{patron}")
    return candidatos[0] if candidatos else None


def _leer_indice_intermedia(ws) -> dict[int, tuple[str, str]]:
    """hoja `SEDES EDUCATIVAS`: orden -> (institucion, sede)."""
    indice = {}
    for r in range(1, ws.max_row + 1):
        orden = ws.cell(row=r, column=2).value
        institucion = ws.cell(row=r, column=3).value
        sede = ws.cell(row=r, column=5).value
        if isinstance(orden, (int, float)) and institucion and sede:
            indice[int(orden)] = (str(institucion).strip(), str(sede).strip())
    return indice


def _buscar_celda(ws, texto_buscado: str, filas: int = 15, cols: int = 14):
    """Devuelve (fila, columna) de la primera celda cuyo texto normalizado
    contiene `texto_buscado`, o (None, None)."""
    objetivo = _norm(texto_buscado)
    for r in range(1, min(ws.max_row, filas) + 1):
        for c in range(1, min(ws.max_column, cols) + 1):
            if objetivo in _norm(ws.cell(row=r, column=c).value):
                return r, c
    return None, None


def _leer_sede_intermedia(ws, institucion: str, sede_nombre: str, hoja: str):
    """Una hoja `N. NOMBRE` del archivo de intermedia: total declarado en la
    celda bajo «PRESUPUESTO TOTAL» + suma de la columna VALOR TOTAL como
    verificación, igual que en el resto de lectores del proyecto."""
    fila_tit, col_tit = _buscar_celda(ws, "PRESUPUESTO TOTAL")
    declarado = None
    if fila_tit:
        v = ws.cell(row=fila_tit + 1, column=col_tit).value
        if isinstance(v, (int, float)):
            declarado = float(v)

    fila_enc, col_enc = _buscar_celda(ws, "VALOR TOTAL", filas=10)
    suma = 0.0
    items_ok = 0
    if fila_enc:
        for r in range(fila_enc + 1, ws.max_row + 1):
            v = ws.cell(row=r, column=col_enc).value
            if isinstance(v, (int, float)):
                suma += float(v)
                items_ok += 1

    return {
        "sede": sede_nombre, "institucion": institucion, "hoja": hoja,
        "declarado": declarado, "suma": suma, "items_ok": items_ok,
    }


def _leer_intermedia(ruta: str, municipio: str, sedes_cat: list):
    registros: list[RegistroIngesta] = []
    hallazgos: list[Hallazgo] = []

    wb = openpyxl.load_workbook(ruta, data_only=True)
    if "SEDES EDUCATIVAS" not in wb.sheetnames:
        hallazgos.append(Hallazgo("error", "No se encontró la hoja índice «SEDES EDUCATIVAS»", ruta))
        return registros, hallazgos
    indice = _leer_indice_intermedia(wb["SEDES EDUCATIVAS"])

    hojas_sede = [n for n in wb.sheetnames if re.match(r"^\d+\.\s", n)]
    for hoja in hojas_sede:
        orden = int(hoja.split(".")[0])
        if orden not in indice:
            hallazgos.append(Hallazgo(
                "error",
                f"La hoja «{hoja}» no tiene entrada correspondiente en el índice «SEDES EDUCATIVAS»",
                hoja,
            ))
            continue
        institucion, sede_nombre = indice[orden]
        s = _leer_sede_intermedia(wb[hoja], institucion, sede_nombre, hoja)

        if s["declarado"] is None:
            hallazgos.append(Hallazgo(
                "error", f"«{s['sede']}»: no se encontró la celda de PRESUPUESTO TOTAL", hoja,
            ))
            continue

        if s["items_ok"] and abs(s["suma"] - s["declarado"]) > max(1.0, s["declarado"] * 0.005):
            hallazgos.append(Hallazgo(
                "advertencia",
                f"«{s['sede']}»: el total declarado es ${s['declarado']:,.0f} y la suma de la "
                f"lista de materiales da ${s['suma']:,.0f}. Manda el recalculado",
                hoja,
            ))

        costo = s["suma"] if s["items_ok"] else s["declarado"]
        dane, nombre_cat, motivo = _proponer_dane(s["sede"], s["institucion"], sedes_cat)
        if dane:
            hallazgos.append(Hallazgo(
                "advertencia",
                f"«{s['sede']}» no trae DANE en el archivo. Se propone {dane} "
                f"(«{nombre_cat}») por {motivo}. NO se vuelca hasta confirmarlo",
                hoja,
            ))
        else:
            hallazgos.append(Hallazgo(
                "error", f"«{s['sede']}» no trae DANE y no se pudo proponer uno: {motivo}", hoja,
            ))

        registros.append(RegistroIngesta(
            dane_sede=None,
            municipio=municipio,
            costo_directo=costo,
            sede=s["sede"],
            archivo_origen=ruta,
            dane_origen="propuesto",
            dane_propuesto=dane,
            detalle={
                "hoja": hoja, "institucion": institucion, "nivel_censo": "intermedia",
                "total_declarado": s["declarado"], "nombre_catalogo": nombre_cat,
            },
        ))

    return registros, hallazgos


def _leer_grave_tres_instituciones(ruta: str, municipio: str, sedes_cat: list):
    """`Presupuesto` del .xlsm: fila «TOTAL CD» con tres instituciones en
    columnas paralelas — se leen dinámicamente desde la fila de encabezados
    de institución, no por posición fija, por si el orden cambia de versión."""
    registros: list[RegistroIngesta] = []
    hallazgos: list[Hallazgo] = []

    wb = openpyxl.load_workbook(ruta, data_only=True)
    if "Presupuesto" not in wb.sheetnames:
        hallazgos.append(Hallazgo("error", "No se encontró la hoja «Presupuesto»", ruta))
        return registros, hallazgos
    ws = wb["Presupuesto"]

    # fila de instituciones: la que trae dos o más celdas que empiezan por "I.E."
    fila_ie = None
    for r in range(1, 6):
        celdas_ie = [c for c in range(1, ws.max_column + 1)
                     if isinstance(ws.cell(row=r, column=c).value, str)
                     and ws.cell(row=r, column=c).value.strip().upper().startswith("I.E")]
        if len(celdas_ie) >= 2:
            fila_ie = r
            columnas_ie = {c: ws.cell(row=r, column=c).value.strip() for c in celdas_ie}
            break
    if fila_ie is None:
        hallazgos.append(Hallazgo("error", "No se encontró la fila de instituciones en «Presupuesto»", "Presupuesto"))
        return registros, hallazgos

    # fila «TOTAL CD»
    fila_total, _ = _buscar_celda(ws, "TOTAL CD", filas=ws.max_row, cols=ws.max_column)
    if fila_total is None:
        hallazgos.append(Hallazgo("error", "No se encontró la fila «TOTAL CD» en «Presupuesto»", "Presupuesto"))
        return registros, hallazgos

    for col_ie, institucion in columnas_ie.items():
        # "VALOR PARCIAL" de esa institución queda una columna a la derecha de "CANTIDAD"
        valor = ws.cell(row=fila_total, column=col_ie + 1).value
        if not isinstance(valor, (int, float)) or valor <= 0:
            hallazgos.append(Hallazgo(
                "error", f"«{institucion}»: no se encontró un total de costo directo válido", "Presupuesto",
            ))
            continue

        nombre_ie_limpio = institucion.replace("I.E", "").replace("I.E.", "").strip()
        candidatas = [
            s for s in sedes_cat
            if _norm(nombre_ie_limpio) in _norm(s.get("institucion"))
            and not _norm(s.get("sede")).replace(_norm(s.get("institucion")), "").strip()
            or (_norm(nombre_ie_limpio) in _norm(s.get("institucion")) and "SEDE PRINCIPAL" in _norm(s.get("sede")))
        ]
        if len(candidatas) != 1:
            candidatas = [
                s for s in sedes_cat
                if _norm(nombre_ie_limpio) in _norm(s.get("institucion"))
                and "PRINCIPAL" in _norm(s.get("sede"))
            ]

        ref = f"Presupuesto!fila{fila_total}, col «{institucion}»"
        if len(candidatas) == 1:
            dane = int(candidatas[0]["dane_sede"])
            nombre_cat = candidatas[0]["sede"]
            hallazgos.append(Hallazgo(
                "advertencia",
                f"El presupuesto de «{institucion}» es por INSTITUCIÓN, no por sede (costo directo "
                f"${valor:,.0f}). Se propone su sede principal en el catálogo, {dane} («{nombre_cat}»), "
                f"porque las sedes rurales de esta institución ya están cubiertas por el lote de "
                f"afectación intermedia. Es una inferencia — requiere que infraestructura confirme "
                f"que el alcance del presupuesto es efectivamente la sede principal y no varias sedes "
                f"a la vez",
                ref,
            ))
        else:
            dane, nombre_cat = None, None
            hallazgos.append(Hallazgo(
                "error",
                f"«{institucion}»: no se pudo identificar una única sede principal en el catálogo "
                f"para proponer el DANE ({len(candidatas)} candidatas)",
                ref,
            ))

        registros.append(RegistroIngesta(
            dane_sede=None,
            municipio=municipio,
            costo_directo=float(valor),
            sede=nombre_cat or f"{institucion} (sede principal, sin confirmar)",
            archivo_origen=ruta,
            dane_origen="propuesto",
            dane_propuesto=dane,
            detalle={"institucion": institucion, "nivel_censo": "grave", "hoja": "Presupuesto"},
        ))

    return registros, hallazgos


def _leer_grave_manuela_beltran(ruta: str, municipio: str, sedes_cat: list):
    registros: list[RegistroIngesta] = []
    hallazgos: list[Hallazgo] = []

    wb = openpyxl.load_workbook(ruta, data_only=True)
    if "Table 1" not in wb.sheetnames:
        hallazgos.append(Hallazgo("error", "No se encontró la hoja «Table 1»", ruta))
        return registros, hallazgos
    ws = wb["Table 1"]

    fila, col = _buscar_celda(ws, "TOTAL COSTOS DIRECTOS", filas=ws.max_row)
    if fila is None:
        hallazgos.append(Hallazgo("error", "No se encontró «TOTAL COSTOS DIRECTOS»", "Table 1"))
        return registros, hallazgos

    valor = None
    for c in range(col, ws.max_column + 1):
        v = ws.cell(row=fila, column=c).value
        if isinstance(v, (int, float)):
            valor = float(v)
            break
    if valor is None:
        hallazgos.append(Hallazgo("error", "«TOTAL COSTOS DIRECTOS» no tiene un valor numérico a la derecha", "Table 1"))
        return registros, hallazgos

    candidatas = [s for s in sedes_cat if "MANUELA BELTRAN" in _norm(s.get("sede"))]
    ref = "Table 1"
    if len(candidatas) == 1:
        dane = int(candidatas[0]["dane_sede"])
        nombre_cat = candidatas[0]["sede"]
        matricula = candidatas[0].get("matricula")
        hallazgos.append(Hallazgo(
            "advertencia",
            f"«Manuela Beltrán» no trae DANE en el archivo (viene como institución propia; en el "
            f"catálogo es una SEDE de «{candidatas[0].get('institucion')}»). Se propone {dane} "
            f"(«{nombre_cat}», matrícula {matricula}) por coincidencia de nombre — el archivo declara "
            f"139 estudiantes, dato del mismo orden. NO se vuelca hasta confirmarlo",
            ref,
        ))
    else:
        dane, nombre_cat = None, None
        hallazgos.append(Hallazgo(
            "error", f"«Manuela Beltrán» no se pudo cruzar de forma única ({len(candidatas)} candidatas)", ref,
        ))

    registros.append(RegistroIngesta(
        dane_sede=None,
        municipio=municipio,
        costo_directo=valor,
        sede=nombre_cat or "MANUELA BELTRAN (sin confirmar)",
        archivo_origen=ruta,
        dane_origen="propuesto",
        dane_propuesto=dane,
        detalle={"institucion": "MANUELA BELTRAN", "nivel_censo": "grave", "hoja": "Table 1"},
    ))

    return registros, hallazgos


def leer(ruta_base: str, municipio: str):
    """`ruta_base` es la carpeta `BELALCAZAR` (no un archivo): a diferencia de
    los demás lectores, aquí no hay UN excel sino tres, en subcarpetas fijas
    del paquete que mandó la alcaldía."""
    registros: list[RegistroIngesta] = []
    hallazgos: list[Hallazgo] = []
    sedes_cat = _catalogo_municipio(municipio)

    f_intermedia = _archivo(ruta_base, "10 INST - AFECTACION INTERMEDIA", "CANTIDADES POR INSTITUCION EDUCATIVA*.xlsx")
    f_grave = _archivo(ruta_base, "4 INST- AFECTACION GRAVE", "PPTOS COLEGIOS*.xlsm")
    f_beltran = _archivo(ruta_base, "4 INST- AFECTACION GRAVE", "presupuesto cubierta manuela beltran*.xlsx")

    if f_intermedia:
        r, h = _leer_intermedia(f_intermedia, municipio, sedes_cat)
        registros += r
        hallazgos += h
    else:
        hallazgos.append(Hallazgo("error", "No se encontró el archivo de afectación intermedia", ruta_base))

    if f_grave:
        r, h = _leer_grave_tres_instituciones(f_grave, municipio, sedes_cat)
        registros += r
        hallazgos += h
    else:
        hallazgos.append(Hallazgo("error", "No se encontró el archivo de afectación grave (3 instituciones)", ruta_base))

    if f_beltran:
        r, h = _leer_grave_manuela_beltran(f_beltran, municipio, sedes_cat)
        registros += r
        hallazgos += h
    else:
        hallazgos.append(Hallazgo("error", "No se encontró el presupuesto de Manuela Beltrán", ruta_base))

    return registros, hallazgos
