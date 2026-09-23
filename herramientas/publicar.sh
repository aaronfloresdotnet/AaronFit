#!/usr/bin/env bash
# Publica AaronFit en GitHub Pages (rama main, carpeta docs/).
# Sella la versión del service worker, corre las pruebas y sube.
# Si algo falla, no publica nada.
set -euo pipefail
cd "$(dirname "$0")/.."

node herramientas/versionar-sw.js
node --test

if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin confirmar (por ejemplo, sw.js recién sellado). Confírmalos y vuelve a correr." >&2
  git status --short >&2
  exit 1
fi

git push origin main
echo "Subido. GitHub Pages lo publica en uno o dos minutos en:"
gh api repos/aaronfloresdotnet/AaronFit/pages --jq .html_url
