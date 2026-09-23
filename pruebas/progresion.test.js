// Progresión (encargo 5.2 y sección 9): cada tipo de regla; se cumple justo;
// falta una repetición; dos semanas con una sola buena; manual no dispara;
// el RIR no altera el resultado.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import { evaluarProgresion, referenciaDeAceptar, TIPOS_DE_REGLA } from '../docs/js/logica/progresion.js';

const ejercicio = (id) => RUTINA.find((r) => r.id === id);
const banca = ejercicio(103); // 10/10/10 → +5 kg
const curlFemoral = ejercicio(205); // 15/15/15 → "el disco más chico": incremento libre
const sentadilla = ejercicio(403); // dos semanas con 10 en las 4 series
const plancha = ejercicio(108); // +10 s por semana hasta 70
const dominadas = ejercicio(303); // 6 en las 4 series → banda roja
const stepUp = ejercicio(404); // 12/12/12 → mancuernas de 20 lb
const costal = ejercicio(509); // manual

let reloj = 0;
function hacer(ej, valores, { peso = ej.pesoSugerido, unidadPeso = ej.unidadPeso, rir = null, semanaISO = '2026-W40', lado = null } = {}) {
  return valores.map((v, i) => ({
    sesionId: 1, rutinaId: ej.id, numeroSerie: i + 1, peso, unidadPeso,
    repsHechas: ej.tipoMedida === 'reps' ? v : null,
    segundos: ej.tipoMedida === 'segundos' || ej.tipoMedida === 'minutos' ? v : null,
    metros: ej.tipoMedida === 'metros' ? v : null,
    rirReportado: rir, lado, completada: true, semanaISO,
    hora: new Date(Date.UTC(2026, 9, 1, 12, 0, reloj++)).toISOString(),
  }));
}
const evaluar = (ej, seriesSesion, extra = {}) => evaluarProgresion({ ejercicio: ej, seriesSesion, semanaISO: '2026-W40', ...extra });

test('todas_las_series: se cumple justo en el objetivo y propone +5 kg', () => {
  const r = evaluar(banca, hacer(banca, [10, 10, 10]));
  assert.equal(r.cumplida, true);
  assert.deepEqual(r.propuesta, { tipo: 'peso', peso: 55, unidadPeso: 'kg', libre: false });
});

test('todas_las_series: falta una repetición en una serie → no dispara', () => {
  assert.equal(evaluar(banca, hacer(banca, [10, 9, 10])).cumplida, false);
});

test('todas_las_series: una serie sin hacer → no dispara', () => {
  assert.equal(evaluar(banca, hacer(banca, [10, 10])).cumplida, false);
  const saltada = hacer(banca, [10, 10, 10]);
  saltada[2].completada = false;
  assert.equal(evaluar(banca, saltada).cumplida, false);
});

test('el RIR no altera el resultado (la tabla dice "con 3 RIR" y no cuenta)', () => {
  for (const rir of [null, 0, 3, 5]) {
    assert.equal(evaluar(banca, hacer(banca, [10, 10, 10], { rir })).cumplida, true, `rir ${rir}`);
    assert.equal(evaluar(banca, hacer(banca, [10, 9, 10], { rir })).cumplida, false, `rir ${rir}`);
  }
});

test('todas_las_series sin incremento fijo ("el disco más chico"): propone +2.5 kg marcado como libre', () => {
  const r = evaluar(curlFemoral, hacer(curlFemoral, [15, 15, 15]));
  assert.deepEqual(r.propuesta, { tipo: 'peso', peso: 7.5, unidadPeso: 'kg', libre: true });
});

test('por lado: si un lado no llega al objetivo, no se cumple', () => {
  const series = hacer(curlFemoral, [15, 15, 15]);
  series.push({ ...series[1], lado: 'der', repsHechas: 14 });
  series[1].lado = 'izq';
  assert.equal(evaluar(curlFemoral, series).cumplida, false);
});

test('dos semanas: con una sola semana buena no dispara', () => {
  const estaSemana = hacer(sentadilla, [10, 10, 10, 10]);
  assert.equal(evaluar(sentadilla, estaSemana).cumplida, false);
  const anteriorMala = hacer(sentadilla, [10, 10, 9, 10], { semanaISO: '2026-W39' });
  assert.equal(evaluar(sentadilla, estaSemana, { seriesSemanaAnterior: anteriorMala }).cumplida, false);
});

test('dos semanas seguidas buenas: ofrece subir 5 kg O bajar el banco', () => {
  const r = evaluar(sentadilla, hacer(sentadilla, [10, 10, 10, 10]), {
    seriesSemanaAnterior: hacer(sentadilla, [10, 10, 10, 10], { semanaISO: '2026-W39' }),
  });
  assert.equal(r.cumplida, true);
  assert.deepEqual(r.propuesta.opciones, [
    { etiqueta: 'Subí 5 kg', tipo: 'peso', peso: 25, unidadPeso: 'kg' },
    { etiqueta: 'Bajé el banco', tipo: 'implemento', implemento: 'Banco más bajo' },
  ]);
});

test('dos semanas: después de aceptar un cambio la racha empieza de cero', () => {
  const r = evaluar(sentadilla, hacer(sentadilla, [10, 10, 10, 10]), {
    seriesSemanaAnterior: hacer(sentadilla, [10, 10, 10, 10], { semanaISO: '2026-W39' }),
    referencia: { hora: '2026-09-24T12:00:00.000Z', semanaISO: '2026-W39' },
  });
  assert.equal(r.cumplida, false);
});

test('incremento semanal de tiempo: +10 s sin pasar del tope', () => {
  assert.deepEqual(evaluar(plancha, hacer(plancha, [40, 40, 40])).propuesta, { tipo: 'tiempo', valor: 50 });
  assert.deepEqual(evaluar(plancha, hacer(plancha, [65, 70, 70])).propuesta, { tipo: 'tiempo', valor: 70 });
  assert.equal(evaluar(plancha, hacer(plancha, [70, 70, 70])).cumplida, false);
  assert.equal(evaluar(plancha, hacer(plancha, [40, 40])).cumplida, false);
});

test('incremento semanal de tiempo: una sola vez por semana', () => {
  const referencia = { hora: '2026-09-29T12:00:00.000Z', semanaISO: '2026-W40', valor: 50 };
  assert.equal(evaluar(plancha, hacer(plancha, [50, 50, 50]), { referencia }).cumplida, false);
});

test('cambio de implemento: al cumplirse propone el cambio, con peso si la regla lo trae', () => {
  assert.deepEqual(evaluar(dominadas, hacer(dominadas, [6, 6, 6, 6])).propuesta, { tipo: 'implemento', implemento: 'Banda roja' });
  assert.deepEqual(evaluar(stepUp, hacer(stepUp, [12, 12, 12])).propuesta, {
    tipo: 'implemento', implemento: 'Mancuernas de 20 lb', peso: 20, unidadPeso: 'lb', pesoPorLado: true,
  });
  assert.equal(evaluar(dominadas, hacer(dominadas, [6, 6, 5, 6])).cumplida, false);
});

test('cambio de implemento ya hecho no vuelve a avisar', () => {
  assert.equal(evaluar(dominadas, hacer(dominadas, [6, 6, 6, 6]), { implemento: 'Banda roja' }).cumplida, false);
});

test('regla manual no dispara nada aunque se haga todo', () => {
  assert.equal(evaluar(costal, hacer(costal, [120, 120, 120])).cumplida, false);
  for (const r of RUTINA.filter((x) => x.progresionRegla.tipo === 'manual')) {
    assert.equal(evaluar(r, hacer(r, Array(r.series).fill(999))).cumplida, false, r.ejercicio);
  }
});

test('las 43 reglas de la semilla tienen evaluador y ninguna truena sin series', () => {
  for (const r of RUTINA) {
    assert.ok(TIPOS_DE_REGLA.includes(r.progresionRegla.tipo), r.ejercicio);
    assert.equal(evaluar(r, []).cumplida, false, r.ejercicio);
  }
});

test('aceptar guarda la nueva referencia con su hora y su semana', () => {
  const momento = { hora: '2026-10-01T13:00:00.000Z', semanaISO: '2026-W40' };
  assert.deepEqual(referenciaDeAceptar({ tipo: 'peso', peso: 55, unidadPeso: 'kg', libre: false }, momento), {
    ...momento, tipo: 'peso', peso: 55, unidadPeso: 'kg',
  });
  assert.deepEqual(referenciaDeAceptar({ tipo: 'tiempo', valor: 50 }, momento), { ...momento, tipo: 'tiempo', valor: 50 });
  assert.deepEqual(
    referenciaDeAceptar({ tipo: 'implemento', implemento: 'Mancuernas de 20 lb', peso: 20, unidadPeso: 'lb', pesoPorLado: true }, momento),
    { ...momento, tipo: 'implemento', peso: 20, unidadPeso: 'lb', pesoPorLado: true, implemento: 'Mancuernas de 20 lb' },
  );
});
