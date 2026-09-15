"""Sube la versión del aplicativo en los tres sitios donde debe coincidir.

El sufijo `?v=` de los recursos es lo que obliga al navegador de cada alcaldía a
descargar el JavaScript nuevo. Si se corrige un error y no se sube la versión,
quien ya entró seguirá con la versión vieja en caché y el error persistirá para
esa persona.

Mantener esto a mano es garantía de olvidarlo, así que se automatiza.

Uso:
    python tools/versionar.py 0.2.0
    python tools/versionar.py            (muestra la versión actual)
"""
from __future__ import annotations

import re
import sys

import rutas

CONFIG_JS = rutas.JS / "config.js"
HTMLS = (rutas.WEB / "index.html", rutas.WEB / "consola.html")
RUTAS_PY = rutas.RAIZ / "tools" / "rutas.py"


def version_actual() -> str:
    s = CONFIG_JS.read_text(encoding="utf-8")
    m = re.search(r"VERSION:\s*'([^']+)'", s)
    if not m:
        raise SystemExit("No se encontró VERSION en config.js")
    return m.group(1)


def aplicar(nueva: str) -> None:
    if not re.fullmatch(r"\d+\.\d+\.\d+", nueva):
        raise SystemExit(f"Versión inválida: {nueva}. Use el formato 1.2.3")

    actual = version_actual()

    s = CONFIG_JS.read_text(encoding="utf-8")
    s = re.sub(r"(VERSION:\s*')[^']+(')", rf"\g<1>{nueva}\g<2>", s, count=1)
    CONFIG_JS.write_text(s, encoding="utf-8")

    for p in HTMLS:
        s = p.read_text(encoding="utf-8")
        n = len(re.findall(r"\?v=[^\"]*", s))
        s = re.sub(r"\?v=[^\"]*", f"?v={nueva}", s)
        p.write_text(s, encoding="utf-8")
        print(f"  {p.name}: {n} recursos actualizados")

    s = RUTAS_PY.read_text(encoding="utf-8")
    s = re.sub(r'(VERSION = ")[^"]+(")', rf"\g<1>{nueva}\g<2>", s, count=1)
    RUTAS_PY.write_text(s, encoding="utf-8")

    print(f"\nVersión {actual} -> {nueva}")
    print("Recuerde publicar el sitio para que el cambio llegue a las alcaldías.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Versión actual: {version_actual()}")
        print("Para subirla:  python tools/versionar.py 0.2.0")
    else:
        aplicar(sys.argv[1])
