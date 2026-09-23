// Tu equipo y la calculadora de discos (tanda 3), con tu inventario real:
// barra de 20 kg, un par de discos de 2.5, 5, 10, 15 y 20 kg (2 pulgadas, barra
// y polea) y discos de mancuerna en lb (1 pulgada): 4 de 15, 6 de 10 y 4 de 5.
// NO cubre el peso del mango de las mancuernas: falta saberlo; se prueba con 0 y 5.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import { calentamiento, cargar, EQUIPO_INICIAL, implementoDe, normalizarEquipo, pasoDe, UNIDAD_DE } from '../docs/js/logica/equipo.js';

const equipo = normalizarEquipo(null);
const conMango = (maneral) => ({ ...equipo, maneral });
const carga = (implemento, peso, e = equipo) => cargar({ implemento, peso, equipo: e });

test('cada renglón de tu rutina usa el inventario de su unidad: kg en barra y polea, lb en mancuernas', () => {
  const conteo = {};
  for (const r of RUTINA) {
    const implemento = implementoDe(r);
    conteo[implemento] = (conteo[implemento] ?? 0) + 1;
    if (implemento) assert.equal(r.unidadPeso, UNIDAD_DE[implemento], `${r.id} ${r.ejercicio}`);
    else assert.equal(r.unidadPeso, 'corporal', `${r.id} ${r.ejercicio}`);
  }
  assert.deepEqual(conteo, { null: 15, polea: 12, barra: 6, mancuernas: 7, landmine: 1, mancuerna: 2 });
});

test('barra: el peso incluye la barra; el resto se reparte igual por lado', () => {
  assert.deepEqual(carga('barra', 60).discos, [20]); // tu ejemplo: 40 kg de discos + 20 de barra
  assert.deepEqual(carga('barra', 55).discos, [15, 2.5]);
  assert.deepEqual(carga('barra', 70).discos, [20, 5]); // a igual número de discos, los más grandes
  assert.deepEqual(carga('barra', 125).discos, [20, 15, 10, 5, 2.5]); // todos tus discos
  assert.deepEqual(carga('barra', 20), { implemento: 'barra', peso: 20, estado: 'exacto', discos: [] });
  assert.deepEqual(carga('barra', 52.5), { implemento: 'barra', peso: 52.5, estado: 'aproximado', cercanos: [50, 55] });
  assert.deepEqual(carga('barra', 130).cercanos, [125]);
  assert.deepEqual(carga('barra', 15), { implemento: 'barra', peso: 15, estado: 'imposible', minimo: 20 });
});

test('polea y landmine: los discos van juntos y se pueden usar los dos del par', () => {
  assert.deepEqual(carga('polea', 12), { implemento: 'polea', peso: 12, estado: 'aproximado', cercanos: [10, 12.5] });
  assert.deepEqual(carga('polea', 12.5).discos, [10, 2.5]);
  assert.deepEqual(carga('polea', 2.5).discos, [2.5]);
  assert.deepEqual(carga('polea', 105).discos, [20, 20, 15, 15, 10, 10, 5, 5, 2.5, 2.5]);
  assert.deepEqual(carga('landmine', 20).discos, [20]); // en la hoja, «20 kg + barra»: la barra no se cuenta
  assert.equal(carga('polea', 20, { ...equipo, polea: 5 }).discos.join(), '15'); // si el carro pesa algo, se descuenta
});

test('mancuernas: sin el peso del mango no se calcula; con mango, extremos iguales y dos mancuernas a la vez', () => {
  assert.equal(carga('mancuernas', 35).estado, 'falta-mango');
  assert.deepEqual(carga('mancuernas', 35, conMango(5)).discos, [15]); // 5 + 15 + 15
  assert.deepEqual(carga('mancuernas', 30, conMango(5)).cercanos, [25, 35]); // con discos de 5 lb el salto es de 10
  assert.deepEqual(carga('mancuernas', 65, conMango(5)).discos, [15, 10, 5]); // 30 lb por extremo sin 8 discos de 15
  assert.equal(carga('mancuernas', 55, conMango(5)).sobreTope, true); // tu tope real es 50 lb
  assert.deepEqual(carga('mancuerna', 40, conMango(0)).discos, [15, 5]); // una sola: le tocan más discos
  assert.deepEqual(carga('mancuerna', 40, conMango(5)).cercanos, [35, 45]);
});

test('paso del botón +: el salto más chico que se puede cargar', () => {
  assert.deepEqual(['barra', 'polea', 'landmine', 'mancuernas', 'mancuerna', null].map((i) => pasoDe(i, equipo)), [5, 2.5, 2.5, 10, 10, null]);
});

test('calentamiento: barra sola × 10, ~50 % × 5 y ~75 % × 3, hacia abajo y a pesos que sí se cargan', () => {
  const resumen = (peso) => calentamiento({ peso, equipo }).map((s) => `${s.peso}×${s.reps}:${s.discos.join('+')}`);
  assert.deepEqual(resumen(50), ['20×10:', '25×5:2.5', '35×3:5+2.5']);
  assert.deepEqual(resumen(60), ['20×10:', '30×5:5', '45×3:10+2.5']);
  assert.deepEqual(resumen(40), ['20×10:', '30×3:5']); // el 50 % sería la barra sola: no se repite
  assert.deepEqual(resumen(25), ['20×10:']);
  assert.deepEqual(resumen(20), []); // la serie ya es la barra sola
});

test('tu equipo guardado se completa con lo inicial y descarta valores rotos', () => {
  assert.deepEqual(normalizarEquipo(null).discosKg, EQUIPO_INICIAL.discosKg);
  const editado = normalizarEquipo({ maneral: 4.5, barra: -3, discosLb: [{ peso: 2.5, cuantos: 4 }, { peso: 'x', cuantos: 2 }] });
  assert.equal(editado.maneral, 4.5);
  assert.equal(editado.barra, 20);
  assert.deepEqual(editado.discosLb, [{ peso: 2.5, cuantos: 4 }]);
  assert.equal(editado.discosKg.length, 5);
});
