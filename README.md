# AaronFit

PWA personal para registrar entrenamiento de fuerza serie por serie y medidas corporales.
Un solo usuario. Los datos viven **solo en el teléfono** (IndexedDB): sin cuentas, sin nube.

**App:** https://aaronfloresdotnet.github.io/AaronFit/ — ábrela en Chrome de Android y, en el menú, «Instalar app».

## Cómo está hecha

- HTML, CSS y JavaScript con módulos nativos: sin framework, sin compilación y sin dependencias.
- Capas: pantalla (`vistas/`, `componentes/`) → casos de uso (`servicios/`) → datos (`datos/`, IndexedDB).
  Las reglas de negocio (`logica/`) son funciones puras. Una prueba revisa que ninguna capa importe lo que no le toca.
- `docs/` es lo único que publica GitHub Pages.

| Carpeta | Qué hay |
| --- | --- |
| `docs/` | La app |
| `fuente/rutina.tsv` | La hoja de la rutina; de aquí sale la semilla |
| `herramientas/` | Generar la semilla, los iconos y la versión del service worker; servidor local; publicar |
| `pruebas/` | Pruebas de la lógica y de los casos de uso |

## Comandos

| Para qué | Comando |
| --- | --- |
| Pruebas (Node 22 o más, sin instalar nada) | `node --test` |
| Servidor local en http://localhost:8000 | `python herramientas/servidor.py` |
| Probar el service worker en local | abrir http://localhost:8000/?sw |
| Regenerar la semilla tras cambiar la hoja | `node herramientas/generar-semilla.js` |
| Sellar la versión del service worker | `node herramientas/versionar-sw.js` |
| Publicar | `bash herramientas/publicar.sh` |

## Decisiones

Todo lo que se decidió o supuso sin instrucción explícita está en [DECISIONES.tsv](DECISIONES.tsv),
una línea por decisión, con el renglón de la rutina que afecta y cómo se verificó.
