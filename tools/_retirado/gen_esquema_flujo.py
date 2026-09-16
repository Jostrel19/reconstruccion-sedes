"""Genera los insumos que necesita el flujo de Power Automate.

Produce, en docs/flujo/:

  ejemplo_presupuesto.json      paquete real de una sede con presupuesto
  ejemplo_sin_afectacion.json   paquete real de declaraciones sin afectación
  esquema_presupuesto.json      esquema para la acción «Analizar JSON»
  esquema_sin_afectacion.json   idem
  columnas_listas.csv           columnas exactas de las tres listas de SharePoint

Los ejemplos sirven para el botón «Generar a partir de una muestra» de Power
Automate; los esquemas, para pegarlos directamente. Se generan desde el mismo
código que arma los paquetes, así que no se desincronizan del aplicativo.

Todos los textos se declaran como ["string","null"]: si un campo llega vacío y
el esquema dice solo "string", «Analizar JSON» falla y el paquete se pierde.
"""
from __future__ import annotations

import csv
import json

import rutas

SALIDA = rutas.DOCS / "flujo"


# --------------------------------------------------------------- ejemplos ---
def cabecera_ejemplo() -> dict:
    """Mismos campos que arma formulario.js al radicar."""
    return {
        "id_radicado": "SED-PRE-117446000157-v1",
        "version": 1,
        "dane_sede": "117446000157",
        "municipio": "MARULANDA",
        "dane_ie": "117446000157",
        "institucion": "INSTITUCION EDUCATIVA EFREN CARDONA CHICA",
        "sede": "INSTITUCION EDUCATIVA EFREN CARDONA CHICA - SEDE PRINCIPAL",
        "zona": "URBANA",
        "matricula": 68,
        "tipo_censo": "3. AFECTACIONES ESTRUCTURALES O FUNCIONALES PARCIALES",
        "nivel_censo": "Grave",
        "declara_afectacion": True,
        "hay_discrepancia": False,
        "justificacion_discrepancia": "",
        "descripcion_afectacion": "Agrietamiento en muros de fachada y desprendimiento "
                                  "parcial de la cubierta sobre dos aulas.",
        "alcalde": "LEONARDO ANDRES GIRALDO BOTERO",
        "rector": "NOMBRE DEL RECTOR",
        "correo": "correo@sedcaldas.gov.co",
        "celular": "3000000000",
        "costo_directo": 18000000,
        "pct_admin": 10,
        "pct_utilidad": 5,
        "valor_admin": 1800000,
        "valor_utilidad": 900000,
        "valor_iva": 171000,
        "total_presupuesto": 20871000,
        "plazo_dias": 75,
        "actividades": "Desmonte de cubierta: 15 dias\nInstalacion: 30 dias",
        "estado": "RADICADO",
        "fecha_radicacion": "2026-09-08T21:40:00.000Z",
    }


def paquete_presupuesto() -> dict:
    """Idéntico a api.js _payload()."""
    return {
        "accion": "radicarPresupuesto",
        "esquema": 1,
        "version_app": rutas.VERSION,
        "enviado": "2026-09-08T21:40:00.000Z",
        "cabecera": cabecera_ejemplo(),
        "items": [
            {
                "n_item": 1,
                "capitulo_dano": 3,
                "capitulo_nombre": "3. Cubierta",
                "descripcion": "Reposicion de cubierta en teja de fibrocemento",
                "unidad": "M2",
                "cantidad": 200,
                "valor_unitario": 90000,
                "valor_total": 18000000,
            }
        ],
        "fotos": [
            {"nombre": "fachada.jpg", "tipo": "image/jpeg", "contenido_b64": "/9j/4AAQSkZJRg..."}
        ],
    }


def paquete_sin_afectacion() -> dict:
    """Idéntico a tablero.js descargarSinAfectacion()."""
    reg = cabecera_ejemplo()
    reg.update({
        "id_radicado": "SED-PRE-217446000097-v1",
        "dane_sede": "217446000097",
        "sede": "ESCUELA RURAL HERVEO",
        "zona": "RURAL",
        "matricula": 19,
        "tipo_censo": "5. SIN AFECTACIÓN",
        "nivel_censo": "",
        "declara_afectacion": False,
        "descripcion_afectacion": "",
        "costo_directo": 0,
        "pct_admin": 0,
        "pct_utilidad": 0,
        "valor_admin": 0,
        "valor_utilidad": 0,
        "valor_iva": 0,
        "total_presupuesto": 0,
        "plazo_dias": 0,
        "actividades": "",
        "estado": "SIN_AFECTACION",
    })
    reg["items"] = []
    reg["fotos"] = []
    return {
        "accion": "declararSinAfectacion",
        "esquema": 1,
        "version_app": rutas.VERSION,
        "municipio": "MARULANDA",
        "enviado": "2026-09-08T21:40:00.000Z",
        "registros": [reg],
    }


# ---------------------------------------------------------------- esquema ---
def inferir(valor):
    """JSON Schema tolerante: los textos admiten null porque los campos
    opcionales llegan vacíos y «Analizar JSON» aborta si no lo contempla."""
    if isinstance(valor, bool):
        return {"type": "boolean"}
    if isinstance(valor, int):
        return {"type": "integer"}
    if isinstance(valor, float):
        return {"type": "number"}
    if isinstance(valor, str):
        return {"type": ["string", "null"]}
    if isinstance(valor, list):
        if not valor:
            return {"type": "array", "items": {}}
        return {"type": "array", "items": inferir(valor[0])}
    if isinstance(valor, dict):
        return {
            "type": "object",
            "properties": {k: inferir(v) for k, v in valor.items()},
        }
    return {}


# ------------------------------------------------------- columnas listas ---
COLUMNAS = [
    # lista, columna, tipo, indexada, origen en el paquete
    ("PresupuestosSedes", "Título", "Texto", "", "cabecera/id_radicado"),
    ("PresupuestosSedes", "dane_sede", "Texto", "SI", "cabecera/dane_sede"),
    ("PresupuestosSedes", "municipio", "Elección", "SI", "cabecera/municipio"),
    ("PresupuestosSedes", "dane_ie", "Texto", "", "cabecera/dane_ie"),
    ("PresupuestosSedes", "institucion", "Texto", "", "cabecera/institucion"),
    ("PresupuestosSedes", "sede", "Texto", "", "cabecera/sede"),
    ("PresupuestosSedes", "zona", "Elección", "", "cabecera/zona"),
    ("PresupuestosSedes", "matricula", "Número entero", "", "cabecera/matricula"),
    ("PresupuestosSedes", "tipo_censo", "Texto", "", "cabecera/tipo_censo"),
    ("PresupuestosSedes", "nivel_censo", "Texto", "", "cabecera/nivel_censo"),
    ("PresupuestosSedes", "declara_afectacion", "Sí/No", "SI", "cabecera/declara_afectacion"),
    ("PresupuestosSedes", "hay_discrepancia", "Sí/No", "SI", "cabecera/hay_discrepancia"),
    ("PresupuestosSedes", "justificacion_discrepancia", "Varias líneas", "", "cabecera/justificacion_discrepancia"),
    ("PresupuestosSedes", "descripcion_afectacion", "Varias líneas", "", "cabecera/descripcion_afectacion"),
    ("PresupuestosSedes", "alcalde", "Texto", "", "cabecera/alcalde"),
    ("PresupuestosSedes", "rector", "Texto", "", "cabecera/rector"),
    ("PresupuestosSedes", "correo", "Texto", "", "cabecera/correo"),
    ("PresupuestosSedes", "celular", "Texto", "", "cabecera/celular"),
    ("PresupuestosSedes", "costo_directo", "Moneda", "", "cabecera/costo_directo"),
    ("PresupuestosSedes", "pct_admin", "Número 2 dec", "", "cabecera/pct_admin"),
    ("PresupuestosSedes", "pct_utilidad", "Número 2 dec", "", "cabecera/pct_utilidad"),
    ("PresupuestosSedes", "valor_admin", "Moneda", "", "cabecera/valor_admin"),
    ("PresupuestosSedes", "valor_utilidad", "Moneda", "", "cabecera/valor_utilidad"),
    ("PresupuestosSedes", "valor_iva", "Moneda", "", "cabecera/valor_iva"),
    ("PresupuestosSedes", "total_presupuesto", "Moneda", "", "cabecera/total_presupuesto"),
    ("PresupuestosSedes", "plazo_dias", "Número entero", "", "cabecera/plazo_dias"),
    ("PresupuestosSedes", "actividades", "Varias líneas", "", "cabecera/actividades"),
    ("PresupuestosSedes", "estado", "Elección", "SI", "cabecera/estado"),
    ("PresupuestosSedes", "version", "Número entero", "", "cabecera/version"),
    ("PresupuestosSedes", "fecha_radicacion", "Fecha y hora", "", "cabecera/fecha_radicacion"),
    ("PresupuestosSedes", "valor_modelo", "Moneda", "", "lo escribe el flujo desde CatalogoSedes"),
    ("PresupuestosSedes", "desviacion_pct", "Número 2 dec", "", "lo calcula el flujo"),
    ("PresupuestosSedes", "archivo_origen", "Texto", "", "nombre del archivo subido"),
    ("PresupuestosSedes", "resultado_verificacion", "Elección", "", "lo diligencia la SED"),
    ("PresupuestosSedes", "observaciones_verificacion", "Varias líneas", "", "lo diligencia la SED"),
    ("PresupuestosSedes", "verificador", "Texto", "", "lo diligencia la SED"),
    ("PresupuestosSedes", "cedula_verificador", "Texto", "", "lo diligencia la SED"),
    ("PresupuestosSedes", "fecha_verificacion", "Fecha y hora", "", "lo diligencia la SED"),

    ("ItemsPresupuesto", "Título", "Texto", "", "id_radicado + '-' + n_item"),
    ("ItemsPresupuesto", "id_radicado", "Texto", "SI", "cabecera/id_radicado"),
    ("ItemsPresupuesto", "dane_sede", "Texto", "SI", "cabecera/dane_sede"),
    ("ItemsPresupuesto", "n_item", "Número entero", "", "items/n_item"),
    ("ItemsPresupuesto", "capitulo_dano", "Número entero", "", "items/capitulo_dano"),
    ("ItemsPresupuesto", "capitulo_nombre", "Texto", "", "items/capitulo_nombre"),
    ("ItemsPresupuesto", "descripcion", "Varias líneas", "", "items/descripcion"),
    ("ItemsPresupuesto", "unidad", "Elección", "", "items/unidad"),
    ("ItemsPresupuesto", "cantidad", "Número 2 dec", "", "items/cantidad"),
    ("ItemsPresupuesto", "valor_unitario", "Moneda", "", "items/valor_unitario"),
    ("ItemsPresupuesto", "valor_total", "Moneda", "", "items/valor_total"),

    ("CatalogoSedes", "Título", "Texto", "", "dane_sede"),
    ("CatalogoSedes", "dane_sede", "Texto", "SI", "catalogo_sedes.json"),
    ("CatalogoSedes", "municipio", "Elección", "SI", "catalogo_sedes.json"),
    ("CatalogoSedes", "dane_ie", "Texto", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "institucion", "Texto", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "sede", "Texto", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "zona", "Elección", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "matricula", "Número entero", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "estado_sede", "Texto", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "tipo_censo", "Texto", "SI", "catalogo_sedes.json"),
    ("CatalogoSedes", "nivel_censo", "Texto", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "valor_modelo", "Moneda", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "orden_priorizacion", "Número entero", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "rector", "Texto", "", "catalogo_sedes.json"),
    ("CatalogoSedes", "correo_ie", "Texto", "", "catalogo_sedes.json"),
]


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)

    pres = paquete_presupuesto()
    sina = paquete_sin_afectacion()

    for nombre, datos in (("ejemplo_presupuesto", pres), ("ejemplo_sin_afectacion", sina)):
        (SALIDA / f"{nombre}.json").write_text(
            json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")

    for nombre, datos in (("esquema_presupuesto", pres), ("esquema_sin_afectacion", sina)):
        (SALIDA / f"{nombre}.json").write_text(
            json.dumps(inferir(datos), ensure_ascii=False, indent=1), encoding="utf-8")

    # Esquema unificado: cubre los dos tipos de paquete, con todo opcional. Deja
    # el flujo con un solo «Analizar JSON» y un «Switch» sobre `accion`, en vez
    # de duplicar la rama de lectura.
    unificado = inferir(pres)
    unificado["properties"]["municipio"] = {"type": ["string", "null"]}
    unificado["properties"]["registros"] = inferir(sina)["properties"]["registros"]
    (SALIDA / "esquema_unificado.json").write_text(
        json.dumps(unificado, ensure_ascii=False, indent=1), encoding="utf-8")

    with open(SALIDA / "columnas_listas.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["LISTA", "COLUMNA", "TIPO", "INDEXADA", "ORIGEN"])
        w.writerows(COLUMNAS)

    print(f"Escrito en {SALIDA}:")
    for p in sorted(SALIDA.iterdir()):
        print(f"  {p.name}")
    print(f"\nColumnas especificadas: {len(COLUMNAS)}")
    for lista in ("PresupuestosSedes", "ItemsPresupuesto", "CatalogoSedes"):
        print(f"  {lista}: {sum(1 for c in COLUMNAS if c[0] == lista)}")


if __name__ == "__main__":
    main()
