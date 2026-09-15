"""Genera los paquetes de demostración para la presentación al jefe.

Simula a Marulanda con su recolección terminada. Es el municipio ideal para
mostrar: 11 sedes con la mezcla completa de casos —cuatro sin afectación, cuatro
tipo 3, dos tipo 4 y una tipo 7 sin revisar— así que en una sola pantalla se ven
todas las situaciones que el instrumento debe manejar.

Usa sedes y valores del modelo REALES del catálogo. Los presupuestos son
inventados, y por eso cada archivo va marcado como demostración.

Salida: docs/demo/  ->  se importan desde la consola durante la presentación.
"""
from __future__ import annotations

import json

import rutas

SALIDA = rutas.DOCS / "demo"
MUNICIPIO = "MARULANDA"

# Presupuestos por sede. La desviación se elige para que la demostración
# muestre los cuatro casos que el verificador va a encontrar en la vida real:
# cerca del modelo, por encima, muy por encima, y sin base de comparación.
PRESUPUESTOS = {
    # dane_sede:  (costo_directo, A%, U%, plazo, capítulo, descripción, unidad, cant)
    "117446000157": (78_000_000, 10, 5, 90, 3, "Reposición de cubierta en teja de fibrocemento "
                     "sobre bloque principal", "M2", 520),
    "117446000068": (96_000_000, 10, 5, 120, 1, "Refuerzo estructural de columnas y vigas de "
                     "amarre", "UN", 12),
    "217446800000": (145_000_000, 12, 6, 150, 1, "Reconstrucción de aula y refuerzo de "
                     "cimentación", "M2", 145),
    "217446800018": (19_000_000, 10, 5, 45, 6, "Reparación de acabados y pintura general",
                     "M2", 190),
    "217446000178": (34_000_000, 10, 5, 60, 2, "Reparación de muros en mampostería y "
                     "resane de fisuras", "M2", 170),
    "217446000038": (24_000_000, 10, 5, 60, 9, "Adecuación de cocina y restaurante escolar",
                     "GL", 1),
    # Tipo 7, sin revisar: el modelo nunca la valoró. Muestra el caso «sin base».
    "217446000089": (45_000_000, 10, 5, 90, 3, "Reposición total de cubierta y cielo raso",
                     "M2", 300),
}

# Sede tipo 5 que el municipio declara CON afectación: dispara la discrepancia.
DISCREPANCIA = {
    "217446000143": (28_000_000, 10, 5, 45, 4, "Estabilización de talud posterior y obras de "
                     "drenaje", "M3", 140),
}

JUSTIFICACION = (
    "La visita técnica del 27 de agosto no registró afectación, pero con las lluvias de la "
    "primera semana de septiembre se abrió una grieta en el talud posterior que compromete el "
    "acceso al aula múltiple. Se anexa registro fotográfico del 6 de septiembre."
)

CAPITULOS = {
    1: "1. Estructural", 2: "2. Mampostería y muros", 3: "3. Cubierta",
    4: "4. Cimentación y terreno", 6: "6. Acabados", 9: "9. Cocina y restaurante escolar",
}

# JPEG 1x1 gris: marcador para que el flujo y el PDF tengan algo real que procesar.
FOTO_B64 = ("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////2wBDAf//////"
            "////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAA"
            "AAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEA"
            "AAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=")


def cargar_sedes():
    cat = json.loads(rutas.CATALOGO_JSON.read_text(encoding="utf-8"))
    mun = next(m for m in cat["municipios"] if m["municipio"] == MUNICIPIO)
    sedes = {s["dane_sede"]: s for s in cat["sedes"] if s["municipio"] == MUNICIPIO}
    return mun, sedes


def registro_base(s, mun, declara):
    return {
        "id_radicado": f"SED-PRE-{s['dane_sede']}-v1",
        "version": 1,
        "dane_sede": s["dane_sede"],
        "municipio": s["municipio"],
        "dane_ie": s["dane_ie"],
        "institucion": s["institucion"],
        "sede": s["sede"],
        "zona": s["zona"],
        "matricula": s["matricula"],
        "tipo_censo": s["tipo_censo"],
        "nivel_censo": s["nivel_censo"],
        "declara_afectacion": declara,
        "hay_discrepancia": False,
        "justificacion_discrepancia": "",
        "descripcion_afectacion": "",
        "alcalde": mun["alcalde"],
        "rector": s["rector"],
        "correo": mun["correo_alcaldia"],
        "celular": mun["celular_alcaldia"],
        "costo_directo": 0, "pct_admin": 0, "pct_utilidad": 0,
        "valor_admin": 0, "valor_utilidad": 0, "valor_iva": 0,
        "total_presupuesto": 0, "plazo_dias": 0, "actividades": "",
        "estado": "RADICADO" if declara else "SIN_AFECTACION",
        "fecha_radicacion": "2026-09-09T08:15:00.000Z",
    }


def con_presupuesto(s, mun, spec, discrepa=False):
    costo, a, u, plazo, cap, desc, unidad, cant = spec
    v_admin = round(costo * a / 100)
    v_util = round(costo * u / 100)
    v_iva = round(v_util * 0.19)
    r = registro_base(s, mun, True)
    r.update({
        "descripcion_afectacion": (
            f"La sede presenta {desc.lower()}. La intervención es necesaria para restablecer "
            f"las condiciones de uso de los espacios afectados."),
        "costo_directo": costo, "pct_admin": a, "pct_utilidad": u,
        "valor_admin": v_admin, "valor_utilidad": v_util, "valor_iva": v_iva,
        "total_presupuesto": costo + v_admin + v_util + v_iva,
        "plazo_dias": plazo,
        "actividades": "Desmonte y retiro de escombros: 15 días\n"
                       "Ejecución de la intervención: 60 días\nEntrega y limpieza: 15 días",
    })
    if discrepa:
        r["hay_discrepancia"] = True
        r["justificacion_discrepancia"] = JUSTIFICACION
    items = [{
        "n_item": 1, "capitulo_dano": cap, "capitulo_nombre": CAPITULOS[cap],
        "descripcion": desc, "unidad": unidad, "cantidad": cant,
        "valor_unitario": round(costo / cant), "valor_total": costo,
    }]
    return {
        "accion": "radicarPresupuesto",
        "esquema": 1,
        "version_app": rutas.VERSION,
        "enviado": "2026-09-09T08:15:00.000Z",
        "_demostracion": True,
        "cabecera": r,
        "items": items,
        "fotos": [{"nombre": f"{s['dane_sede']}_01.jpg", "tipo": "image/jpeg",
                   "contenido_b64": FOTO_B64}],
    }


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    for viejo in SALIDA.glob("*.json"):
        viejo.unlink()

    mun, sedes = cargar_sedes()
    generados = []

    for dane, spec in {**PRESUPUESTOS, **DISCREPANCIA}.items():
        s = sedes[dane]
        paq = con_presupuesto(s, mun, spec, discrepa=dane in DISCREPANCIA)
        nombre = f"presupuesto_{dane}_v1.json"
        (SALIDA / nombre).write_text(json.dumps(paq, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
        generados.append((nombre, s["sede"], spec[0], s["valor_modelo"]))

    # Las sin afectación: las que el censo marcó tipo 5 y el municipio confirmó.
    usados = set(PRESUPUESTOS) | set(DISCREPANCIA)
    sin_afect = [registro_base(s, mun, False) for d, s in sedes.items()
                 if d not in usados and s["tipo_censo"].startswith("5.")]
    for r in sin_afect:
        r["items"] = []
        r["fotos"] = []
    paquete = {
        "accion": "declararSinAfectacion",
        "esquema": 1,
        "version_app": rutas.VERSION,
        "municipio": MUNICIPIO,
        "enviado": "2026-09-09T08:20:00.000Z",
        "_demostracion": True,
        "registros": sin_afect,
    }
    (SALIDA / f"sin_afectacion_{MUNICIPIO}.json").write_text(
        json.dumps(paquete, ensure_ascii=False, indent=1), encoding="utf-8")

    # Resumen para el guion
    comparables = [(n, sd, c, m) for n, sd, c, m in generados if m > 0]
    tc = sum(c for _, _, c, _ in comparables)
    tm = sum(m for _, _, _, m in comparables)
    print(f"Escrito en {SALIDA}\n")
    print(f"{'SEDE':<46} {'PRESUPUESTO':>14} {'MODELO':>14} {'DESV':>8}")
    for _, sede, costo, modelo in generados:
        d = f"{(costo-modelo)/modelo*100:+.0f} %" if modelo else "sin base"
        print(f"{sede[:46]:<46} {costo:>14,} {modelo:>14,} {d:>8}")
    print(f"\nSedes con presupuesto: {len(generados)}  (comparables: {len(comparables)})")
    print(f"Declaraciones sin afectación: {len(sin_afect)}")
    print(f"Costo directo comparable: {tc:,}")
    print(f"Valor del modelo:         {tm:,}")
    print(f"DESVIACIÓN GLOBAL:        {(tc-tm)/tm*100:+.1f} %")


if __name__ == "__main__":
    main()
