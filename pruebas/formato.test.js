// Formatos nuevos de la tanda 2: cifras fijas para estimaciones y cambios con signo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cambio, decimal, serieHablada } from '../docs/js/logica/formato.js';

test('cifras fijas', () => {
  assert.equal(decimal(18.37), '18.4');
  assert.equal(decimal(0.5, 2), '0.50');
  assert.equal(decimal(null), '—');
});

test('cambio con signo (el menos es el signo tipográfico)', () => {
  assert.equal(cambio(1.5), '+1.5');
  assert.equal(cambio(-0.7), '−0.7');
  assert.equal(cambio(0), '0');
  assert.equal(cambio(undefined), '—');
});

test('serie para decirla en voz alta', () => {
  assert.equal(serieHablada({ peso: 55, unidadPeso: 'kg', pesoPorLado: false, valor: 8 }, 'reps'), '55 kilos por 8');
  assert.equal(serieHablada({ peso: 35, unidadPeso: 'lb', pesoPorLado: true, valor: 12 }, 'reps'), '35 libras cada una por 12');
  assert.equal(serieHablada({ peso: null, unidadPeso: 'corporal', pesoPorLado: false, valor: 40 }, 'segundos'), '40 segundos');
  assert.equal(serieHablada({ peso: null, unidadPeso: 'corporal', pesoPorLado: false, valor: 10 }, 'reps'), '10 repeticiones');
  assert.equal(serieHablada({ peso: null, unidadPeso: 'corporal', pesoPorLado: false, valor: 120 }, 'minutos'), '2 minutos');
  assert.equal(serieHablada({ peso: 40, unidadPeso: 'lb', pesoPorLado: true, valor: 40 }, 'metros'), '40 libras cada una, 40 metros');
});
