// Frases del descanso (tanda 1): listas propias y frases con tu avance.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRASES_EN, FRASES_ES, frasesDeAvance, mezclarFrases } from '../docs/js/logica/frases.js';

test('las dos listas tienen frases cortas y sin repetir', () => {
  for (const [nombre, lista] of [['ES', FRASES_ES], ['EN', FRASES_EN]]) {
    assert.ok(lista.length >= 20, nombre);
    assert.equal(new Set(lista).size, lista.length, `${nombre} sin repetidas`);
    for (const frase of lista) assert.ok(frase.length <= 70, `${nombre}: "${frase}" es larga`);
  }
});

test('avance: solo cuando el peso subió, con semanas y unidad', () => {
  const frases = frasesDeAvance([
    { ejercicio: 'Press de banca', unidad: 'kg', primerPeso: 50, ultimoPeso: 60, semanas: 4 },
    { ejercicio: 'Curl martillo', unidad: 'lb', primerPeso: 30, ultimoPeso: 30, semanas: 2 },
    { ejercicio: 'Remo', unidad: 'kg', primerPeso: 20, ultimoPeso: 22.5, semanas: 1 },
  ]);
  assert.deepEqual(frases, [
    'Press de banca: hace 4 semanas 50 kg. Hoy 60 kg.',
    'Remo: hace 1 semana 20 kg. Hoy 22.5 kg.',
  ]);
});

test('constancia: entrenamientos y días de la semana', () => {
  assert.deepEqual(frasesDeAvance([], { entrenamientos: 12, diasSemana: 5, diasHechos: 3 }), [
    'Llevas 12 entrenamientos registrados.',
    'Esta semana: 3 de 5 días hechos.',
  ]);
  assert.deepEqual(frasesDeAvance([], { entrenamientos: 1 }), []);
});

test('mezcla: tu avance va primero y luego cada tres; nada se pierde', () => {
  const propias = ['A', 'B'];
  const mezcla = mezclarFrases(propias, () => 0.5);
  assert.equal(mezcla[0], 'A');
  assert.equal(mezcla[3], 'B');
  assert.equal(mezcla.length, FRASES_ES.length + FRASES_EN.length + propias.length);
  assert.deepEqual(new Set(mezcla), new Set([...FRASES_ES, ...FRASES_EN, ...propias]));
});
