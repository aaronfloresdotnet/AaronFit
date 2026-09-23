// Eje Y de las gráficas (tanda 2): marcas redondas que cubren todos los valores.
// NO cubre cómo se dibuja: eso se revisó en el navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { marcasRedondas } from '../docs/js/logica/escala.js';

test('pasos de 1, 2, 2.5 o 5 por potencia de 10, y el eje cubre todo', () => {
  assert.deepEqual(marcasRedondas(50, 70.8), { desde: 50, hasta: 80, paso: 10, marcas: [50, 60, 70, 80] });
  assert.deepEqual(marcasRedondas(40, 50), { desde: 40, hasta: 50, paso: 5, marcas: [40, 45, 50] });
  assert.deepEqual(marcasRedondas(79.2, 81.6).marcas, [79, 80, 81, 82]);
  assert.deepEqual(marcasRedondas(0.46, 0.52).marcas, [0.46, 0.48, 0.5, 0.52]);
  for (const [min, max] of [[3, 997], [0.1, 0.13], [12.5, 13], [1800, 2400]]) {
    const { desde, hasta, marcas } = marcasRedondas(min, max);
    assert.ok(desde <= min && hasta >= max, `${min}–${max}`);
    assert.ok(marcas.length >= 2 && marcas.length <= 6, `${min}–${max}: ${marcas.length} marcas`);
  }
});

test('un solo valor: el eje se abre alrededor; sin valores, un eje de 0 a 1', () => {
  const { desde, hasta } = marcasRedondas(30, 30);
  assert.ok(desde < 30 && hasta > 30);
  assert.deepEqual(marcasRedondas(Infinity, -Infinity).marcas, [0, 1]);
});
