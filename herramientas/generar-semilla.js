// Genera docs/js/datos/semilla.js a partir de fuente/rutina.tsv (la hoja de Aarón).
// Uso: node herramientas/generar-semilla.js
//
// - Los textos de la hoja se copian tal cual.
// - Todo se interpreta con js/logica/plan.js y parseo.js, los mismos que usa la
//   app al cambiar de rutina (tanda 4); cualquier formato desconocido es error.
// - La regla de progresión viene en la columna «Regla» (mini-sintaxis de
//   parseo.js). El texto «Progresión» es lo que ve el usuario.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerTSV, renglonesDePlan } from '../docs/js/logica/plan.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ENTRADA = join(RAIZ, 'fuente', 'rutina.tsv');
const SALIDA = join(RAIZ, 'docs', 'js', 'datos', 'semilla.js');

function main() {
  const { filas, errores: erroresTSV } = leerTSV(readFileSync(ENTRADA, 'utf8'));
  const { renglones, errores } = renglonesDePlan(filas, { plan: 1 });
  const todos = [...erroresTSV, ...errores];
  if (todos.length) throw new Error(`fuente/rutina.tsv tiene errores:\n${todos.join('\n')}`);

  const ids = new Set(renglones.map((r) => r.id));
  if (ids.size !== renglones.length) throw new Error('Hay ids de rutina repetidos');

  const cuerpo = renglones.map((r) => `  ${JSON.stringify(r)},`).join('\n');
  const version = createHash('sha256').update(JSON.stringify(renglones)).digest('hex').slice(0, 12);
  const archivo = `// GENERADO por herramientas/generar-semilla.js a partir de fuente/rutina.tsv. No editar a mano.
// id = diaSemana * 100 + orden. Un id NUNCA se reasigna: las series guardan rutinaId.
// VERSION_SEMILLA es la huella del contenido: si cambia, la app actualiza la rutina
// en el teléfono sin tocar el historial.

export const VERSION_SEMILLA = '${version}';

export const RUTINA = [
${cuerpo}
];
`;
  writeFileSync(SALIDA, archivo, 'utf8');

  // Verificación obligatoria del encargo (l.276): 43 renglones, 8-8-8-8-9-1-1 por día.
  const porDia = [1, 2, 3, 4, 5, 6, 7].map((d) => renglones.filter((r) => r.diaSemana === d).length);
  const claves = new Set(renglones.map((r) => r.clave));
  console.log(`semilla.js escrito: ${renglones.length} renglones; por día ${porDia.join('-')}; ${claves.size} ejercicios (claves); versión ${version}`);
  if (renglones.length !== 43 || porDia.join('-') !== '8-8-8-8-9-1-1') {
    console.error('EL CONTEO NO CUADRA: se esperaban 43 renglones y 8-8-8-8-9-1-1');
    process.exitCode = 1;
  }
}

main();
