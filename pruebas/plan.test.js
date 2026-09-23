// Una rutina completa en TSV (tanda 4): leerla (también como la devuelve la IA),
// convertirla con los mismos lectores que la semilla, validarla renglón por
// renglón, escribirla de vuelta y compararla con la actual.
// NO cubre si la IA sigue el formato: eso lo decide la validación al importar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import {
  COLUMNAS_RUTINA, diaDeTexto, diasDelPlan, diferencias, esDiaDeCaminata, leerTSV, planDeSemana, renglonesDePlan,
  renglonesDeSemana, rutinaATSV,
} from '../docs/js/logica/plan.js';

const HOJA = readFileSync(new URL('../fuente/rutina.tsv', import.meta.url), 'utf8');
const ENCABEZADO = COLUMNAS_RUTINA.join('\t');
const fila = (...celdas) => celdas.join('\t');

// Un plan de 3 días (lunes, miércoles y viernes) más caminata el sábado.
const TRES_DIAS = [
  ENCABEZADO,
  fila('LUNES - Fuerza A', '1', 'Pecho', 'Press de banca', 'Barra + banco plano + postes J', '-', '50 kg', '4', '6-8', '2', '2-3 min', 'Cuando hagas 8/8/8/8, sube 5 kg', 'https://musclewiki.com/exercise/barbell-bench-press', 'todas 8 +5 kg'),
  fila('LUNES - Fuerza A', '2', 'Espalda', 'Remo con barra', 'Barra', '-', '40 kg', '3', '8-10', '2', '2 min', 'Cuando hagas 10/10/10, sube 5 kg', 'https://ejemplo.com/inventada', 'todas 10 +5 kg'),
  fila('MIERCOLES - Fuerza B', '1', 'Cuádriceps', 'Sentadilla con barra', 'Barra + postes J', '-', '40 kg', '3', '8-10', '2', '3 min', 'Cuando hagas 10/10/10, sube 5 kg', 'SIN LIGA', 'todas 10 +5 kg'),
  fila('VIERNES - Fuerza C', '1', 'Hombro', 'Elevación lateral', 'Mancuernas', '-', '15 lb cada una', '3', '12-15', '-', '60 s', 'Cuando hagas 15/15/15, sube 10 lb', 'SIN LIGA', 'todas 15 +10 lb'),
  fila('SABADO - Caminata', '1', 'Caminata', 'Paseo con los perros', 'Peso corporal', '-', 'Peso corporal', '1', '30 min', '-', '-', 'Caminar 30 minutos', 'SIN LIGA', 'manual'),
].join('\n');

test('tu hoja es exactamente la rutina de la semilla, con la regla en la columna 14', () => {
  assert.equal(rutinaATSV(RUTINA), HOJA.trimEnd());
  const { filas, errores } = leerTSV(HOJA);
  assert.deepEqual(errores, []);
  const { renglones, errores: errores2 } = renglonesDePlan(filas, { plan: 1 });
  assert.deepEqual(errores2, []);
  assert.equal(JSON.stringify(renglones), JSON.stringify(RUTINA)); // mismas llaves, en el mismo orden
});

test('leer lo que devuelve la IA: bloque ```tsv, texto alrededor y saltos de Windows', () => {
  const respuesta = `Aquí está tu rutina:\r\n\r\n\`\`\`tsv\r\n${TRES_DIAS.replace(/\n/g, '\r\n')}\r\n\`\`\`\r\nSuerte.`;
  const { filas, errores } = leerTSV(respuesta);
  assert.deepEqual(errores, []);
  assert.equal(filas.length, 5);
  const sinBloque = leerTSV(`Te propongo esto:\n${TRES_DIAS}\nAvísame.`);
  assert.equal(sinBloque.filas.length, 5);
  assert.match(leerTSV('hola').errores[0], /No encontré el encabezado/);
  assert.match(leerTSV(TRES_DIAS.replace('Regla', 'Otra')).errores[0], /encabezado debe ser/);
  const corta = leerTSV(`${ENCABEZADO}\n${fila('LUNES - A', '1', 'Pecho')}`);
  assert.match(corta.errores[0], /Renglón 2: tiene 3 columnas/);
});

test('un plan nuevo: ids propios, número de plan, claves por nombre y ligas desconocidas sin video', () => {
  const { renglones, errores, avisos } = renglonesDePlan(leerTSV(TRES_DIAS).filas, { plan: 2, ligasValidas: new Set(['https://musclewiki.com/exercise/barbell-bench-press']) });
  assert.deepEqual(errores, []);
  assert.deepEqual(renglones.map((r) => [r.id, r.plan, r.clave]), [
    [2101, 2, 'press-de-banca'], // misma clave que en tu rutina: el historial sigue
    [2102, 2, 'remo-con-barra'],
    [2301, 2, 'sentadilla-con-barra'],
    [2501, 2, 'elevacion-lateral'],
    [2601, 2, 'paseo-con-los-perros'],
  ]);
  assert.equal(renglones[3].pesoPorLado, true);
  assert.equal(renglones[2].descansoSeg, 180);
  assert.equal(renglones[1].liga, null);
  assert.match(avisos[0], /Renglón 3 \(Remo con barra\): la liga no es de la lista/);
  assert.deepEqual(diasDelPlan(renglones), { fuerza: [1, 3, 5], caminata: [6] });
});

test('errores con su renglón; si hay uno, no entra nada', () => {
  const lineas = TRES_DIAS.split('\n');
  lineas[2] = lineas[2].replace('40 kg', 'pesado');
  lineas[3] = lineas[3].replace('todas 10 +5 kg', 'sube cuando puedas');
  lineas[4] = lineas[4].replace('todas 15 +10 lb', 'todas 15 +5 kg');
  lineas.push(lineas[1]); // otro lunes con orden 1
  const { renglones, errores } = renglonesDePlan(leerTSV(lineas.join('\n')).filas, { plan: 2 });
  assert.deepEqual(renglones, []);
  assert.match(errores[0], /^Renglón 3: Peso no reconocido/);
  assert.match(errores[1], /^Renglón 4: Regla no reconocida/);
  assert.match(errores[2], /^Renglón 5: la regla sube en kg pero el peso es en lb/);
  assert.match(errores[3], /LUNES - Fuerza A: hay dos ejercicios con orden 1/);
  const soloCaminata = leerTSV([ENCABEZADO, TRES_DIAS.split('\n')[5]].join('\n')).filas;
  assert.match(renglonesDePlan(soloCaminata, { plan: 2 }).errores[0], /ningún día de fuerza/);
});

test('días: con o sin acentos; caminata si el nombre lo dice; tu rutina es de 5 días de fuerza', () => {
  assert.equal(diaDeTexto('MIÉRCOLES - Jalón'), 3);
  assert.equal(diaDeTexto('Miercoles - Jalón'), 3);
  assert.equal(diaDeTexto('FUNDAY - x'), null);
  assert.equal(esDiaDeCaminata('SÁBADO - Caminata'), true);
  assert.equal(esDiaDeCaminata('LUNES - Empuje A'), false);
  assert.deepEqual(diasDelPlan(RUTINA), { fuerza: [1, 2, 3, 4, 5], caminata: [6, 7] });
});

test('qué plan rige cada semana: el más nuevo que ya empezó', () => {
  const planes = [{ numero: 1, desde: null }, { numero: 2, desde: '2026-W41' }];
  assert.equal(planDeSemana(null, '2026-W39'), 1);
  assert.equal(planDeSemana(planes, '2026-W40'), 1);
  assert.equal(planDeSemana(planes, '2026-W41'), 2);
  const nuevo = renglonesDePlan(leerTSV(TRES_DIAS).filas, { plan: 2 }).renglones;
  const todo = [...RUTINA, ...nuevo];
  assert.equal(renglonesDeSemana(todo, planes, '2026-W40').length, 43);
  assert.equal(renglonesDeSemana(todo, planes, '2026-W41').length, 5);
});

test('qué cambia: nuevos, los que salen, los que cambian (con qué) y los iguales', () => {
  const nuevo = renglonesDePlan(leerTSV(TRES_DIAS).filas, { plan: 2 }).renglones;
  const d = diferencias(RUTINA, nuevo);
  assert.deepEqual(d.nuevos, ['Remo con barra', 'Sentadilla con barra', 'Elevación lateral']);
  assert.ok(d.salen.includes('Plancha'));
  const banca = d.cambian.find((c) => c.ejercicio === 'Press de banca');
  assert.deepEqual(banca.cambios, [
    'series: 3 → 4', 'reps: 8-10 → 6-8', 'RIR: 3 → 2', 'progresión: Cuando hagas 10/10/10 con 3 RIR, sube 5 kg → Cuando hagas 8/8/8/8, sube 5 kg', 'regla de progresión',
  ]);
  const paseo = d.cambian.find((c) => c.ejercicio === 'Paseo con los perros');
  assert.deepEqual(paseo.cambios, [
    'días: DOMINGO → SABADO', 'peso: - → Peso corporal', 'equipo: Ninguno → Peso corporal',
    'progresión: Ya lo haces; no cambiar nada → Caminar 30 minutos',
  ]);
  assert.deepEqual(diferencias(RUTINA, RUTINA).cambian, []); // nada cambia contra sí misma
  assert.equal(diferencias(RUTINA, RUTINA).iguales.length, 35);
});
