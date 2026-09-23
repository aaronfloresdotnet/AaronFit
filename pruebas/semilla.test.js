// La semilla debe ser copia fiel de la hoja (fuente/rutina.tsv) y cumplir el
// conteo obligatorio del encargo (l.276): 43 renglones, 8-8-8-8-9-1-1.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { RUTINA, VERSION_SEMILLA } from '../docs/js/datos/semilla.js';
import { reglaATexto } from '../docs/js/logica/parseo.js';

const hoja = readFileSync(new URL('../fuente/rutina.tsv', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() !== '')
  .slice(1)
  .map((l) => l.split('\t'));

const TIPOS = ['todas_las_series', 'todas_las_series_dos_semanas', 'incremento_semanal_tiempo', 'cambio_de_implemento', 'manual'];

test('43 renglones: 8 de lunes a jueves, 9 el viernes, 1 sábado y 1 domingo', () => {
  assert.equal(RUTINA.length, 43);
  const porDia = [1, 2, 3, 4, 5, 6, 7].map((d) => RUTINA.filter((r) => r.diaSemana === d).length);
  assert.deepEqual(porDia, [8, 8, 8, 8, 9, 1, 1]);
});

test('id estable = diaSemana * 100 + orden, sin repetidos', () => {
  for (const r of RUTINA) assert.equal(r.id, r.diaSemana * 100 + r.orden, r.ejercicio);
  assert.equal(new Set(RUTINA.map((r) => r.id)).size, RUTINA.length);
});

test('los textos son idénticos a la hoja, renglón por renglón', () => {
  assert.equal(hoja.length, RUTINA.length);
  hoja.forEach((c, i) => {
    const r = RUTINA[i];
    const vacio = (t) => (t.trim() === '-' ? null : t);
    assert.equal(r.dia, c[0]);
    assert.equal(r.orden, Number(c[1]));
    assert.equal(r.grupo, c[2]);
    assert.equal(r.ejercicio, c[3]);
    assert.equal(r.equipo, c[4]);
    assert.equal(r.accesorioPolea, vacio(c[5]));
    assert.equal(r.pesoTexto, c[6]);
    assert.equal(r.series, Number(c[7]));
    assert.equal(r.repsTexto, c[8]);
    assert.equal(r.rir, vacio(c[9]) === null ? null : Number(c[9]));
    assert.equal(r.descansoTexto, c[10]);
    assert.equal(r.progresionTexto, c[11]);
    assert.equal(r.liga, c[12] === 'SIN LIGA' ? null : c[12]);
    assert.equal(reglaATexto(r.progresionRegla), c[13]); // tanda 4: la regla va en la hoja
  });
});

test('cada renglón trae una regla de progresión de un tipo conocido', () => {
  for (const r of RUTINA) assert.ok(TIPOS.includes(r.progresionRegla?.tipo), `${r.id} ${r.ejercicio}`);
});

test('solo comparten clave los renglones con prescripción idéntica', () => {
  const porClave = Map.groupBy(RUTINA, (r) => r.clave);
  for (const [clave, grupo] of porClave) {
    const firmas = new Set(grupo.map(({ id, dia, diaSemana, orden, ...resto }) => JSON.stringify(resto)));
    assert.equal(firmas.size, 1, clave);
  }
});

test('VERSION_SEMILLA es la huella del contenido (se regeneró tras el último cambio)', () => {
  const huella = createHash('sha256').update(JSON.stringify(RUTINA)).digest('hex').slice(0, 12);
  assert.equal(VERSION_SEMILLA, huella);
});
