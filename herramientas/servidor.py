"""Servidor local de desarrollo para AaronFit.

Sirve la carpeta docs/ con los tipos MIME correctos (en Windows el registro
puede mandar .js como text/plain y Chrome se niega a ejecutar los módulos) y
sin caché HTTP, para que cada recarga vea los cambios.

Uso: python herramientas/servidor.py [puerto]
"""
import functools
import http.server
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent / "docs"
TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
}


class Manejador(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **TIPOS}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    manejador = functools.partial(Manejador, directory=str(RAIZ))
    with http.server.ThreadingHTTPServer(("127.0.0.1", puerto), manejador) as servidor:
        print(f"AaronFit en http://localhost:{puerto}/ (sirviendo {RAIZ})", flush=True)
        servidor.serve_forever()


if __name__ == "__main__":
    main()
