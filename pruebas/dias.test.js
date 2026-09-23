// Saltar y recorrer (encargo 5.5 y sección 9): saltar deja el día no hecho,
// recorrer mueve los días, el recorrido NUNCA pasa del domingo y cada lunes
// arranca limpio.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DECISIONES_VACIAS, planSemana, recorrer, saltar } from '../docs/js/logica/dias.js';

const sesion = (dia, estado = 'completa') => ({ diaSemanaPlan: dia, estado });
const estados = (plan) => plan.dias.map((d) => d.estado);
const programados = (plan) => plan.dias.map((d) => d.programado);

test('un lunes normal toca el lunes', () => {
  const plan = planSemana({ hoy: 1, sesiones: [] });
  assert.equal(plan.hoyToca, 1);
  assert.equal(plan.vencido, null);
  assert.deepEqual(estados(plan), ['hoy', 'pendiente', 'pendiente', 'pendiente', 'pendiente']);
});

test('día perdido: la app pregunta y no elige por su cuenta', () => {
  const plan = planSemana({ hoy: 2, sesiones: [] });
  assert.equal(plan.vencido, 1);
  assert.equal(plan.hoyToca, null);
});

test('saltar deja el día como no hecho y hoy toca lo del calendario', () => {
  const decisiones = saltar(DECISIONES_VACIAS, 1);
  const plan = planSemana({ hoy: 2, sesiones: [], decisiones });
  assert.equal(plan.dias[0].estado, 'saltado');
  assert.equal(plan.hoyToca, 2);
  assert.equal(plan.vencido, null);
});

test('recorrer: hoy se entrena el día perdido y los siguientes se corren un día', () => {
  const decisiones = recorrer(DECISIONES_VACIAS, 1, 2);
  const plan = planSemana({ hoy: 2, sesiones: [], decisiones });
  assert.equal(plan.hoyToca, 1);
  assert.deepEqual(programados(plan), [2, 3, 4, 5, 6]);
});

test('el recorrido NUNCA pasa del domingo: lo que no cabe queda como no hecho', () => {
  // Jueves sin haber entrenado de lunes a miércoles: al recorrer el lunes, el viernes ya no cabe.
  const decisiones = recorrer(DECISIONES_VACIAS, 1, 4);
  const plan = planSemana({ hoy: 4, sesiones: [], decisiones });
  assert.equal(plan.hoyToca, 1);
  assert.deepEqual(programados(plan), [4, 5, 6, 7, null]);
  assert.equal(plan.dias[4].estado, 'no_cabe');
});

test('el recorrido NUNCA pasa del domingo: en todos los casos posibles', () => {
  for (let hoy = 1; hoy <= 7; hoy++) {
    for (let dia = 1; dia <= 5 && dia < hoy; dia++) {
      const plan = planSemana({ hoy, sesiones: [], decisiones: recorrer(DECISIONES_VACIAS, dia, hoy) });
      for (const d of plan.dias) {
        assert.ok(d.programado === null || d.programado <= 7, `hoy ${hoy}, recorrer ${dia}: día ${d.dia} → ${d.programado}`);
        if (d.programado === null) assert.equal(d.estado, 'no_cabe');
      }
    }
  }
});

test('lunes arranca limpio: la semana nueva no arrastra decisiones ni deudas', () => {
  // Las decisiones se guardan por semana ISO; una semana nueva empieza sin ninguna.
  const plan = planSemana({ hoy: 1, sesiones: [] });
  assert.equal(plan.hoyToca, 1);
  assert.ok(plan.dias.every((d) => ['hoy', 'pendiente'].includes(d.estado)));
});

test('sábado y domingo son caminata y no bloquean nada', () => {
  const plan = planSemana({ hoy: 6, sesiones: [1, 2, 3, 4, 5].map((d) => sesion(d)) });
  assert.equal(plan.caminata, 6);
  assert.equal(plan.hoyToca, null);
  assert.equal(plan.vencido, null);
});

test('un viernes recorrido al sábado convive con la caminata', () => {
  const decisiones = recorrer(DECISIONES_VACIAS, 5, 6);
  const plan = planSemana({ hoy: 6, sesiones: [1, 2, 3, 4].map((d) => sesion(d)), decisiones });
  assert.equal(plan.hoyToca, 5);
  assert.equal(plan.caminata, 6);
});

test('varios días perdidos: pregunta primero por el más antiguo', () => {
  assert.equal(planSemana({ hoy: 3, sesiones: [] }).vencido, 1);
  const decisiones = saltar(DECISIONES_VACIAS, 1);
  assert.equal(planSemana({ hoy: 3, sesiones: [], decisiones }).vencido, 2);
});

test('una sesión en curso no se pregunta; una abandonada cuenta como no hecha', () => {
  const enCurso = planSemana({ hoy: 2, sesiones: [sesion(1, 'en_curso')] });
  assert.equal(enCurso.dias[0].estado, 'en_curso');
  assert.equal(enCurso.vencido, null);
  assert.equal(enCurso.hoyToca, 2);

  const abandonada = planSemana({ hoy: 2, sesiones: [sesion(1, 'abandonada')] });
  assert.equal(abandonada.vencido, 1);
});

test('recorrer otra vez solo puede correr más, nunca regresar', () => {
  const una = recorrer(DECISIONES_VACIAS, 1, 2);
  assert.equal(recorrer(una, 2, 3).desplazamiento, 1);
  assert.equal(recorrer(una, 2, 4).desplazamiento, 2);
  assert.equal(saltar(saltar(DECISIONES_VACIAS, 3), 3).saltados.length, 1);
});
