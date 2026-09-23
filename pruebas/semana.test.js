// Semana ISO 8601 (encargo 5.4 y sección 9): lunes y domingo, cambio de año,
// 31 de diciembre en la semana 1 del año siguiente, y hora LOCAL, no UTC.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aTexto,
  deTexto,
  diaSemana,
  fechaDeDia,
  fechaLocal,
  lunesDeSemana,
  semanaAnterior,
  semanaISO,
  semanasEntre,
  sumarDias,
} from '../docs/js/logica/semana.js';

const semanaDe = (texto) => semanaISO(deTexto(texto));

test('lunes y domingo de una misma semana caen en la misma semana ISO', () => {
  assert.equal(semanaDe('2026-09-21'), '2026-W39');
  assert.equal(semanaDe('2026-09-27'), '2026-W39');
  assert.equal(semanaDe('2026-09-28'), '2026-W40');
  assert.equal(diaSemana(deTexto('2026-09-21')), 1);
  assert.equal(diaSemana(deTexto('2026-09-27')), 7);
});

test('el ejemplo del encargo: 2026-09-22 es martes de 2026-W39', () => {
  assert.equal(diaSemana(deTexto('2026-09-22')), 2);
  assert.equal(semanaDe('2026-09-22'), '2026-W39');
});

test('cambio de año: el 1 de enero puede caer en la semana 53 del año anterior', () => {
  assert.equal(semanaDe('2021-01-01'), '2020-W53');
  assert.equal(semanaDe('2027-01-01'), '2026-W53');
  assert.equal(semanaDe('2027-01-03'), '2026-W53');
  assert.equal(semanaDe('2027-01-04'), '2027-W01');
});

test('31 de diciembre que pertenece a la semana 1 del año siguiente', () => {
  assert.equal(semanaDe('2024-12-31'), '2025-W01');
  assert.equal(semanaDe('2025-12-29'), '2026-W01');
});

test('lunesDeSemana y fechaDeDia deshacen semanaISO, también en semanas 53 y 1', () => {
  assert.equal(aTexto(lunesDeSemana('2026-W39')), '2026-09-21');
  assert.equal(aTexto(lunesDeSemana('2026-W01')), '2025-12-29');
  assert.equal(aTexto(lunesDeSemana('2020-W53')), '2020-12-28');
  assert.equal(aTexto(fechaDeDia('2026-W39', 7)), '2026-09-27');
  // Recorrido de 1,200 días seguidos: cada fecha cae dentro de su propia semana.
  let fecha = deTexto('2024-06-01');
  for (let i = 0; i < 1200; i++) {
    const semana = semanaISO(fecha);
    assert.equal(aTexto(fechaDeDia(semana, diaSemana(fecha))), aTexto(fecha));
    fecha = sumarDias(fecha, 1);
  }
});

test('semanaAnterior y semanasEntre cruzan el cambio de año', () => {
  assert.equal(semanaAnterior('2026-W01'), '2025-W52');
  assert.equal(semanaAnterior('2027-W01'), '2026-W53');
  assert.equal(semanasEntre('2026-W52', '2027-W02'), 3);
  assert.equal(semanasEntre('2026-W39', '2026-W39'), 0);
});

test('zona horaria: cuenta la fecha LOCAL del teléfono, no la de UTC', () => {
  process.env.TZ = 'America/Mexico_City';
  // Domingo 27-sep-2026 a las 23:30 en CDMX es lunes 28-sep a las 05:30 en UTC.
  const instante = new Date('2026-09-28T05:30:00Z');
  const local = fechaLocal(instante);
  assert.equal(aTexto(local), '2026-09-27');
  assert.equal(semanaISO(local), '2026-W39');
  // Con UTC saldría el día y la semana siguientes: el error que se evita.
  assert.equal(instante.toISOString().slice(0, 10), '2026-09-28');

  process.env.TZ = 'Asia/Tokyo';
  assert.equal(aTexto(fechaLocal(instante)), '2026-09-28');
});
