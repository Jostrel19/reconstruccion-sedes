"""Construye el catálogo del aplicativo presupuestal a partir de las fuentes oficiales.

Fuentes:
  fctMaestra.xlsx           -> universo de sedes (hoja MATRICULA) y Estado Sede (hoja Sedes)
  ESTIMACION ...xlsx        -> tipo/nivel de afectación y valor del modelo (hoja BASE COMPLETA)
  Directorio IE 2026.xlsx   -> rector y contacto  (OJO: su columna DANE está desplazada,
                               el cruce se hace por municipio + nombre de I.E.)
  Base de datos Funcionarios-> alcalde y correo institucional (hoja Alcaldes)

Llave de cruce del universo: DANE SEDE (12 dígitos).
"""
import collections
import json
import re
import unicodedata
from collections import defaultdict

import openpyxl

import rutas

rutas.exigir_fuentes()
rutas.asegurar_directorios()

MANIZALES = "MANIZALES"  # secretaría certificada aparte, fuera del universo


def norm(s):
    """Mayúsculas SIN tildes. Solo para CRUZAR nombres, nunca para guardar."""
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().upper()


def norm_vis(s):
    """Mayúsculas CONSERVANDO las tildes. Es lo que se guarda y se muestra:
    el instrumento es oficial y va a los alcaldes, así que PÁCORA no puede
    aparecer como PACORA."""
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip().upper()


def norm_ie(s):
    """Normaliza nombres de I.E. tolerando abreviaturas y erratas del Directorio."""
    s = norm(s)
    for a, b in [
        ("INST. EDUC.", "INSTITUCION EDUCATIVA"),
        ("INSTITUCION EDUC.", "INSTITUCION EDUCATIVA"),
        ("INSTITUCIONEDUCATIVA", "INSTITUCION EDUCATIVA"),
        ("INSTITUCION EDUCATVA", "INSTITUCION EDUCATIVA"),
        ("INSTITUCION EDUCATIVOA", "INSTITUCION EDUCATIVA"),
        ("I.E.", "INSTITUCION EDUCATIVA"),
        ("ESC.", "ESCUELA"),
        ("JHON", "JOHN"),
        ("RIOARRIBA", "RIO ARRIBA"),
        ("AGUABONITA", "AGUA BONITA"),
    ]:
        s = s.replace(a, b)
    return re.sub(r"[^A-Z0-9 ]", " ", s).strip()


# Palabras que no distinguen una I.E. de otra dentro del mismo municipio.
VACIAS = {"INSTITUCION", "EDUCATIVA", "EDUCATIVO", "DE", "DEL", "LA", "EL",
          "LOS", "LAS", "MIXTO", "MIXTA", "TECNICA", "TECNICO", "Y",
          "SEDE", "PRINCIPAL"}


def tokens_ie(s):
    return {t for t in norm_ie(s).split() if t not in VACIAS}


def similitud(a, b):
    """Jaccard sobre tokens significativos."""
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def rows(path, sheet, header_row=1):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb[sheet]
    it = ws.iter_rows(values_only=True)
    for _ in range(header_row - 1):
        next(it)
    hdr = [str(h).strip() if h is not None else "" for h in next(it)]
    for r in it:
        yield dict(zip(hdr, r))
    wb.close()


def dane(v):
    if v is None:
        return ""
    s = str(v).strip()
    return s.split(".")[0]


# ---------------------------------------------------------------- 1. Universo
sedes = {}
for r in rows(rutas.F_MAESTRA, "MATRICULA"):
    if norm(r.get("SECTOR")) != "OFICIAL":
        continue
    mun = norm_vis(r.get("Municipio"))
    if not mun or norm(mun) == MANIZALES:
        continue
    ds = dane(r.get("DANE SEDE"))
    if not ds:
        continue
    sedes[ds] = {
        "dane_sede": ds,
        "municipio": mun,
        "dane_ie": dane(r.get("CODIGO_DANE")),
        "institucion": str(r.get("I.E.") or "").strip(),
        "sede": str(r.get("SEDE") or "").strip(),
        "zona": norm(r.get("ZONA")),
        "direccion": str(r.get("DIRECCION") or "").strip(),
        "matricula": int(r.get("MATRICULA") or 0),
    }
print(f"[1] Universo fctMaestra/MATRICULA sector OFICIAL: {len(sedes)} sedes")

# ---------------------------------------------------------- 2. Estado DUE
estado = {}
for r in rows(rutas.F_MAESTRA, "Sedes"):
    cs = dane(r.get("Código Sede"))
    if cs:
        estado[cs] = str(r.get("Estado Sede") or "").strip()
sin_estado = [d for d in sedes if d not in estado]
for d, s in sedes.items():
    s["estado_sede"] = estado.get(d, "")
print(f"[2] Estado DUE cruzado. Sin registro en hoja Sedes: {len(sin_estado)}")

# --------------------------------------- 3. Censo de daños vivo (dimDaños, D-26)
#
# Fuente única de afectación y de valor de referencia. El modelo paramétrico
# (ESTIMACION COSTOS ...xlsx) quedó RETIRADO: no se lee, no se contrasta y su
# cifra no viaja a ningún lado.
#
# Dos cosas que este archivo hace y el modelo no hacía:
#   - marca daño por capítulo (11 columnas con «X»), que son exactamente los 11
#     CAPITULOS de config.js con los que se clasifica cada fila de presupuesto;
#   - se actualiza a medida que los arquitectos visitan, así que su columna
#     PRESUPUESTO APROX INVERSION mezcla estimaciones con presupuestos ya
#     recibidos. Por eso se guarda como «referencia», nunca como valor real:
#     el valor real vive en el registro de presupuesto, no en el catálogo.

# Las 11 columnas de daño, en el orden de APP_CONFIG.CAPITULOS (config.js).
COLS_DANO = [
    (1, "1. ESTRUCTURAL"),
    (2, "2. MAMPOSTERÍA Y MUROS"),
    (3, "3. CUBIERTA"),
    (4, "4. CIMENTACIÓN Y TERRENO"),
    (5, "5. ELEMENTOS NO ESTRUCTURALES"),
    (6, "6. ACABADOS"),
    (7, "7. INSTALACIONES"),
    (8, "8A. UNIDADES SANITARIAS"),
    (9, "9. COCINA Y RESTAURANTE ESCOLAR"),
    (10, "10. ELEMENTOS EXTERIORES"),
    (11, "11. DEFICIENCIA CONSTRUCTIVA / VULNERABILIDAD"),
]

# Tipos 1 y 2 son los marcados PRIORITARIO en el propio censo. La priorización
# deja de ser un archivo aparte (PrimerasPriorizadas.xlsx) y se DERIVA del tipo
# de afectación: así no hay dos listas que se puedan desincronizar.
TIPOS_PRIORIZADOS = ("1.", "2.")


def _marcado(v):
    return str(v or "").strip().upper() == "X"


def _entero(v):
    # round(), no int(): algunas celdas traen decimales y truncar pierde pesos
    # en silencio. El sistema trabaja en pesos enteros.
    return round(v) if isinstance(v, (int, float)) else 0


censo = 0
for r in rows(rutas.F_DIM_DANOS, rutas.H_DIM_DANOS):
    ds = dane(r.get("CODIGO_DANE_SEDE"))
    if ds not in sedes:
        continue
    censo += 1
    tipo = str(r.get("A2. TIPO DE AFECTACIÓN") or "").strip()
    capitulos = [cid for cid, col in COLS_DANO if _marcado(r.get(col))]
    sedes[ds].update(
        {
            "tipo_censo": tipo,
            "priorizada": tipo.startswith(TIPOS_PRIORIZADOS),
            "capitulos_dano": capitulos,
            "n_danos": len(capitulos),
            # Valor puesto por el arquitecto. Es el punto de partida del
            # seguimiento, NO el presupuesto: ver D-27.
            "valor_referencia": _entero(r.get("PRESUPUESTO APROX INVERSION")),
            "estado_prestacion": str(r.get("ESTADO DE LA PRESTACIÓN DEL SERVICIO EDUCATIVO") or "").strip(),
            "concepto_tecnico": str(r.get("CONCEPTO TECNICO") or "").strip(),
            "certificacion": str(r.get("CERTIFICACIÓN") or "").strip(),
            "observaciones_censo": str(r.get("OBSERVACIONES") or "").strip(),
            "donante": str(r.get("NOMBRE POSIBLE DONANTE") or "").strip(),
            "observaciones_presupuesto": str(r.get("OBSERVACIONES PRESUPUESTO") or "").strip(),
        }
    )

faltan_censo = [d for d, s in sedes.items() if "tipo_censo" not in s]
for d in faltan_censo:
    sedes[d].update(
        {"tipo_censo": "", "priorizada": False, "capitulos_dano": [], "n_danos": 0,
         "valor_referencia": 0, "estado_prestacion": "", "concepto_tecnico": "",
         "certificacion": "", "observaciones_censo": "", "donante": "",
         "observaciones_presupuesto": ""}
    )

n_pri = sum(1 for s in sedes.values() if s["priorizada"])
print(f"[3] dimDaños cruzado por DANE SEDE: {censo}. Sin dato de censo: {len(faltan_censo)}")
print(f"    Priorizadas (tipo 1 y 2): {n_pri}")

# --------------------------------------------------- 4. Rector y contacto I.E.
direc = defaultdict(list)
for r in rows(rutas.F_DIRECTORIO, "Hoja1"):
    mun = norm(r.get("MUN"))
    ie = norm_ie(r.get("IE"))
    if mun and ie:
        direc[(mun, ie)].append(
            {
                "rector": str(r.get("RECTOR") or "").strip(),
                "correo_ie": str(r.get("CORR. ELECT") or "").strip(),
                "celular_ie": str(r.get("CEL") or "").strip(),
            }
        )

ies = {}
for s in sedes.values():
    ies.setdefault((s["municipio"], s["dane_ie"]), s["institucion"])

match, exactos, difusos, nomatch = 0, 0, [], []
contacto_ie = {}
for (mun_vis, die), nombre in ies.items():
    mun = norm(mun_vis)          # el Directorio se cruza sin tildes
    key = (mun, norm_ie(nombre))
    if key in direc:
        contacto_ie[(mun_vis, die)] = direc[key][0]
        match += 1
        exactos += 1
        continue
    # Cruce difuso por tokens significativos, solo dentro del mismo municipio.
    tk = tokens_ie(nombre)
    mejor, score = None, 0.0
    for k in direc:
        if k[0] != mun:
            continue
        s = similitud(tk, tokens_ie(k[1]))
        if s > score:
            mejor, score = k, s
    # Contención: el nombre de una fuente está íntegro dentro del de la otra.
    if mejor and score < 0.5:
        mt = tokens_ie(mejor[1])
        if mt and tk and (mt <= tk or tk <= mt):
            score = max(score, 0.5)
    if mejor and score >= 0.5:
        contacto_ie[(mun_vis, die)] = direc[mejor][0]
        match += 1
        difusos.append((mun_vis, nombre, mejor[1], score))
    else:
        nomatch.append((mun_vis, nombre, score))
        contacto_ie[(mun_vis, die)] = {"rector": "", "correo_ie": "", "celular_ie": ""}

print(f"[4] I.E. con rector/contacto: {match} de {len(ies)} "
      f"(exactos {exactos}, difusos {len(difusos)}). Sin cruce: {len(nomatch)}")
if difusos:
    print("      --- cruces difusos, VERIFICAR uno por uno ---")
    for m, a, b, s in sorted(difusos):
        print(f"      {s:.2f}  {m:<12} maestra: {a[:46]:<46} | directorio: {b[:46]}")
for m, n, s in nomatch:
    print(f"      SIN CRUCE  {m:<14} {n[:52]:<52} mejor={s:.2f}")

for s in sedes.values():
    s.update(contacto_ie[(s["municipio"], s["dane_ie"])])

# ------------------------------------------------------------- 5. Alcaldes
alcaldes = {}
wb = openpyxl.load_workbook(rutas.F_FUNCIONARIOS, data_only=True)
for row in wb["Alcaldes"].iter_rows(min_row=4, values_only=True):
    mun = norm(row[2]) if len(row) > 2 else ""
    if not mun or mun in (MANIZALES, "GOBERNADOR"):
        continue
    alcaldes[mun] = {
        "alcalde": str(row[3] or "").strip(),
        "correo_alcaldia": str(row[4] or "").strip(),
        "celular_alcaldia": str(row[6] or "").strip() if len(row) > 6 else "",
    }
wb.close()
municipios = sorted({s["municipio"] for s in sedes.values()})
# alcaldes se indexa sin tildes; municipios ya viene acentuado.
sin_alcalde = [m for m in municipios if norm(m) not in alcaldes]
print(f"[5] Alcaldes: {len(alcaldes)}. Municipios del universo: {len(municipios)}. "
      f"Sin alcalde: {sin_alcalde or 'ninguno'}")

# ------------------------------------------------------------- 6. Salida
TIPO_SIN_AFECTACION = "5."
catalogo = {
    "generado": "2026-09-08",
    "fuentes": {
        "universo": "fctMaestra.xlsx / MATRICULA (SECTOR=OFICIAL, sin Manizales)",
        "estado_due": "fctMaestra.xlsx / Sedes",
        "censo": "dimDañosInfraestructura.xlsx / EstadoInfraestructura (D-26)",
        "rectores": "Directorio Instituciones Educativas 2026.xlsx (cruce por municipio+nombre)",
        "alcaldes": "Base de datos Funcionarios 2026.xlsx / Alcaldes",
    },
    "municipios": [
        {
            "municipio": m,
            **alcaldes.get(norm(m), {"alcalde": "", "correo_alcaldia": "", "celular_alcaldia": ""}),
            "total_sedes": sum(1 for s in sedes.values() if s["municipio"] == m),
            "premarcadas_sin_afectacion": sum(
                1 for s in sedes.values()
                if s["municipio"] == m and s["tipo_censo"].startswith(TIPO_SIN_AFECTACION)
            ),
        }
        for m in municipios
    ],
    "sedes": sorted(
        (
            {**s, "premarcada_sin_afectacion": s["tipo_censo"].startswith(TIPO_SIN_AFECTACION)}
            for s in sedes.values()
        ),
        key=lambda x: (x["municipio"], x["institucion"], x["sede"]),
    ),
}

out = rutas.CATALOGO_JSON
with open(out, "w", encoding="utf-8") as f:
    json.dump(catalogo, f, ensure_ascii=False, indent=1)

# --- Salida para el sitio estático ------------------------------------------
# Se parte en dos archivos a propósito:
#
#   data.js      lo carga el aplicativo del alcalde. NO lleva el valor de
#                referencia del arquitecto: D-6 sigue vigente en su intención
#                —que el municipio mida por su cuenta, sin anclarse a la cifra
#                de la SED— aunque el modelo paramétrico que la originaba ya no
#                exista (D-26). Si el dato viaja al navegador basta abrir el
#                inspector para verlo.
#   data-sed.js  lo carga solo la consola de la Secretaría.
#
# Tampoco viaja el posible donante: es información de gestión en curso, no un
# atributo de la sede.
RESERVADOS = ("valor_referencia", "donante", "observaciones_presupuesto")


publicas = [{k: v for k, v in s.items() if k not in RESERVADOS} for s in catalogo["sedes"]]

with open(rutas.DATA_JS, "w", encoding="utf-8") as f:
    f.write("/* GENERADO POR build_catalogo.py - NO EDITAR A MANO */\n")
    f.write("/* Catálogo público. Sin el valor estimado por el modelo (D-6). */\n")
    f.write(f"const SED_CATALOGO_GENERADO = {json.dumps(catalogo['generado'])};\n")
    f.write("const SED_MUNICIPIOS = "
            + json.dumps(catalogo["municipios"], ensure_ascii=False, separators=(",", ":"))
            + ";\n")
    f.write("const SED_SEDES = "
            + json.dumps(publicas, ensure_ascii=False, separators=(",", ":")) + ";\n")

reservado = {
    s["dane_sede"]: {k: s[k] for k in RESERVADOS if k in s}
    for s in catalogo["sedes"]
}
with open(rutas.DATA_SED_JS, "w", encoding="utf-8") as f:
    f.write("/* GENERADO POR build_catalogo.py - NO EDITAR A MANO */\n")
    f.write("/* USO INTERNO DE LA SECRETARÍA. No debe cargarse desde index.html. */\n")
    f.write(f"const SED_CATALOGO_META = {json.dumps(catalogo['fuentes'], ensure_ascii=False)};\n")
    f.write("const SED_RESERVADO = "
            + json.dumps(reservado, ensure_ascii=False, separators=(",", ":")) + ";\n")

print(f"\n[6] Escrito: {out}")
print(f"    {len(catalogo['sedes'])} sedes | {len(catalogo['municipios'])} municipios | "
      f"{len(ies)} I.E.")
pre = sum(1 for s in catalogo["sedes"] if s["premarcada_sin_afectacion"])
pri = [s for s in catalogo["sedes"] if s["priorizada"]]
print(f"    Pre-marcadas 'sin afectación' (tipo 5): {pre}")
print(f"    PRIORIZADAS (tipo 1 y 2) — lote 1:      {len(pri)}")
print(f"      con valor de referencia:              "
      f"{sum(1 for s in pri if s['valor_referencia'])}")
print(f"      suma de referencia:                   "
      f"${sum(s['valor_referencia'] for s in pri):,}")
print(f"    Desglose por tipo de afectación:")
for t, n in sorted(collections.Counter(
        s["tipo_censo"][:2] or "--" for s in catalogo["sedes"]).items()):
    print(f"      tipo {t:3} {n:5}")
print(f"    Sedes sin rector precargado:            "
      f"{sum(1 for s in catalogo['sedes'] if not s['rector'])}")
