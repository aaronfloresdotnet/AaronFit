// Composición corporal (tanda 2): % de grasa (Marina de EE. UU.), cintura entre
// estatura, contra qué medición se compara y cuándo tocan fotos.
// NO cubre si la fórmula acierta en una persona real: es una estimación.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cinturaEstatura, comparar, fotosPendientes, grasaMarina, medicionDeComparacion, serieDeCampo } from '../docs/js/logica/cuerpo.js';

const cerca = (real, esperado, tolerancia = 0.05) =>
  assert.ok(Math.abs(real - esperado) <= tolerancia, `${real} no está a ±${tolerancia} de ${esperado}`);

test('Marina, hombre: 180 cm, cintura 90, cuello 40 → 18.4 %', () => {
  cerca(grasaMarina({ formula: 'hombre', estatura: 180, cintura: 90, cuello: 40 }), 18.37);
});

test('Marina, mujer: usa la cadera; sin cadera no hay cálculo', () => {
  // 495 / (1.29579 − 0.35004·log10(75 + 100 − 34) + 0.221·log10(165)) − 450
  const esperado = 495 / (1.29579 - 0.35004 * Math.log10(141) + 0.221 * Math.log10(165)) - 450;
  cerca(grasaMarina({ formula: 'mujer', estatura: 165, cintura: 75, cuello: 34, cadera: 100 }), esperado, 1e-9);
  assert.equal(grasaMarina({ formula: 'mujer', estatura: 165, cintura: 75, cuello: 34, cadera: null }), null);
});

test('Marina: sin fórmula, sin estatura o con medidas imposibles no hay número', () => {
  assert.equal(grasaMarina({ formula: null, estatura: 180, cintura: 90, cuello: 40 }), null);
  assert.equal(grasaMarina({ formula: 'hombre', estatura: null, cintura: 90, cuello: 40 }), null);
  assert.equal(grasaMarina({ formula: 'hombre', estatura: 180, cintura: 40, cuello: 40 }), null);
  assert.equal(grasaMarina({ formula: 'hombre', estatura: 180, cintura: 90, cuello: null }), null);
});

test('cintura entre estatura', () => {
  assert.equal(cinturaEstatura(90, 180), 0.5);
  assert.equal(cinturaEstatura(null, 180), null);
});

const medida = (fecha, valores = {}, fotosTomadas = false) => ({ fecha, pesoCorporal: null, cintura: null, ...valores, fotosTomadas });

test('comparación: la más cercana a 4 semanas antes, con al menos 3 de diferencia', () => {
  const lista = [medida('2026-08-01'), medida('2026-08-29'), medida('2026-09-12'), medida('2026-09-26')];
  const ultima = lista.at(-1);
  assert.equal(medicionDeComparacion(lista, ultima).fecha, '2026-08-29'); // 28 días
  assert.equal(medicionDeComparacion([medida('2026-09-12'), ultima], ultima), null); // solo 14 días
  assert.equal(medicionDeComparacion([medida('2026-08-01'), ultima], ultima).fecha, '2026-08-01'); // 56 días: es la única
});

test('comparar: solo los campos medidos en las dos fechas', () => {
  const cambios = comparar(medida('2026-08-29', { pesoCorporal: 81.2, cintura: 92 }), medida('2026-09-26', { pesoCorporal: 80.5, cintura: null }));
  assert.deepEqual(cambios.map((c) => [c.campo, c.antes, c.ahora, c.cambio]), [['pesoCorporal', 81.2, 80.5, -0.7]]);
});

test('fotos: tocan a las 4 semanas, o si nunca se anotaron y ya hay medidas', () => {
  const lista = [medida('2026-08-29', {}, true), medida('2026-09-12')];
  assert.deepEqual(fotosPendientes(lista, '2026-09-25'), { toca: false, ultima: '2026-08-29', dias: 27 });
  assert.deepEqual(fotosPendientes(lista, '2026-09-26'), { toca: true, ultima: '2026-08-29', dias: 28 });
  assert.deepEqual(fotosPendientes([medida('2026-09-12')], '2026-09-13'), { toca: true, ultima: null, dias: null });
  assert.deepEqual(fotosPendientes([], '2026-09-13'), { toca: false, ultima: null, dias: null });
});

test('serie para graficar: en orden de fecha y sin los no medidos', () => {
  const lista = [medida('2026-09-26', { cintura: 90 }), medida('2026-09-12', { cintura: null }), medida('2026-08-29', { cintura: 91.5 })];
  assert.deepEqual(serieDeCampo(lista, 'cintura'), [{ fecha: '2026-08-29', valor: 91.5 }, { fecha: '2026-09-26', valor: 90 }]);
});
