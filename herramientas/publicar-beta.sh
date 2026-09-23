#!/usr/bin/env bash
# Publica la BETA (rama v2) en https://aaronfloresdotnet.github.io/AaronFit-beta/
# La beta tiene su propia base de datos y su propio caché: no toca la app real.
# Si algo falla, no publica nada.
set -euo pipefail
cd "$(dirname "$0")/.."

rama=$(git branch --show-current)
if [ "$rama" != "v2" ]; then
  echo "La beta solo se publica desde la rama v2 (estás en $rama)." >&2
  exit 1
fi

node herramientas/versionar-sw.js
node --test
if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin confirmar. Confírmalos y vuelve a correr." >&2
  git status --short >&2
  exit 1
fi

destino=.beta
if [ ! -d "$destino/.git" ]; then
  git clone -q https://github.com/aaronfloresdotnet/AaronFit-beta.git "$destino"
fi
git -C "$destino" fetch -q origin || true
git -C "$destino" checkout -q -B main
git -C "$destino" reset -q --hard origin/main 2>/dev/null || true

node herramientas/empaquetar.js --variante beta --salida "$destino"

sha=$(git rev-parse --short HEAD)
git -C "$destino" add -A
if git -C "$destino" diff --cached --quiet; then
  echo "La beta ya estaba al día con AaronFit@$sha."
else
  git -C "$destino" commit -q -m "Beta desde AaronFit@$sha (rama v2)"
  git -C "$destino" push -q origin main
  echo "Beta subida desde AaronFit@$sha. GitHub Pages la publica en uno o dos minutos en:"
fi
echo "https://aaronfloresdotnet.github.io/AaronFit-beta/"
