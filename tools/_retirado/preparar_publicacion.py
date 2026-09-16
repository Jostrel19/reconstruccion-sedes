"""Arma la carpeta que se sube al hosting, sin lo que no debe publicarse.

Copiar `web/` a mano y borrar los dos archivos reservados funciona una vez. A la
tercera versión alguien olvida borrarlos, o arrastra una copia vieja que ya no
tiene los últimos cambios. Este script rehace la carpeta desde cero cada vez.

Sube además la versión antes de copiar, porque olvidarlo tiene consecuencia
directa: el navegador de cada alcaldía se queda con el JavaScript viejo en caché
y la corrección no le llega. Como este script solo se ejecuta para publicar,
subir la versión siempre es lo correcto.

Uso:
    python tools/preparar_publicacion.py            sube el último número (0.9.1 -> 0.9.2)
    python tools/preparar_publicacion.py 1.0.0      versión explícita
    python tools/preparar_publicacion.py --misma    no toca la versión

Escribe `data/generado/publicar/`. Se arrastra su contenido a GitHub.

Excluye `consola.html` y `data-sed.js` (D-6: llevan el valor estimado por el
modelo) y verifica que no haya quedado ninguna referencia a `valor_modelo` en lo
que sí se publica. Si la encuentra, no deja publicar.
"""
from __future__ import annotations

import importlib
import shutil
import sys

import rutas
import versionar

# `consola.js` no expone ningún valor, pero solo lo carga `consola.html`, que no
# se publica: subirlo es regalar la lógica interna de verificación y contraste
# sin que nadie lo use.
RESERVADOS = {"consola.html", "data-sed.js", "consola.js"}
DESTINO = rutas.GENERADO / "publicar"


def siguiente(v: str) -> str:
    mayor, menor, parche = v.split(".")
    return f"{mayor}.{menor}.{int(parche) + 1}"


def resolver_version() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg == "--misma":
        print(f"Versión sin cambios: {versionar.version_actual()}\n")
        return
    versionar.aplicar(arg or siguiente(versionar.version_actual()))
    print()
    # rutas.VERSION quedó leído en memoria con el valor viejo.
    importlib.reload(rutas)


def main():
    if not rutas.WEB.exists():
        raise SystemExit(f"No existe {rutas.WEB}")

    resolver_version()

    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    shutil.copytree(rutas.WEB, DESTINO,
                    ignore=lambda d, nombres: [n for n in nombres if n in RESERVADOS])

    copiados = sorted(p for p in DESTINO.rglob("*") if p.is_file())

    # El valor del modelo no puede viajar al navegador del alcalde. Se revisa
    # sobre lo que efectivamente quedó, no sobre lo que se pretendía copiar.
    fugas = [p.relative_to(DESTINO) for p in copiados
             if "valor_modelo" in p.read_text(encoding="utf-8", errors="ignore")]
    if fugas:
        shutil.rmtree(DESTINO)
        print("SE DETUVO: estos archivos mencionan valor_modelo y no pueden publicarse:")
        for f in fugas:
            print(f"   {f}")
        raise SystemExit(1)

    print(f"Carpeta lista para publicar: {DESTINO}")
    print(f"Versión: {rutas.VERSION}\n")
    for p in copiados:
        print(f"   {p.relative_to(DESTINO)}")
    print(f"\n{len(copiados)} archivos. Excluidos: {', '.join(sorted(RESERVADOS))}")
    print("\nArrastre a GitHub el CONTENIDO de esa carpeta (index.html y assets),")
    print("no la carpeta misma.")


if __name__ == "__main__":
    main()
