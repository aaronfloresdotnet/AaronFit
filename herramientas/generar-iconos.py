"""Genera los iconos de la PWA en docs/iconos/ (192, 512 y 512 enmascarable).

Uso: python herramientas/generar-iconos.py
Dibuja una mancuerna verde sobre fondo oscuro, con supermuestreo para bordes suaves.
El enmascarable deja la figura dentro de la zona segura (círculo del 80 %).
"""
import pathlib

from PIL import Image, ImageDraw

FONDO = (11, 13, 16, 255)
ACENTO = (74, 222, 128, 255)
SALIDA = pathlib.Path(__file__).resolve().parent.parent / "docs" / "iconos"


def mancuerna(dibujo, lado, escala):
    """Barra horizontal con dos discos grandes y dos chicos, centrada."""
    c = lado / 2
    w = lado * escala
    radio = w * 0.035

    def barra(cx, ancho, alto):
        dibujo.rounded_rectangle(
            [cx - ancho / 2, c - alto / 2, cx + ancho / 2, c + alto / 2], radius=radio, fill=ACENTO
        )

    barra(c, w * 0.92, w * 0.085)  # barra
    for signo in (-1, 1):
        barra(c + signo * w * 0.27, w * 0.12, w * 0.58)  # disco grande
        barra(c + signo * w * 0.405, w * 0.095, w * 0.40)  # disco chico


def icono(tam, enmascarable):
    lado = tam * 4
    imagen = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    dibujo = ImageDraw.Draw(imagen)
    if enmascarable:
        dibujo.rectangle([0, 0, lado, lado], fill=FONDO)
        mancuerna(dibujo, lado, 0.58)
    else:
        dibujo.rounded_rectangle([0, 0, lado - 1, lado - 1], radius=lado * 0.22, fill=FONDO)
        mancuerna(dibujo, lado, 0.74)
    return imagen.resize((tam, tam), Image.LANCZOS)


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    for nombre, tam, enmascarable in [
        ("icono-192.png", 192, False),
        ("icono-512.png", 512, False),
        ("icono-maskable-512.png", 512, True),
    ]:
        icono(tam, enmascarable).save(SALIDA / nombre, optimize=True)
        print(f"{nombre}: {tam}x{tam}")


if __name__ == "__main__":
    main()
