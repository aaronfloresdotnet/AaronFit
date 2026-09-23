// Escribe en sw.js la lista de archivos a guardar sin internet, el prefijo de
// caché y la versión (huella del contenido). Si cualquier archivo cambia,
// cambia la versión: el teléfono descarta lo viejo y sirve lo nuevo.
// Uso: node herramientas/versionar-sw.js [--docs <carpeta>] [--prefijo <prefijo>]
// Exporta calcular() y bloque() para la prueba y para empaquetar.js.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));
export const PREFIJO_PRODUCCION = 'aaronfit-';
const EXCLUIDOS = new Set(['sw.js', '.nojekyll']);
export const BLOQUE = /\/\/ <archivos>[\s\S]*?\/\/ <\/archivos>/;

function listar(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '.git') return [];
    return e.isDirectory() ? listar(join(carpeta, e.name)) : [join(carpeta, e.name)];
  });
}

/** Rutas relativas ('./js/app.js') y versión '<prefijo><huella>'. */
export function calcular({ docs = DOCS, prefijo = PREFIJO_PRODUCCION } = {}) {
  const rutas = listar(docs)
    .map((archivo) => relative(docs, archivo).split(sep).join('/'))
    .filter((ruta) => !EXCLUIDOS.has(ruta))
    .sort();
  const huella = createHash('sha256');
  for (const ruta of rutas) huella.update(`${ruta}\0`).update(readFileSync(join(docs, ruta))).update('\0');
  return {
    prefijo,
    version: `${prefijo}${huella.digest('hex').slice(0, 12)}`,
    archivos: ['./', ...rutas.map((r) => `./${r}`)],
  };
}

export function bloque({ prefijo, version, archivos }) {
  const lista = archivos.map((a) => `  '${a}',`).join('\n');
  return [
    '// <archivos> — generado por herramientas/versionar-sw.js; no editar a mano.',
    `const PREFIJO = '${prefijo}';`,
    `const VERSION = '${version}';`,
    'const ARCHIVOS = [',
    lista,
    '];',
    '// </archivos>',
  ].join('\n');
}

export function leerBloqueActual(docs = DOCS) {
  return readFileSync(join(docs, 'sw.js'), 'utf8').match(BLOQUE)?.[0] ?? null;
}

export function sellar({ docs = DOCS, prefijo = PREFIJO_PRODUCCION } = {}) {
  const calculado = calcular({ docs, prefijo });
  const ruta = join(docs, 'sw.js');
  const codigo = readFileSync(ruta, 'utf8');
  if (!BLOQUE.test(codigo)) throw new Error(`${ruta} no tiene el bloque <archivos>`);
  writeFileSync(ruta, codigo.replace(BLOQUE, bloque(calculado)), 'utf8');
  return calculado;
}

function argumento(nombre, porDefecto) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : porDefecto;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const docs = resolve(argumento('--docs', DOCS));
  const { version, archivos } = sellar({ docs, prefijo: argumento('--prefijo', PREFIJO_PRODUCCION) });
  console.log(`sw.js: ${version}, ${archivos.length} archivos`);
}
