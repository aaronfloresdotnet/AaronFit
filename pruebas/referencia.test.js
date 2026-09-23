// Precarga (encargo 5.1, decisión 4): el peso precargado es el de la última
// serie completada y no el de la semilla cuando ya hay historial.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import { porNumero, precargar, seriesDeUltimaSesion } from '../docs/js/logica/referencia.js';

const ejercicio = (id) => RUTINA.find((r) => r.id === id);
const banca = ejercicio(103); // 50 kg, 3 series de 8-10
const plancha = ejercicio(108); // 3 × 40 s
const costal = ejercicio(509); // 3 × 2 min

let reloj = 0;
const hora = () => new Date(Date.UTC(2026, 8, 21, 12, 0, reloj++)).toISOString();
const serie = (sesionId, numeroSerie, peso, reps, extra = {}) => ({
  sesionId, rutinaId: 103, numeroSerie, peso, unidadPeso: 'kg', repsHechas: reps,
  segundos: null, metros: null, lado: null, completada: true, hora: hora(), ...extra,
});
const pesos = (lista) => lista.map((p) => p.peso);
const valores = (lista) => lista.map((p) => p.valor);

test('sin historial: el peso sugerido de la semilla y repsMin', () => {
  const p = precargar({ ejercicio: banca });
  assert.deepEqual(pesos(p), [50, 50, 50]);
  assert.deepEqual(valores(p), [8, 8, 8]);
});

test('con historial manda la última serie completada, no la semilla (ejemplo l.286: lo subió a 60)', () => {
  const historial = [serie(1, 1, 60, 10), serie(1, 2, 60, 9), serie(1, 3, 60, 8)];
  const p = precargar({ ejercicio: banca, historial });
  assert.deepEqual(pesos(p), [60, 60, 60]);
  assert.deepEqual(valores(p), [10, 9, 8]); // cada serie con las reps de la vez anterior
});

test('se usa la sesión más reciente aunque haya otras', () => {
  const historial = [serie(1, 1, 55, 10), serie(1, 2, 55, 10), serie(2, 1, 60, 9), serie(2, 2, 60, 8)];
  assert.deepEqual(pesos(precargar({ ejercicio: banca, historial })), [60, 60, 60]);
});

test('una serie saltada (completada: false) no cuenta', () => {
  const historial = [serie(1, 1, 60, 10), serie(2, 1, 999, 0, { completada: false })];
  assert.deepEqual(pesos(precargar({ ejercicio: banca, historial })), [60, 60, 60]);
});

test('si la vez pasada hizo menos series, las que faltan copian su última serie', () => {
  const historial = [serie(1, 1, 60, 10), serie(1, 2, 60, 7)];
  assert.deepEqual(valores(precargar({ ejercicio: banca, historial })), [10, 7, 7]);
});

test('hoy: el peso nuevo de la serie 1 se arrastra a las siguientes', () => {
  const historial = [serie(1, 1, 60, 10), serie(1, 2, 60, 9), serie(1, 3, 60, 8)];
  const hoy = [serie(2, 1, 65, 8)];
  const p = precargar({ ejercicio: banca, historial, hoy });
  assert.deepEqual(pesos(p).slice(1), [65, 65]);
  assert.deepEqual(valores(p).slice(1), [9, 8]);
});

test('tras aceptar un aviso: el peso nuevo y repsMin', () => {
  const historial = [serie(1, 1, 60, 10), serie(1, 2, 60, 10), serie(1, 3, 60, 10)];
  const referencia = { hora: hora(), semanaISO: '2026-W39', peso: 65, unidadPeso: 'kg' };
  const p = precargar({ ejercicio: banca, historial, referencia });
  assert.deepEqual(pesos(p), [65, 65, 65]);
  assert.deepEqual(valores(p), [8, 8, 8]);
});

test('un aviso aceptado ANTES de la última sesión ya no manda', () => {
  const referencia = { hora: hora(), semanaISO: '2026-W39', peso: 65, unidadPeso: 'kg' };
  const historial = [serie(2, 1, 62.5, 9)];
  assert.deepEqual(pesos(precargar({ ejercicio: banca, historial, referencia })), [62.5, 62.5, 62.5]);
});

test('aviso de tiempo aceptado: precarga los segundos nuevos', () => {
  const referencia = { hora: hora(), semanaISO: '2026-W39', valor: 50 };
  const p = precargar({ ejercicio: plancha, referencia });
  assert.deepEqual(valores(p), [50, 50, 50]);
  assert.deepEqual(pesos(p), [null, null, null]);
});

test('los minutos se precargan en segundos (2 min → 120)', () => {
  assert.deepEqual(valores(precargar({ ejercicio: costal })), [120, 120, 120]);
});

test('por lado: cuenta el peor de los dos lados', () => {
  const izq = serie(1, 1, 5, 15, { lado: 'izq' });
  const der = serie(1, 1, 5, 13, { lado: 'der' });
  assert.equal(porNumero([izq, der], 'reps').get(1).valor, 13);
  assert.equal(seriesDeUltimaSesion([izq, der]).length, 2);
});
