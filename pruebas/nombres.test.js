// Nombres de ejercicio entre rutinas (Aarón, 2026-09-23): la lista de los que
// ya tienes y cuáles se parecen a uno que no tienes, con tus 34 nombres reales.
// NO cubre sinónimos o traducciones («Bench press», «Press plano con barra»):
// no se parecen por escrito y se unen a mano en la revisión.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA } from '../docs/js/datos/semilla.js';
import { nombresConocidos, nombresNuevos, parecidos, seParecen } from '../docs/js/logica/nombres.js';

const conocidos = nombresConocidos(RUTINA);

test('los nombres que ya tienes: uno por nombre, escrito como en la rutina más reciente', () => {
  assert.equal(conocidos.size, 34); // 35 claves: la elevación lateral lleva una por día
  assert.equal(conocidos.get('press-de-banca'), 'Press de banca');
  const conRutina2 = nombresConocidos([...RUTINA, { ...RUTINA[0], id: 2101, plan: 2, ejercicio: 'EQUILIBRIO en un pie' }]);
  assert.equal(conRutina2.get('equilibrio-en-un-pie'), 'EQUILIBRIO en un pie');
});

test('variantes de tus nombres: la app pregunta si son el mismo', () => {
  const casos = {
    'Press bank': ['Press de banca'],
    'Pres de banca': ['Press de banca'], // con una s
    'Elevaciones laterales': ['Elevación lateral'],
    'Face pull': ['Face pull con cuerda'],
    'Remo con mancuerna a un brazo': ['Remo a un brazo con mancuerna'],
    'Dominada asistida con banda': ['Dominadas asistidas con banda'],
    'Farmer carry': ["Farmer's carry"],
    'Press militar con mancuernas': ['Press militar sentado con mancuernas', 'Press inclinado con mancuernas'], // eliges tú
  };
  for (const [nombre, esperados] of Object.entries(casos)) assert.deepEqual(parecidos(nombre, conocidos), esperados, nombre);
});

test('ejercicios de verdad nuevos: no pregunta (0 de 10)', () => {
  const nuevos = ['Sentadilla goblet', 'Sentadilla búlgara', 'Remo con barra', 'Remo Pendlay', 'Press Arnold', 'Curl de bíceps con barra', 'Puente de glúteo', 'Pallof press', 'Sentadilla con barra', 'Press francés'];
  assert.deepEqual(nuevos.filter((n) => parecidos(n, conocidos).length), []);
  assert.deepEqual(parecidos('Bench press', conocidos), [], 'una traducción no se detecta: se une a mano');
});

test('entre tus propios nombres solo se parecen 1 de 561 pares', () => {
  const lista = [...conocidos.values()];
  const pares = [];
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) if (seParecen(lista[i], lista[j])) pares.push([lista[i], lista[j]]);
  assert.deepEqual(pares, [['Elevación de talón a un pie', 'Elevación de talón a un pie con mancuerna']]);
});

test('nombres que no tienes: sin repetir, sin los tuyos (mayúsculas, acentos y guiones no cuentan) y con tu respuesta', () => {
  const nombres = ['PRESS DE BANCA', 'Pull through con cuerda', 'Press bank', 'press bank', 'Remo con barra', 'Remo Pendlay', 'Face pull'];
  const r = nombresNuevos(nombres, conocidos, { 'Press bank': 'Press de banca', 'Remo con barra': null, 'Face pull': 'Algo que no tengo' });
  assert.deepEqual(r, [
    { nombre: 'Press bank', parecidos: ['Press de banca'], decision: 'Press de banca' },
    { nombre: 'Remo con barra', parecidos: [], decision: null },
    { nombre: 'Remo Pendlay', parecidos: [], decision: undefined },
    { nombre: 'Face pull', parecidos: ['Face pull con cuerda'], decision: undefined }, // un nombre que no tienes no cuenta como respuesta
  ]);
});
