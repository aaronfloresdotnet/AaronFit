// Respaldo (encargo sección 7 y 9): exportar e importar devuelve exactamente
// los mismos datos; un archivo corrupto se rechaza; una versión de formato
// desconocida se rechaza con mensaje claro.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import { armarRespaldo, FORMATO, nombreArchivo, validarRespaldo } from '../docs/js/logica/respaldo.js';

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
  const nueva = validarRespaldo(armarTexto(muestra(), { version: 2 }));
  assert.equal(nueva.ok, false);
  assert.match(nueva.error, /versión 2 del formato/);
  assert.match(nueva.error, /hasta la 1/);
  assert.match(nueva.error, /Actualiza la app/);

  const sinVersion = validarRespaldo(armarTexto(muestra(), { version: undefined }));
  assert.equal(sinVersion.ok, false);
  assert.match(sinVersion.error, /versión de formato/);

  const otroFormato = validarRespaldo(armarTexto(muestra(), { formato: 'otra-app' }));
  assert.match(otroFormato.error, /no es un respaldo de AaronFit/);
  assert.equal(FORMATO, 'aaronfit-respaldo');
});

test('el nombre del archivo lleva la fecha', () => {
  assert.equal(nombreArchivo('2026-09-22'), 'aaronfit-respaldo-2026-09-22.json');
});
