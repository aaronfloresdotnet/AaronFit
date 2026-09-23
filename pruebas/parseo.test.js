// Interpretación de los textos de la hoja: cada formato conocido, y error
// (no adivinanza) ante uno desconocido.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import { nulo, parsearDescanso, parsearPeso, parsearRegla, parsearReps, parsearRir, reglaATexto, slug } from '../docs/js/logica/parseo.js';

test('repeticiones, segundos, metros y minutos, con y sin "por lado"', () => {
  assert.deepEqual(parsearReps('8-10'), { repsMin: 8, repsMax: 10, tipoMedida: 'reps', porLado: false });
  assert.deepEqual(parsearReps('15'), { repsMin: 15, repsMax: 15, tipoMedida: 'reps', porLado: false });
  assert.deepEqual(parsearReps('30 s por pie'), { repsMin: 30, repsMax: 30, tipoMedida: 'segundos', porLado: true });
  assert.deepEqual(parsearReps('12-15 por brazo'), { repsMin: 12, repsMax: 15, tipoMedida: 'reps', porLado: true });
  assert.deepEqual(parsearReps('30-45 s'), { repsMin: 30, repsMax: 45, tipoMedida: 'segundos', porLado: false });
  assert.deepEqual(parsearReps('40 m'), { repsMin: 40, repsMax: 40, tipoMedida: 'metros', porLado: false });
  assert.deepEqual(parsearReps('2 min'), { repsMin: 2, repsMax: 2, tipoMedida: 'minutos', porLado: false });
  assert.deepEqual(parsearReps('10-12 por lado'), { repsMin: 10, repsMax: 12, tipoMedida: 'reps', porLado: true });
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

test('descansos del encargo 5.6 y guion como "sin cronómetro"; tanda 4: cualquier N s, N min o N-M min', () => {
  assert.equal(parsearDescanso('2-3 min'), 150);
  assert.equal(parsearDescanso('2 min'), 120);
  assert.equal(parsearDescanso('90 s'), 90);
  assert.equal(parsearDescanso('60 s'), 60);
  assert.equal(parsearDescanso('0'), 0);
  assert.equal(parsearDescanso('-'), 0);
  assert.equal(parsearDescanso('3 min'), 180);
  assert.equal(parsearDescanso('45 s'), 45);
  assert.equal(parsearDescanso('1-2 min'), 90);
  assert.throws(() => parsearDescanso('un rato'), /no reconocido/);
  assert.throws(() => parsearDescanso('3-2 min'), /no reconocido/);
});

test('reglas de progresión en texto: cada tipo, ida y vuelta, y error ante lo desconocido', () => {
  assert.deepEqual(parsearRegla('manual'), { tipo: 'manual' });
  assert.deepEqual(parsearRegla('todas 10 +5 kg'), { tipo: 'todas_las_series', objetivo: 10, incremento: 5, unidad: 'kg' });
  assert.deepEqual(parsearRegla('todas 15 +? kg'), { tipo: 'todas_las_series', objetivo: 15, incremento: null, unidad: 'kg' });
  assert.deepEqual(parsearRegla('todas 12 +2.5 lb'), { tipo: 'todas_las_series', objetivo: 12, incremento: 2.5, unidad: 'lb' });
  assert.deepEqual(parsearRegla('tiempo +10 hasta 70'), { tipo: 'incremento_semanal_tiempo', incremento: 10, tope: 70 });
  assert.deepEqual(parsearRegla('implemento 6: Banda roja'), { tipo: 'cambio_de_implemento', objetivo: 6, cambio: 'Banda roja' });
  assert.deepEqual(parsearRegla('implemento 12: Mancuernas de 20 lb = 20 lb c/u'), {
    tipo: 'cambio_de_implemento', objetivo: 12, cambio: 'Mancuernas de 20 lb', peso: 20, unidad: 'lb', pesoPorLado: true,
  });
  assert.deepEqual(parsearRegla('dos semanas 10: Subí 5 kg = +5 kg | Bajé el banco = Banco más bajo'), {
    tipo: 'todas_las_series_dos_semanas',
    objetivo: 10,
    opciones: [{ etiqueta: 'Subí 5 kg', incremento: 5, unidad: 'kg' }, { etiqueta: 'Bajé el banco', cambio: 'Banco más bajo' }],
  });
  for (const malo of ['sube cuando puedas', 'todas diez +5 kg', 'dos semanas 10: Solo una = +5 kg', 'tiempo +10']) {
    assert.throws(() => parsearRegla(malo), /no reconocida|necesita/, malo);
  }
});

test('las 35 reglas de tu rutina se escriben y se vuelven a leer idénticas', () => {
  const reglas = new Map(RUTINA.map((r) => [r.clave, r.progresionRegla]));
  assert.equal(reglas.size, 35);
  for (const [clave, regla] of reglas) assert.equal(JSON.stringify(parsearRegla(reglaATexto(regla))), JSON.stringify(regla), clave);
});

test('guion es nulo; RIR; slug sin acentos ni apóstrofos', () => {
  assert.equal(nulo('-'), null);
  assert.equal(nulo('Cuerda'), 'Cuerda');
  assert.equal(parsearRir('-'), null);
  assert.equal(parsearRir('3'), 3);
  assert.equal(slug("Farmer's carry"), 'farmers-carry');
  assert.equal(slug('Eversión de tobillo en polea'), 'eversion-de-tobillo-en-polea');
});
