"""Genera los iconos de la PWA (192, 512 y 512 enmascarable).

Uso: python herramientas/generar-iconos.py [--color #4ade80] [--salida docs/iconos]
Dibuja una mancuerna sobre fondo oscuro, con supermuestreo para bordes suaves.
El enmascarable deja la figura dentro de la zona segura (círculo del 80 %).
La beta usa otro color para no confundirla con la app real.
"""
import argparse
import pathlib

from PIL import Image, ImageDraw

FONDO = (11, 13, 16, 255)
VERDE = "#4ade80"
SALIDA = pathlib.Path(__file__).resolve().parent.parent / "docs" / "iconos"


def color_rgba(texto):
    texto = texto.lstrip("#")
    return tuple(int(texto[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


def mancuerna(dibujo, lado, escala, color):
    """Barra horizontal con dos discos grandes y dos chicos, centrada."""
    c = lado / 2
    w = lado * escala
    radio = w * 0.035

    def barra(cx, ancho, alto):
        dibujo.rounded_rectangle(
            [cx - ancho / 2, c - alto / 2, cx + ancho / 2, c + alto / 2], radius=radio, fill=color
        )

    barra(c, w * 0.92, w * 0.085)  # barra
    for signo in (-1, 1):
        barra(c + signo * w * 0.27, w * 0.12, w * 0.58)  # disco grande
        barra(c + signo * w * 0.405, w * 0.095, w * 0.40)  # disco chico


def icono(tam, enmascarable, color):
    lado = tam * 4
    imagen = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    dibujo = ImageDraw.Draw(imagen)
    if enmascarable:
        dibujo.rectangle([0, 0, lado, lado], fill=FONDO)
        mancuerna(dibujo, lado, 0.58, color)
    else:
        dibujo.rounded_rectangle([0, 0, lado - 1, lado - 1], radius=lado * 0.22, fill=FONDO)
        mancuerna(dibujo, lado, 0.74, color)
    return imagen.resize((tam, tam), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--color", default=VERDE)
    parser.add_argument("--salida", default=str(SALIDA))
    args = parser.parse_args()
    salida = pathlib.Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    color = color_rgba(args.color)
    for nombre, tam, enmascarable in [
        ("icono-192.png", 192, False),
        ("icono-512.png", 512, False),
        ("icono-maskable-512.png", 512, True),
    ]:
        icono(tam, enmascarable, color).save(salida / nombre, optimize=True)
        print(f"{nombre}: {tam}x{tam} ({args.color})")


if __name__ == "__main__":
    main()
