// Arma una variante de la app en otra carpeta, sin tocar docs/ (que siempre es producción).
// Uso: node herramientas/empaquetar.js --variante beta --salida <carpeta>
// La carpeta de salida se vacía (menos su .git) y recibe una copia de docs/ con:
// config.js de la variante, manifiesto y título con otro nombre, iconos de otro
// color y el service worker sellado con el prefijo de caché de la variante.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS, sellar } from './versionar-sw.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

const VARIANTES = {
  beta: {
    nombre: 'AaronFit Beta',
    nombreCorto: 'AF Beta',
    nombreBD: 'entrena-beta',
    prefijoCache: 'beta-aaronfit-',
    color: '#fbbf24',
    descripcion: 'Versión de prueba de AaronFit. Sus datos están separados de los de la app real.',
  },
};

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`Falta ${nombre}`);
  return process.argv[i + 1];
}

export function empaquetar(variante, salida) {
  const v = VARIANTES[variante];
  if (!v) throw new Error(`Variante desconocida: ${variante}`);
  if (v.prefijoCache.startsWith('aaronfit-')) {
    // La v1.0 instalada borra toda caché que empiece con 'aaronfit-' distinta de la suya.
    throw new Error('El prefijo de caché de una variante no puede empezar con "aaronfit-"');
  }

  mkdirSync(salida, { recursive: true });
  for (const entrada of readdirSync(salida)) {
    if (entrada !== '.git') rmSync(join(salida, entrada), { recursive: true, force: true });
  }
  cpSync(DOCS, salida, { recursive: true });

  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ }).toString().trim();
  const config = {
    variante,
    nombre: v.nombre,
    nombreBD: v.nombreBD,
    prefijoCache: v.prefijoCache,
    version: `${variante}+${sha}`,
  };
  writeFileSync(
    join(salida, 'js', 'config.js'),
    `// GENERADO por herramientas/empaquetar.js (variante ${variante}). No editar.\n` +
      `export const CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`,
    'utf8',
  );

  const rutaManifiesto = join(salida, 'manifest.webmanifest');
  const manifiesto = JSON.parse(readFileSync(rutaManifiesto, 'utf8'));
  Object.assign(manifiesto, { name: v.nombre, short_name: v.nombreCorto, description: v.descripcion });
  writeFileSync(rutaManifiesto, `${JSON.stringify(manifiesto, null, 2)}\n`, 'utf8');

  const rutaIndice = join(salida, 'index.html');
  writeFileSync(rutaIndice, readFileSync(rutaIndice, 'utf8').replace('<title>AaronFit</title>', `<title>${v.nombre}</title>`), 'utf8');

  execFileSync('python', [join(RAIZ, 'herramientas', 'generar-iconos.py'), '--color', v.color, '--salida', join(salida, 'iconos')], {
    stdio: 'ignore',
  });

  return { ...sellar({ docs: salida, prefijo: v.prefijoCache }), config };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const salida = resolve(argumento('--salida'));
  if (!existsSync(DOCS)) throw new Error('No encuentro docs/');
  const { version, archivos, config } = empaquetar(argumento('--variante'), salida);
  console.log(`${config.nombre}: ${version}, ${archivos.length} archivos, base "${config.nombreBD}" → ${salida}`);
}
