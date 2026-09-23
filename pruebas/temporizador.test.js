// Cronómetro de serie (tanda 1): fases, momento y lo que se anota al terminar o al parar.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fasesDeSerie, momento, PAUSA_CAMBIO_LADO, resultadoDeSerie, tiempos } from '../docs/js/logica/temporizador.js';

const plancha = fasesDeSerie({ segundos: 40, porLado: false });
const equilibrio = fasesDeSerie({ segundos: 30, porLado: true });

test('sin lado: una fase; por lado: izquierdo, cambio y derecho', () => {
  assert.equal(plancha.length, 1);
  assert.deepEqual(equilibrio.map((f) => [f.lado, f.segundos, f.pausa]), [['izq', 30, false], [null, PAUSA_CAMBIO_LADO, true], ['der', 30, false]]);
  assert.deepEqual(tiempos(equilibrio), { inicios: [0, 30, 35], total: 65 });
});

test('momento: en qué fase va y cuánto le queda', () => {
  assert.deepEqual(momento(plancha, 10), { indice: 0, restante: 30, terminado: false });
  assert.deepEqual(momento(equilibrio, 31), { indice: 1, restante: 4, terminado: false });
  assert.deepEqual(momento(equilibrio, 50), { indice: 2, restante: 15, terminado: false });
  assert.equal(momento(equilibrio, 65).terminado, true);
});

test('completo: se anota el tiempo objetivo', () => {
  assert.deepEqual(resultadoDeSerie(plancha, 40.4), { valor: 40, lados: null, completo: true });
  assert.deepEqual(resultadoDeSerie(equilibrio, 66), { valor: 30, lados: null, completo: true });
});

test('parado antes: se anota lo que se aguantó, nunca más que el objetivo', () => {
  assert.deepEqual(resultadoDeSerie(plancha, 32.9), { valor: 32, lados: null, completo: false });
  assert.deepEqual(resultadoDeSerie(equilibrio, 20), { valor: 20, lados: null, completo: false });
  assert.deepEqual(resultadoDeSerie(equilibrio, 32), { valor: null, lados: { izq: 30, der: 0 }, completo: false });
  assert.deepEqual(resultadoDeSerie(equilibrio, 50), { valor: null, lados: { izq: 30, der: 15 }, completo: false });
});
