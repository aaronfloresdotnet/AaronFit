// Formatos nuevos de la tanda 2: cifras fijas para estimaciones y cambios con signo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cambio, decimal } from '../docs/js/logica/formato.js';

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
