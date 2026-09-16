"""Vigila la carpeta de entregas y rehace el consolidado cuando algo cambia.

OneDrive sincroniza la carpeta compartida al disco. Este vigilante mira esa
carpeta cada pocos segundos y, en cuanto un municipio sube un paquete, vuelve a
correr `consolidar.py`. El Excel se llena solo: nadie tiene que acordarse de
ejecutar nada.

Uso:
    python tools/vigilar.py                        (usa data/entregas/)
    python tools/vigilar.py "C:/.../Entregas"      (otra carpeta)
    python tools/vigilar.py "C:/.../Entregas" 30   (revisa cada 30 s)

Se detiene con Ctrl+C.

Dos cuidados que justifican el código de abajo:

- **Un archivo a medio sincronizar es un archivo roto.** OneDrive lo escribe por
  partes, así que solo se consolida cuando la carpeta se ve igual en dos
  revisiones seguidas: si sigue creciendo, se espera.
- **Excel bloquea el libro que tiene abierto.** Si el consolidado está abierto,
  `wb.save()` falla con PermissionError. Se avisa y se reintenta en la siguiente
  vuelta en vez de morir y dejar de vigilar.
"""
from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path

import consolidar
import rutas

INTERVALO_POR_DEFECTO = 20  # segundos


def firma(carpeta: Path):
    """Estado observable de la carpeta: qué archivos hay y de qué tamaño."""
    return {
        str(p.relative_to(carpeta)): (p.stat().st_size, int(p.stat().st_mtime))
        for p in carpeta.rglob("*.json")
    }


def ahora():
    return datetime.now().strftime("%H:%M:%S")


def consolidar_ahora(carpeta: Path) -> bool:
    argv = sys.argv
    sys.argv = ["consolidar.py", str(carpeta)]
    try:
        consolidar.main()
        return True
    except PermissionError:
        print(f"[{ahora()}] El consolidado está abierto en Excel. "
              f"Ciérrelo; se reintenta en la próxima revisión.")
        return False
    except Exception as e:
        print(f"[{ahora()}] Error al consolidar: {e}")
        return False
    finally:
        sys.argv = argv


def main():
    carpeta = Path(sys.argv[1]) if len(sys.argv) > 1 else rutas.DATA / "entregas"
    intervalo = int(sys.argv[2]) if len(sys.argv) > 2 else INTERVALO_POR_DEFECTO
    carpeta.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("VIGILANTE DE ENTREGAS — Secretaría de Educación de Caldas")
    print("=" * 70)
    print(f"Carpeta:  {carpeta}")
    print(f"Revisa:   cada {intervalo} s")
    print(f"Escribe:  {rutas.GENERADO}")
    print("Detener:  Ctrl+C\n")

    anterior = None          # lo consolidado por última vez
    en_transito = None       # visto en la vuelta pasada, aún sin estabilizar

    try:
        while True:
            actual = firma(carpeta)

            if actual != anterior:
                if actual == en_transito:
                    # Dos revisiones seguidas viéndose igual: ya terminó de bajar.
                    n = len(actual)
                    print(f"\n[{ahora()}] Cambio detectado — {n} archivo(s) en la carpeta")
                    print("-" * 70)
                    if consolidar_ahora(carpeta):
                        anterior = actual
                    print("-" * 70)
                else:
                    if en_transito is not None:
                        print(f"[{ahora()}] Sincronizando… se espera a que termine")
                    en_transito = actual
            else:
                en_transito = actual

            time.sleep(intervalo)

    except KeyboardInterrupt:
        print(f"\n[{ahora()}] Vigilante detenido.")


if __name__ == "__main__":
    main()
