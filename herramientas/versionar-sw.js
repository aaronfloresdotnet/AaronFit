// Escribe en docs/sw.js la lista de archivos a guardar sin internet y la
// versión de caché (huella del contenido). Si cualquier archivo de la app
// cambia, cambia la versión: el teléfono descarta lo viejo y sirve lo nuevo.
// Uso: node herramientas/versionar-sw.js
// También exporta calcular() para que la prueba verifique que está al día.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));
const SW = join(DOCS, 'sw.js');
const EXCLUIDOS = new Set(['sw.js', '.nojekyll']);
const BLOQUE = /\/\/ <archivos>[\s\S]*?\/\/ <\/archivos>/;

function listar(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listar(join(carpeta, e.name)) : [join(carpeta, e.name)],
  );
}

/** Rutas relativas ('./js/app.js') y versión 'aaronfit-<huella>'. */
export function calcular() {
  const rutas = listar(DOCS)
    .map((archivo) => relative(DOCS, archivo).split(sep).join('/'))
    .filter((ruta) => !EXCLUIDOS.has(ruta))
    .sort();
  const huella = createHash('sha256');
  for (const ruta of rutas) huella.update(`${ruta}\0`).update(readFileSync(join(DOCS, ruta))).update('\0');
  return { version: `aaronfit-${huella.digest('hex').slice(0, 12)}`, archivos: ['./', ...rutas.map((r) => `./${r}`)] };
}

export function bloque({ version, archivos }) {
  const lista = archivos.map((a) => `  '${a}',`).join('\n');
  return `// <archivos> — generado por herramientas/versionar-sw.js; no editar a mano.\nconst VERSION = '${version}';\nconst ARCHIVOS = [\n${lista}\n];\n// </archivos>`;
}

export function leerBloqueActual() {
  return readFileSync(SW, 'utf8').match(BLOQUE)?.[0] ?? null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const calculado = calcular();
  const codigo = readFileSync(SW, 'utf8');
  if (!BLOQUE.test(codigo)) throw new Error('docs/sw.js no tiene el bloque <archivos>');
  writeFileSync(SW, codigo.replace(BLOQUE, bloque(calculado)), 'utf8');
  console.log(`sw.js: ${calculado.version}, ${calculado.archivos.length} archivos`);
}
