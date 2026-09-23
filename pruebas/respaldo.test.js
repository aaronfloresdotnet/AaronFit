// Respaldo (encargo sección 7 y 9): exportar e importar devuelve exactamente
// los mismos datos; un archivo corrupto se rechaza; una versión de formato
// desconocida se rechaza con mensaje claro.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import { armarRespaldo, FORMATO, historialTSV, nombreArchivo, nombreHistorial, recordatorioRespaldo, validarRespaldo } from '../docs/js/logica/respaldo.js';

function muestra() {
  return {
    rutina: structuredClone(RUTINA),
    sesiones: [{
      id: 1, fecha: '2026-09-28', semanaISO: '2026-W40', diaRutina: 'LUNES - Empuje A', diaSemanaPlan: 1,
      recorrido: false, estado: 'completa', inicio: '2026-09-28T12:00:00.000Z', fin: '2026-09-28T13:05:00.000Z',
    }],
    series: [{
      id: 1, sesionId: 1, rutinaId: 103, semanaISO: '2026-W40', numeroSerie: 1, peso: 50, unidadPeso: 'kg',
      repsHechas: 10, segundos: null, metros: null, rirReportado: 3, lado: null, completada: true,
      hora: '2026-09-28T12:10:00.000Z',
    }],
    medidas: [{
      id: 1, fecha: '2026-10-03', semanaISO: '2026-W40', pesoCorporal: 80.5, cintura: 90, cadera: 95, cuello: 38,
      pecho: null, musloIzq: null, musloDer: null, pantorrillaIzq: null, pantorrillaDer: null, brazoIzq: null,
      brazoDer: null, antebrazoIzq: null, antebrazoDer: null, fotosTomadas: true, nota: null,
    }],
    estado: [
      { llave: 'versionSemilla', valor: 'abc123' },
      { llave: 'semana:2026-W40', valor: { desplazamiento: 0, saltados: [] } },
    ],
  };
}

const armarTexto = (datos, cambios = {}) =>
  JSON.stringify({ ...armarRespaldo(datos, { exportado: '2026-10-03T12:00:00.000Z' }), ...cambios });

test('exportar e importar devuelve exactamente los mismos datos', () => {
  const datos = muestra();
  const resultado = validarRespaldo(armarTexto(datos));
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.datos, datos);
  assert.deepEqual(resultado.conteos, { rutina: 43, sesiones: 1, series: 1, medidas: 1, estado: 2 });
  assert.equal(resultado.exportado, '2026-10-03T12:00:00.000Z');
});

test('archivo corrupto: se rechaza con un motivo y "no se tocó nada"', () => {
  const texto = armarTexto(muestra());
  const casos = {
    'no es JSON': '{esto no es json',
    'cortado a la mitad': texto.slice(0, texto.length / 2),
    'JSON de otra cosa': JSON.stringify({ hola: 'mundo' }),
    'arreglo suelto': '[]',
  };
  for (const [nombre, entrada] of Object.entries(casos)) {
    const r = validarRespaldo(entrada);
    assert.equal(r.ok, false, nombre);
    assert.match(r.error, /No se tocó nada/, nombre);
  }
});

test('archivo con datos rotos: colección faltante, campo inválido, llave repetida, serie huérfana', () => {
  const faltante = JSON.parse(armarTexto(muestra()));
  delete faltante.datos.medidas;
  assert.match(validarRespaldo(faltante).error, /falta la colección "medidas"/);

  const campo = muestra();
  campo.series[0].sesionId = 'uno';
  assert.match(validarRespaldo(armarTexto(campo)).error, /"series" #1: el campo "sesionId"/);

  const repetida = muestra();
  repetida.sesiones.push({ ...repetida.sesiones[0] });
  assert.match(validarRespaldo(armarTexto(repetida)).error, /repetida/);

  const huerfana = muestra();
  huerfana.series[0].sesionId = 99;
  assert.match(validarRespaldo(armarTexto(huerfana)).error, /apunta a una sesión/);
});

test('versión de formato desconocida: se rechaza con mensaje claro', () => {
  const nueva = validarRespaldo(armarTexto(muestra(), { version: 3 }));
  assert.equal(nueva.ok, false);
  assert.match(nueva.error, /versión 3 del formato/);
  assert.match(nueva.error, /hasta la 2/);
  assert.match(nueva.error, /Actualiza la app/);

  const sinVersion = validarRespaldo(armarTexto(muestra(), { version: undefined }));
  assert.equal(sinVersion.ok, false);
  assert.match(sinVersion.error, /versión de formato/);

  const otroFormato = validarRespaldo(armarTexto(muestra(), { formato: 'otra-app' }));
  assert.match(otroFormato.error, /no es un respaldo de AaronFit/);
  assert.equal(FORMATO, 'aaronfit-respaldo');
});

test('tanda 4: con una sola rutina el respaldo sigue siendo versión 1 (la v1.0 lo lee); con dos, versión 2', () => {
  const una = muestra();
  assert.equal(armarRespaldo(una, { exportado: 'x' }).version, 1);
  const dos = muestra();
  dos.rutina.push({ ...dos.rutina[0], id: 2101, plan: 2 });
  const respaldo = armarRespaldo(dos, { exportado: 'x' });
  assert.equal(respaldo.version, 2);
  assert.equal(validarRespaldo(respaldo).ok, true, 'esta app lee la versión 2');
  assert.equal(validarRespaldo({ ...armarRespaldo(una, { exportado: 'x' }), version: 1 }).ok, true, 'y la 1');
});

test('el nombre del archivo lleva la fecha', () => {
  assert.equal(nombreArchivo('2026-09-22'), 'aaronfit-respaldo-2026-09-22.json');
});

test('historial para Sheets: un renglón por registro, en orden, con los lados y las saltadas', () => {
  const datos = muestra();
  const base = datos.series[0];
  datos.series = [
    { ...base, id: 4, rutinaId: 101, numeroSerie: 1, peso: null, unidadPeso: 'corporal', repsHechas: null, segundos: 25, lado: 'der', rirReportado: null },
    { ...base, id: 3, numeroSerie: 2, repsHechas: null, peso: null, rirReportado: null, completada: false },
    base,
    { ...base, id: 5, rutinaId: 101, numeroSerie: 1, peso: null, unidadPeso: 'corporal', repsHechas: null, segundos: 30, lado: 'izq', rirReportado: null },
  ];
  datos.sesiones[0].diaRutina = 'LUNES\tEmpuje A'; // un tabulador no rompe las columnas
  const renglones = historialTSV(datos).trimEnd().split('\n').map((r) => r.split('\t'));
  assert.deepEqual(renglones[0], ['Fecha', 'Semana', 'Día', 'Ejercicio', 'Grupo', 'Serie', 'Lado', 'Peso', 'Unidad', 'Reps', 'Segundos', 'Metros', 'RIR', 'Hecha']);
  assert.equal(renglones.length, 1 + 4);
  assert.ok(renglones.every((r) => r.length === 14));
  assert.deepEqual(renglones.slice(1).map((r) => [r[3], r[5], r[6], r[7], r[9], r[10], r[12], r[13]]), [
    ['Equilibrio en un pie', '1', 'Izquierdo', '', '', '30', '', 'sí'],
    ['Equilibrio en un pie', '1', 'Derecho', '', '', '25', '', 'sí'],
    ['Press de banca', '1', '', '50', '10', '', '3', 'sí'],
    ['Press de banca', '2', '', '', '', '', '', 'no'],
  ]);
  assert.equal(renglones[1][2], 'LUNES Empuje A');
  assert.equal(nombreHistorial('2026-09-23'), 'aaronfit-historial-2026-09-23.tsv');
});

test('recordatorio de respaldo: más de 7 días, o nunca; sin datos no molesta', () => {
  assert.deepEqual(recordatorioRespaldo({ ultimo: '2026-09-16', hoy: '2026-09-23', hayDatos: true }), { dias: 7, toca: false });
  assert.deepEqual(recordatorioRespaldo({ ultimo: '2026-09-15', hoy: '2026-09-23', hayDatos: true }), { dias: 8, toca: true });
  assert.deepEqual(recordatorioRespaldo({ ultimo: null, hoy: '2026-09-23', hayDatos: true }), { dias: null, toca: true });
  assert.deepEqual(recordatorioRespaldo({ ultimo: null, hoy: '2026-09-23', hayDatos: false }), { dias: null, toca: false });
});
