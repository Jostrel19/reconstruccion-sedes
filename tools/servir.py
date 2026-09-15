"""Servidor local para probar el aplicativo.

Sirve `web/` sin depender del directorio de trabajo, y desactiva la caché: al
editar un archivo JavaScript basta recargar, sin tener que subir la versión ni
forzar recarga completa.

Uso:
    python tools/servir.py            (puerto 8777)
    python tools/servir.py 9000
"""
from __future__ import annotations

import http.server
import socketserver
import sys

import rutas

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8777


class SinCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(rutas.WEB), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, formato, *args):
        if "304" not in formato % args:
            super().log_message(formato, *args)


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PUERTO), SinCache) as httpd:
        print(f"Sirviendo {rutas.WEB}")
        print(f"  Alcaldía: http://127.0.0.1:{PUERTO}/index.html?m=MARULANDA&t=<token>")
        print(f"  Consola:  http://127.0.0.1:{PUERTO}/consola.html")
        print("Ctrl+C para detener.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDetenido.")
