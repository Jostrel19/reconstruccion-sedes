"""Consolida en un Excel todo lo que los municipios han entregado.

Lee una carpeta con los paquetes .json que subieron las alcaldías y produce un
libro con los registros, el detalle de actividades, el contraste contra el
modelo paramétrico y lo que falta por radicar. Extrae también las fotografías.

No necesita SharePoint, ni permisos, ni flujos: la carpeta de OneDrive se
sincroniza sola al disco, así que basta apuntarle a esa ruta local.

Uso:
    python tools/consolidar.py                       (usa data/entregas/)
    python tools/consolidar.py "C:/.../Entregas"     (otra carpeta)

Se puede correr las veces que se quiera: siempre relee todo y rehace el libro.
Si un municipio reenvía una sede, se conserva la versión más alta.
"""
from __future__ import annotations

import base64
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

import rutas

AZUL = "12395F"
GRIS = "EEF2F6"
ROJO = "FBECEB"
VERDE = "E4F0EA"
AMBAR = "FDF6E6"

BORDE = Border(*[Side(style="thin", color="D8DEE5")] * 4)
MONEDA = '"$"#,##0'


def leer_paquetes(carpeta: Path):
    """Devuelve {dane_sede: registro} con la versión más alta de cada sede."""
    registros, items_por_sede, fotos_por_sede = {}, {}, {}
    leidos, ignorados, errores = 0, 0, []

    for ruta in sorted(carpeta.rglob("*.json")):
        try:
            datos = json.loads(ruta.read_text(encoding="utf-8"))
        except Exception as e:
            errores.append(f"{ruta.name}: no se pudo leer ({e})")
            continue

        if datos.get("esquema") != 1:
            errores.append(f"{ruta.name}: esquema no reconocido")
            continue

        if datos.get("accion") == "radicarPresupuesto":
            paquetes = [(datos.get("cabecera", {}), datos.get("items", []),
                         datos.get("fotos", []))]
        elif datos.get("accion") == "declararSinAfectacion":
            paquetes = [(r, [], []) for r in datos.get("registros", [])]
        else:
            errores.append(f"{ruta.name}: acción desconocida")
            continue

        for cab, items, fotos in paquetes:
            dane = str(cab.get("dane_sede", "")).strip()
            if not dane:
                errores.append(f"{ruta.name}: registro sin DANE SEDE")
                continue
            ver = int(cab.get("version") or 1)
            previo = registros.get(dane)
            if previo and int(previo.get("version") or 1) >= ver:
                ignorados += 1
                continue
            cab["_archivo"] = ruta.name
            registros[dane] = cab
            items_por_sede[dane] = items
            fotos_por_sede[dane] = fotos
            leidos += 1

    return registros, items_por_sede, fotos_por_sede, leidos, ignorados, errores


def encabezar(ws, titulos, anchos):
    ws.append(titulos)
    for i, (t, a) in enumerate(zip(titulos, anchos), start=1):
        c = ws.cell(row=1, column=i)
        c.font = Font(bold=True, color="FFFFFF", size=9)
        c.fill = PatternFill("solid", fgColor=AZUL)
        c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = a
    ws.row_dimensions[1].height = 28
    ws.freeze_panes = "A2"


def main():
    carpeta = Path(sys.argv[1]) if len(sys.argv) > 1 else rutas.DATA / "entregas"
    if not carpeta.exists():
        carpeta.mkdir(parents=True, exist_ok=True)
        print(f"Se creó la carpeta {carpeta}.")
        print("Copie ahí los archivos .json que suban los municipios y vuelva a ejecutar.")
        return

    catalogo = json.loads(rutas.CATALOGO_JSON.read_text(encoding="utf-8"))
    sedes_cat = {s["dane_sede"]: s for s in catalogo["sedes"]}

    registros, items_sede, fotos_sede, leidos, ignorados, errores = leer_paquetes(carpeta)
    if not registros:
        print(f"No se encontraron paquetes válidos en {carpeta}")
        for e in errores:
            print("  ", e)
        return

    wb = Workbook()

    # ------------------------------------------------------- PRESUPUESTOS ---
    ws = wb.active
    ws.title = "PRESUPUESTOS"
    encabezar(ws, [
        "MUNICIPIO", "INSTITUCIÓN", "SEDE", "DANE SEDE", "ZONA", "MATRÍCULA",
        "TIPO CENSO", "DECLARA AFECTACIÓN", "DISCREPANCIA", "COSTO DIRECTO",
        "VALOR MODELO", "DESVIACIÓN %", "A %", "U %", "IVA", "TOTAL CON AU",
        "PLAZO (DÍAS)", "RADICADO", "VERSIÓN", "FECHA", "ARCHIVO"
    ], [14, 34, 34, 14, 9, 10, 26, 12, 12, 15, 15, 12, 7, 7, 13, 16, 11, 26, 8, 12, 30])

    for dane, r in sorted(registros.items(),
                          key=lambda x: (x[1].get("municipio", ""), x[1].get("sede", ""))):
        cat = sedes_cat.get(dane, {})
        modelo = cat.get("valor_modelo", 0) or 0
        costo = r.get("costo_directo", 0) or 0
        afecta = bool(r.get("declara_afectacion"))
        desv = (costo - modelo) / modelo if (modelo and afecta) else None

        ws.append([
            r.get("municipio", ""), r.get("institucion", ""), r.get("sede", ""), dane,
            r.get("zona", ""), r.get("matricula", 0), r.get("tipo_censo", ""),
            "SÍ" if afecta else "NO", "SÍ" if r.get("hay_discrepancia") else "",
            costo, modelo if afecta else None, desv,
            r.get("pct_admin", 0), r.get("pct_utilidad", 0),
            r.get("valor_iva", 0), r.get("total_presupuesto", 0),
            r.get("plazo_dias", 0), r.get("id_radicado", ""), r.get("version", 1),
            (r.get("fecha_radicacion") or "")[:10], r.get("_archivo", "")
        ])
        f = ws.max_row
        for col in (10, 11, 15, 16):
            ws.cell(row=f, column=col).number_format = MONEDA
        ws.cell(row=f, column=12).number_format = "+0.0 %;-0.0 %"
        if desv is not None and abs(desv) > 0.5:
            ws.cell(row=f, column=12).fill = PatternFill("solid", fgColor=ROJO)
        if r.get("hay_discrepancia"):
            ws.cell(row=f, column=9).fill = PatternFill("solid", fgColor=AMBAR)
        if not afecta:
            ws.cell(row=f, column=8).fill = PatternFill("solid", fgColor=VERDE)
        for col in range(1, 22):
            ws.cell(row=f, column=col).border = BORDE
    ws.auto_filter.ref = ws.dimensions

    # -------------------------------------------------------------- ITEMS ---
    ws = wb.create_sheet("ACTIVIDADES")
    encabezar(ws, ["MUNICIPIO", "SEDE", "DANE SEDE", "#", "CAPÍTULO", "TRABAJO",
                   "UNIDAD", "CANTIDAD", "VALOR UNITARIO", "VALOR TOTAL", "RADICADO"],
              [14, 34, 14, 5, 28, 44, 9, 11, 16, 16, 26])
    for dane, items in items_sede.items():
        r = registros[dane]
        for it in items:
            ws.append([r.get("municipio", ""), r.get("sede", ""), dane,
                       it.get("n_item"), it.get("capitulo_nombre", ""),
                       it.get("descripcion", ""), it.get("unidad", ""),
                       it.get("cantidad", 0), it.get("valor_unitario", 0),
                       it.get("valor_total", 0), r.get("id_radicado", "")])
            f = ws.max_row
            for col in (9, 10):
                ws.cell(row=f, column=col).number_format = MONEDA
            for col in range(1, 12):
                ws.cell(row=f, column=col).border = BORDE
    ws.auto_filter.ref = ws.dimensions

    # ------------------------------------------------ RESUMEN POR MUNICIPIO ---
    ws = wb.create_sheet("POR MUNICIPIO", 0)
    encabezar(ws, ["MUNICIPIO", "SEDES DEL UNIVERSO", "RADICADAS", "PENDIENTES",
                   "% AVANCE", "CON PRESUPUESTO", "SIN AFECTACIÓN", "DISCREPANCIAS",
                   "COSTO DIRECTO", "VALOR MODELO", "DESVIACIÓN %", "TOTAL CON AU"],
              [15, 12, 11, 11, 10, 13, 12, 12, 16, 16, 12, 16])

    universo = defaultdict(int)
    for s in catalogo["sedes"]:
        universo[s["municipio"]] += 1

    por_mun = defaultdict(list)
    for dane, r in registros.items():
        por_mun[r.get("municipio", "")].append((dane, r))

    tot = defaultdict(float)
    for mun in sorted(universo):
        regs = por_mun.get(mun, [])
        conp = [(d, r) for d, r in regs if r.get("declara_afectacion")]
        comparables = [(d, r) for d, r in conp if (sedes_cat.get(d, {}).get("valor_modelo") or 0) > 0]
        costo = sum(r.get("costo_directo", 0) or 0 for _, r in comparables)
        modelo = sum(sedes_cat[d]["valor_modelo"] for d, _ in comparables)
        ws.append([
            mun, universo[mun], len(regs), universo[mun] - len(regs),
            len(regs) / universo[mun] if universo[mun] else 0,
            len(conp), len(regs) - len(conp),
            sum(1 for _, r in regs if r.get("hay_discrepancia")),
            costo, modelo, (costo - modelo) / modelo if modelo else None,
            sum(r.get("total_presupuesto", 0) or 0 for _, r in conp)
        ])
        f = ws.max_row
        for col in (9, 10, 12):
            ws.cell(row=f, column=col).number_format = MONEDA
        ws.cell(row=f, column=5).number_format = "0 %"
        ws.cell(row=f, column=11).number_format = "+0.0 %;-0.0 %"
        for col in range(1, 13):
            ws.cell(row=f, column=col).border = BORDE
        tot["universo"] += universo[mun]; tot["radicadas"] += len(regs)
        tot["conp"] += len(conp); tot["costo"] += costo; tot["modelo"] += modelo
        tot["total"] += sum(r.get("total_presupuesto", 0) or 0 for _, r in conp)

    ws.append(["TOTAL", tot["universo"], tot["radicadas"],
               tot["universo"] - tot["radicadas"],
               tot["radicadas"] / tot["universo"] if tot["universo"] else 0,
               tot["conp"], tot["radicadas"] - tot["conp"],
               sum(1 for _, r in registros.items() if r.get("hay_discrepancia")),
               tot["costo"], tot["modelo"],
               (tot["costo"] - tot["modelo"]) / tot["modelo"] if tot["modelo"] else None,
               tot["total"]])
    f = ws.max_row
    for col in range(1, 13):
        c = ws.cell(row=f, column=col)
        c.font = Font(bold=True); c.fill = PatternFill("solid", fgColor=GRIS); c.border = BORDE
    for col in (9, 10, 12):
        ws.cell(row=f, column=col).number_format = MONEDA
    ws.cell(row=f, column=5).number_format = "0 %"
    ws.cell(row=f, column=11).number_format = "+0.0 %;-0.0 %"

    # --------------------------------------------------------- PENDIENTES ---
    ws = wb.create_sheet("PENDIENTES")
    encabezar(ws, ["MUNICIPIO", "INSTITUCIÓN", "SEDE", "DANE SEDE", "TIPO CENSO",
                   "MATRÍCULA", "VALOR MODELO", "ORDEN PRIORIZACIÓN"],
              [15, 34, 34, 14, 28, 10, 16, 12])
    faltan = [s for d, s in sedes_cat.items() if d not in registros]
    for s in sorted(faltan, key=lambda x: (x["municipio"], -(x.get("valor_modelo") or 0))):
        ws.append([s["municipio"], s["institucion"], s["sede"], s["dane_sede"],
                   s["tipo_censo"], s["matricula"], s.get("valor_modelo", 0),
                   s.get("orden_priorizacion", 0)])
        f = ws.max_row
        ws.cell(row=f, column=7).number_format = MONEDA
        for col in range(1, 9):
            ws.cell(row=f, column=col).border = BORDE
    ws.auto_filter.ref = ws.dimensions

    # --------------------------------------------------------- FOTOGRAFÍAS ---
    dir_fotos = rutas.SALIDA / "fotos"
    n_fotos = 0
    for dane, fotos in fotos_sede.items():
        if not fotos:
            continue
        d = dir_fotos / dane
        d.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(fotos, start=1):
            b64 = f.get("contenido_b64") or ""
            if not b64:
                continue
            ext = "png" if "png" in (f.get("tipo") or "") else "jpg"
            (d / f"{dane}_{i:02d}.{ext}").write_bytes(base64.b64decode(b64))
            n_fotos += 1

    rutas.asegurar_directorios()

    # Dos copias con propósitos distintos:
    #   - la fechada es el histórico: queda constancia de cómo se veía el
    #     consolidado el día que se reportó una cifra;
    #   - la de nombre fijo es a la que se conecta Power BI. Si el tablero
    #     apuntara al archivo con fecha, la conexión se rompería cada día.
    salida = rutas.SALIDA / f"CONSOLIDADO_{datetime.now():%Y-%m-%d}.xlsx"
    wb.save(salida)

    estable = rutas.SALIDA / "CONSOLIDADO.xlsx"
    aviso_estable = None
    try:
        wb.save(estable)
    except PermissionError:
        # Power BI o Excel lo tienen abierto. No es motivo para perder el
        # consolidado: el fechado ya quedó escrito.
        aviso_estable = (f"No se pudo actualizar {estable.name}: está abierto en "
                         f"Excel o Power BI. Ciérrelo y vuelva a consolidar.")

    # ------------------------------------------------------------- informe ---
    print(f"Carpeta leída:      {carpeta}")
    print(f"Registros cargados: {leidos}   (reenvíos ignorados: {ignorados})")
    print(f"Fotografías:        {n_fotos} en {dir_fotos}")
    if errores:
        print(f"\nArchivos con problema ({len(errores)}):")
        for e in errores[:10]:
            print("  ", e)
    print(f"\nAvance: {int(tot['radicadas'])} de {int(tot['universo'])} sedes "
          f"({tot['radicadas'] / tot['universo'] * 100:.1f} %)")
    print(f"Costo directo comparable: ${tot['costo']:,.0f}")
    print(f"Valor del modelo:         ${tot['modelo']:,.0f}")
    if tot["modelo"]:
        print(f"Desviación:               {(tot['costo'] - tot['modelo']) / tot['modelo'] * 100:+.1f} %")
    print(f"\nEscrito: {salida}")
    if aviso_estable:
        print(f"AVISO:   {aviso_estable}")
    else:
        print(f"         {estable}   <- conecte Power BI a este")


if __name__ == "__main__":
    main()
