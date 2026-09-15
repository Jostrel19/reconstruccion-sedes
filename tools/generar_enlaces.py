"""Genera los enlaces con token para las 26 alcaldías.

Produce tres cosas:

  tokens.json               los tokens en claro. NO se publica, NO va dentro de
                            aplicativo/. Es el archivo que la Secretaría guarda
                            para poder reexpedir un enlace perdido.
  aplicativo/js/tokens.js   solo los HASH de los tokens. Este sí es público: va
                            al sitio para poder validar sin revelar nada.
  enlaces_alcaldias.csv     municipio, alcalde, correo y enlace, listo para el
                            envío.

Los tokens se conservan entre ejecuciones: si tokens.json ya existe, se reutiliza
y solo se agregan los municipios que falten. Así regenerar el catálogo no
invalida enlaces ya repartidos.

Uso:
    python generar_enlaces.py [URL_BASE]
"""
import csv
import hashlib
import json
import secrets
import sys
import unicodedata

import rutas

# Sin I, L, O, 0 ni 1: se confunden al dictar un enlace por teléfono.
ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LARGO = 10  # ~49 bits de entropía


def nuevo_token():
    return "".join(secrets.choice(ALFABETO) for _ in range(LARGO))


def hash_token(municipio, token):
    """El municipio entra en el hash: un token no sirve para otro municipio."""
    crudo = f"{municipio}|{token}".encode("utf-8")
    return hashlib.sha256(crudo).hexdigest()[:32]


def sin_tildes(s):
    s = unicodedata.normalize("NFKD", str(s))
    return "".join(c for c in s if not unicodedata.combining(c))


def main():
    url_base = (sys.argv[1] if len(sys.argv) > 1 else rutas.URL_BASE).rstrip("/") + "/"

    rutas.asegurar_directorios()
    with open(rutas.CATALOGO_JSON, encoding="utf-8") as f:
        catalogo = json.load(f)
    municipios = catalogo["municipios"]

    ruta_tokens = rutas.TOKENS_JSON
    tokens = {}
    if ruta_tokens.exists():
        with open(ruta_tokens, encoding="utf-8") as f:
            tokens = json.load(f)
        print(f"tokens.json existente: {len(tokens)} municipios, se conservan")

    nuevos = 0
    for m in municipios:
        if m["municipio"] not in tokens:
            tokens[m["municipio"]] = nuevo_token()
            nuevos += 1

    with open(ruta_tokens, "w", encoding="utf-8") as f:
        json.dump(tokens, f, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"tokens generados nuevos: {nuevos}")

    # --- tokens.js: solo hashes -------------------------------------------
    hashes = {m["municipio"]: hash_token(m["municipio"], tokens[m["municipio"]])
              for m in municipios}
    with open(rutas.TOKENS_JS, "w", encoding="utf-8") as f:
        f.write("/* GENERADO POR generar_enlaces.py - NO EDITAR A MANO */\n")
        f.write("/* Solo HASH de los tokens. Los tokens en claro viven en\n"
                "   tokens.json, que NO se publica. */\n")
        f.write("const SED_TOKENS = "
                + json.dumps(hashes, ensure_ascii=False, indent=1) + ";\n")

    # --- CSV para el envío -------------------------------------------------
    salida = rutas.ENLACES_CSV
    with open(salida, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["MUNICIPIO", "ALCALDE", "CORREO ALCALDIA", "SEDES",
                    "SIN AFECTACION PREMARCADAS", "TOKEN", "ENLACE"])
        for m in sorted(municipios, key=lambda x: x["municipio"]):
            mun = m["municipio"]
            enlace = f"{url_base}index.html?m={sin_tildes(mun).replace(' ', '%20')}&t={tokens[mun]}"
            w.writerow([mun, m["alcalde"], m["correo_alcaldia"], m["total_sedes"],
                        m["premarcadas_sin_afectacion"], tokens[mun], enlace])

    print(f"\nEscrito: {salida}")
    print(f"Escrito: {rutas.TOKENS_JS}")
    print(f"URL base: {url_base}")
    print(f"\n{'MUNICIPIO':<14} {'SEDES':>6}  ENLACE")
    for m in sorted(municipios, key=lambda x: -x["total_sedes"]):
        mun = m["municipio"]
        enlace = f"{url_base}index.html?m={sin_tildes(mun).replace(' ', '%20')}&t={tokens[mun]}"
        print(f"{mun:<14} {m['total_sedes']:>6}  {enlace}")


if __name__ == "__main__":
    main()
