// Interpretación de los textos de la hoja: cada formato conocido, y error
// (no adivinanza) ante uno desconocido.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nulo, parsearDescanso, parsearPeso, parsearReps, parsearRir, slug } from '../docs/js/logica/parseo.js';

test('repeticiones, segundos, metros y minutos, con y sin "por lado"', () => {
  assert.deepEqual(parsearReps('8-10'), { repsMin: 8, repsMax: 10, tipoMedida: 'reps', porLado: false });
  assert.deepEqual(parsearReps('15'), { repsMin: 15, repsMax: 15, tipoMedida: 'reps', porLado: false });
  assert.deepEqual(parsearReps('30 s por pie'), { repsMin: 30, repsMax: 30, tipoMedida: 'segundos', porLado: true });
  assert.deepEqual(parsearReps('12-15 por brazo'), { repsMin: 12, repsMax: 15, tipoMedida: 'reps', porLado: true });
  assert.deepEqual(parsearReps('30-45 s'), { repsMin: 30, repsMax: 45, tipoMedida: 'segundos', porLado: false });
  assert.deepEqual(parsearReps('40 m'), { repsMin: 40, repsMax: 40, tipoMedida: 'metros', porLado: false });
  assert.deepEqual(parsearReps('2 min'), { repsMin: 2, repsMax: 2, tipoMedida: 'minutos', porLado: false });
  assert.throws(() => parsearReps('al fallo'), /no reconocidas/);
});

test('pesos: número y unidad, por mancuerna, más barra, barra sola, banda y corporal', () => {
  assert.deepEqual(parsearPeso('50 kg'), { pesoSugerido: 50, unidadPeso: 'kg', pesoPorLado: false, pesoNota: null });
  assert.deepEqual(parsearPeso('35 lb cada una'), { pesoSugerido: 35, unidadPeso: 'lb', pesoPorLado: true, pesoNota: null });
  assert.deepEqual(parsearPeso('2.5 kg'), { pesoSugerido: 2.5, unidadPeso: 'kg', pesoPorLado: false, pesoNota: null });
  assert.deepEqual(parsearPeso('20 kg + barra'), { pesoSugerido: 20, unidadPeso: 'kg', pesoPorLado: false, pesoNota: '+ barra' });
  assert.deepEqual(parsearPeso('Barra sola 20 kg'), { pesoSugerido: 20, unidadPeso: 'kg', pesoPorLado: false, pesoNota: null });
  assert.deepEqual(parsearPeso('Banda negra 25-65 lb'), {
    pesoSugerido: null, unidadPeso: 'corporal', pesoPorLado: false, pesoNota: 'Banda negra 25-65 lb',
  });
  assert.deepEqual(parsearPeso('Peso corporal'), { pesoSugerido: null, unidadPeso: 'corporal', pesoPorLado: false, pesoNota: null });
  assert.throws(() => parsearPeso('pesado'), /no reconocido/);
});

test('descansos del encargo 5.6 y guion como "sin cronómetro"', () => {
  assert.equal(parsearDescanso('2-3 min'), 150);
  assert.equal(parsearDescanso('2 min'), 120);
  assert.equal(parsearDescanso('90 s'), 90);
  assert.equal(parsearDescanso('60 s'), 60);
  assert.equal(parsearDescanso('0'), 0);
  assert.equal(parsearDescanso('-'), 0);
  assert.throws(() => parsearDescanso('3 min'), /no reconocido/);
});

test('guion es nulo; RIR; slug sin acentos ni apóstrofos', () => {
  assert.equal(nulo('-'), null);
  assert.equal(nulo('Cuerda'), 'Cuerda');
  assert.equal(parsearRir('-'), null);
  assert.equal(parsearRir('3'), 3);
  assert.equal(slug("Farmer's carry"), 'farmers-carry');
  assert.equal(slug('Eversión de tobillo en polea'), 'eversion-de-tobillo-en-polea');
});
