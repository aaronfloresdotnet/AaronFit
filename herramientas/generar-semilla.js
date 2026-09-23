// Genera docs/js/datos/semilla.js a partir de fuente/rutina.tsv (la hoja de Aarón).
// Uso: node herramientas/generar-semilla.js
//
// - Los textos de la hoja se copian tal cual.
// - Los campos derivados (números, unidades, segundos) salen de js/logica/parseo.js,
//   que lanza error ante cualquier formato que no conozca.
// - Las reglas de progresión estructuradas están abajo, una por ejercicio.
//   El texto original siempre se conserva y es lo que ve el usuario.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  nulo,
  parsearDescanso,
  parsearEntero,
  parsearPeso,
  parsearReps,
  parsearRir,
  slug,
} from '../docs/js/logica/parseo.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ENTRADA = join(RAIZ, 'fuente', 'rutina.tsv');
const SALIDA = join(RAIZ, 'docs', 'js', 'datos', 'semilla.js');

const DIAS = { LUNES: 1, MARTES: 2, 'MIÉRCOLES': 3, JUEVES: 4, VIERNES: 5, 'SÁBADO': 6, DOMINGO: 7 };

const COLUMNAS = [
  'Día', 'Orden', 'Grupo', 'Ejercicio', 'Equipo', 'Accesorio polea', 'Peso sugerido',
  'Series', 'Reps', 'RIR', 'Descanso', 'Progresión', 'Link MuscleWiki',
];

// Reglas de progresión, una por ejercicio (clave). Tipos del encargo, sección 5.2.
// El RIR nunca dispara la progresión (encargo, l.302): solo cuentan repeticiones.
// Condiciones cualitativas ("sin titubear", "limpias", "sin soltar") no se pueden
// medir: se evalúa la parte numérica y el aviso muestra el texto completo.
const REGLAS = {
  'equilibrio-en-un-pie': { tipo: 'manual' },
  'eversion-de-tobillo-en-polea': { tipo: 'manual' },
  'press-de-banca': { tipo: 'todas_las_series', objetivo: 10, incremento: 5, unidad: 'kg' },
  'press-inclinado-con-barra': { tipo: 'todas_las_series', objetivo: 12, incremento: 5, unidad: 'kg' },
  'press-militar-sentado-con-mancuernas': { tipo: 'todas_las_series', objetivo: 12, incremento: 5, unidad: 'lb' },
  'elevacion-lateral-lunes': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'lb' },
  'jalon-de-triceps-con-cuerda': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'kg' },
  plancha: { tipo: 'incremento_semanal_tiempo', incremento: 10, tope: 70 },
  'peso-muerto-rumano': { tipo: 'todas_las_series', objetivo: 10, incremento: 5, unidad: 'kg' },
  'hip-thrust-con-barra': { tipo: 'todas_las_series', objetivo: 12, incremento: 5, unidad: 'kg' },
  // "el disco más chico que acepte tu polea": la condición se evalúa; el nuevo peso lo decide el usuario.
  'curl-femoral-con-tobillera': { tipo: 'todas_las_series', objetivo: 15, incremento: null, unidad: 'kg' },
  'sentadilla-isometrica-en-pared': { tipo: 'incremento_semanal_tiempo', incremento: 10, tope: 60 },
  'abduccion-de-cadera-con-tobillera': { tipo: 'todas_las_series', objetivo: 20, incremento: null, unidad: 'kg' },
  'elevacion-de-talon-a-un-pie': {
    tipo: 'cambio_de_implemento', objetivo: 15, cambio: 'Mancuerna de 20 lb', peso: 20, unidad: 'lb', pesoPorLado: false,
  },
  'dominadas-asistidas-con-banda': { tipo: 'cambio_de_implemento', objetivo: 6, cambio: 'Banda roja' },
  'jalon-al-pecho': { tipo: 'todas_las_series', objetivo: 12, incremento: 5, unidad: 'kg' },
  'remo-landmine': { tipo: 'todas_las_series', objetivo: 12, incremento: 5, unidad: 'kg' },
  'face-pull-con-cuerda': { tipo: 'todas_las_series', objetivo: 20, incremento: 5, unidad: 'kg' },
  'encogimiento-de-hombros': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'kg' },
  'curl-martillo': { tipo: 'todas_las_series', objetivo: 12, incremento: 5, unidad: 'lb' },
  'sentadilla-a-banco-postura-ancha': {
    tipo: 'todas_las_series_dos_semanas',
    objetivo: 10,
    opciones: [
      { etiqueta: 'Subí 5 kg', incremento: 5, unidad: 'kg' },
      { etiqueta: 'Bajé el banco', cambio: 'Banco más bajo' },
    ],
  },
  'step-up-lateral-al-banco': {
    tipo: 'cambio_de_implemento', objetivo: 12, cambio: 'Mancuernas de 20 lb', peso: 20, unidad: 'lb', pesoPorLado: true,
  },
  'pull-through-con-cuerda': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'kg' },
  'elevacion-de-talon-a-un-pie-con-mancuerna': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'lb' },
  'rueda-abdominal': { tipo: 'cambio_de_implemento', objetivo: 10, cambio: 'Recorrido más largo' },
  'elevacion-de-rodillas-colgado': { tipo: 'cambio_de_implemento', objetivo: 12, cambio: 'Piernas rectas' },
  'press-inclinado-con-mancuernas': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'lb' },
  'remo-a-un-brazo-con-mancuerna': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'lb' },
  'elevacion-lateral-viernes': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'lb' },
  'vuelo-posterior-con-mancuernas': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'lb' },
  'extension-de-triceps-sobre-la-cabeza-con-cuerda': { tipo: 'todas_las_series', objetivo: 15, incremento: 5, unidad: 'kg' },
  'farmers-carry': { tipo: 'todas_las_series', objetivo: 40, incremento: 5, unidad: 'lb' },
  'costal-de-boxeo': { tipo: 'manual' },
  'ir-por-el-garrafon-de-agua': { tipo: 'manual' },
  'paseo-con-los-perros': { tipo: 'manual' },
};

function leerHoja() {
  const lineas = readFileSync(ENTRADA, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
  const encabezado = lineas[0].split('\t');
  if (encabezado.join('|') !== COLUMNAS.join('|')) {
    throw new Error(`Encabezado inesperado en ${ENTRADA}: ${encabezado.join(' | ')}`);
  }
  return lineas.slice(1).map((linea, i) => {
    const celdas = linea.split('\t');
    if (celdas.length !== COLUMNAS.length) {
      throw new Error(`Renglón ${i + 2}: ${celdas.length} columnas, se esperaban ${COLUMNAS.length}`);
    }
    return Object.fromEntries(COLUMNAS.map((c, j) => [c, celdas[j]]));
  });
}

function convertir(fila) {
  const nombreDia = fila['Día'].split(' - ')[0];
  const diaSemana = DIAS[nombreDia];
  if (!diaSemana) throw new Error(`Día no reconocido: "${fila['Día']}"`);
  const orden = parsearEntero(fila.Orden);
  const liga = fila['Link MuscleWiki'].trim();
  return {
    id: diaSemana * 100 + orden,
    dia: fila['Día'],
    diaSemana,
    orden,
    clave: null, // se asigna después, viendo toda la semana
    grupo: fila.Grupo,
    ejercicio: fila.Ejercicio,
    equipo: fila.Equipo,
    accesorioPolea: nulo(fila['Accesorio polea']),
    pesoTexto: fila['Peso sugerido'],
    ...parsearPeso(fila['Peso sugerido']),
    series: parsearEntero(fila.Series),
    repsTexto: fila.Reps,
    ...parsearReps(fila.Reps),
    rir: parsearRir(fila.RIR),
    descansoTexto: fila.Descanso,
    descansoSeg: parsearDescanso(fila.Descanso),
    progresionTexto: fila['Progresión'],
    progresionRegla: null,
    liga: liga === 'SIN LIGA' ? null : liga,
  };
}

// Un mismo ejercicio comparte historial en toda la semana (misma clave) solo si
// su prescripción es idéntica; si cambia (p. ej. elevación lateral lunes y
// viernes), cada día lleva su propia clave.
function asignarClaves(renglones) {
  const prescripcion = (r) => {
    const { id, dia, diaSemana, orden, clave, ...resto } = r;
    return JSON.stringify(resto);
  };
  const porNombre = Map.groupBy(renglones, (r) => slug(r.ejercicio));
  for (const [nombre, grupo] of porNombre) {
    const distintas = new Set(grupo.map(prescripcion));
    for (const r of grupo) {
      r.clave = distintas.size === 1 ? nombre : `${nombre}-${slug(r.dia.split(' - ')[0])}`;
    }
  }
}

function asignarReglas(renglones) {
  const usadas = new Set();
  for (const r of renglones) {
    const regla = REGLAS[r.clave];
    if (!regla) throw new Error(`Falta regla de progresión para "${r.clave}" (${r.dia} #${r.orden})`);
    r.progresionRegla = regla;
    usadas.add(r.clave);
  }
  const sobrantes = Object.keys(REGLAS).filter((c) => !usadas.has(c));
  if (sobrantes.length) throw new Error(`Reglas sin ejercicio: ${sobrantes.join(', ')}`);
}

function main() {
  const renglones = leerHoja().map(convertir);
  asignarClaves(renglones);
  asignarReglas(renglones);

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
