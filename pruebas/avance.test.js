// Avance (tanda 2): 1RM estimado, puntos por sesión, récords, qué subió,
// resumen de la semana, constancia y series por grupo. Con una rutina chica
// armada aquí para que cada número esperado se pueda revisar a mano.
// NO cubre la pantalla ni la gráfica: eso se revisó en el navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  constancia, e1rm, ejercicioPorDefecto, ejerciciosConHistorial, estancamiento, marcasDeAvisos, puntosDeEjercicio, puntosPorClave,
  recordNuevo, records, resumenSemana, seriesPorGrupo, ultimasSemanas,
} from '../docs/js/logica/avance.js';

const fila = (id, diaSemana, orden, clave, extra = {}) => ({
  id, diaSemana, orden, clave, dia: `DIA ${diaSemana}`, grupo: 'Otro', ejercicio: clave, series: 2,
  tipoMedida: 'reps', unidadPeso: 'kg', pesoPorLado: false, progresionRegla: { tipo: 'todas_las_series' }, ...extra,
});

// Lunes a viernes: 2 + 3 + 2 + 2 + 2 + 2 + 2 = 15 series; sábado y domingo, caminata.
const RUTINA = [
  fila(101, 1, 1, 'equilibrio', { grupo: 'Tobillo', tipoMedida: 'segundos', unidadPeso: 'corporal', progresionRegla: { tipo: 'manual' } }),
  fila(102, 1, 2, 'banca', { grupo: 'Pecho', series: 3, ejercicio: 'Press de banca' }),
  fila(103, 1, 3, 'plancha', { grupo: 'Core', tipoMedida: 'segundos', unidadPeso: 'corporal', ejercicio: 'Plancha' }),
  fila(201, 2, 1, 'equilibrio', { grupo: 'Tobillo', tipoMedida: 'segundos', unidadPeso: 'corporal', progresionRegla: { tipo: 'manual' } }),
  fila(301, 3, 1, 'remo', { grupo: 'Espalda' }),
  fila(401, 4, 1, 'sentadilla', { grupo: 'Cuádriceps' }),
  fila(501, 5, 1, 'curl', { grupo: 'Bíceps', unidadPeso: 'lb', pesoPorLado: true }),
  fila(601, 6, 1, 'caminata', { grupo: 'Caminata', series: 1, tipoMedida: 'minutos', unidadPeso: 'corporal', progresionRegla: { tipo: 'manual' } }),
  fila(701, 7, 1, 'caminata', { grupo: 'Caminata', series: 1, tipoMedida: 'minutos', unidadPeso: 'corporal', progresionRegla: { tipo: 'manual' } }),
];

const sesion = (id, fecha, semanaISO, diaSemanaPlan, extra = {}) => ({
  id, fecha, semanaISO, diaSemanaPlan, estado: 'completa', recorrido: false, inicio: `${fecha}T15:00:00.000Z`, ...extra,
});

let minuto = 0;
const serie = (sesionId, semanaISO, rutinaId, numeroSerie, peso, valor, extra = {}) => {
  const tipo = RUTINA.find((r) => r.id === rutinaId);
  const campo = tipo.tipoMedida === 'reps' ? 'repsHechas' : tipo.tipoMedida === 'metros' ? 'metros' : 'segundos';
  return {
    sesionId, semanaISO, rutinaId, numeroSerie, peso, unidadPeso: tipo.unidadPeso, repsHechas: null, segundos: null, metros: null,
    [campo]: valor, lado: null, completada: true, hora: new Date(Date.UTC(2026, 8, 1) + minuto++ * 60_000).toISOString(), ...extra,
  };
};

test('1RM estimado (Epley)', () => {
  assert.equal(Math.round(e1rm(100, 10) * 100) / 100, 133.33);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(null, 10), null);
  assert.equal(e1rm(50, 0), null);
});

test('puntos: peso de trabajo, mejor 1RM de la sesión y el peor lado', () => {
  const sesiones = [sesion(2, '2026-09-28', '2026-W40', 1), sesion(1, '2026-09-21', '2026-W39', 1)];
  const series = [
    serie(1, '2026-W39', 102, 1, 50, 10), serie(1, '2026-W39', 102, 2, 50, 10), serie(1, '2026-W39', 102, 3, 50, 9),
    serie(2, '2026-W40', 102, 1, 55, 8), serie(2, '2026-W40', 102, 2, 55, 8), serie(2, '2026-W40', 102, 3, 52.5, 10),
  ];
  const puntos = puntosDeEjercicio({ series, sesiones, tipoMedida: 'reps' });
  assert.deepEqual(puntos.map((p) => [p.fecha, p.peso, Math.round(p.e1rm * 100) / 100, p.mejor]), [
    ['2026-09-21', 50, 66.67, { peso: 50, reps: 10 }],
    ['2026-09-28', 55, 70, { peso: 52.5, reps: 10 }],
  ]);

  const porLado = puntosDeEjercicio({
    series: [serie(1, '2026-W39', 101, 1, null, 30, { lado: 'izq' }), serie(1, '2026-W39', 101, 1, null, 22, { lado: 'der' })],
    sesiones,
    tipoMedida: 'segundos',
  });
  assert.equal(porLado[0].valor, 22);
  assert.equal(porLado[0].peso, null);
});

test('récords: en la unidad más reciente; las sesiones en otra unidad se cuentan aparte', () => {
  const puntos = [
    { fecha: '2026-09-07', unidad: 'lb', peso: 120, e1rm: 150, mejor: { peso: 120, reps: 8 }, valor: 8 },
    { fecha: '2026-09-21', unidad: 'kg', peso: 50, e1rm: 66.67, mejor: { peso: 50, reps: 10 }, valor: 10 },
    { fecha: '2026-09-28', unidad: 'kg', peso: 55, e1rm: 69.67, mejor: { peso: 55, reps: 8 }, valor: 8 },
    { fecha: '2026-10-05', unidad: 'kg', peso: 55, e1rm: 69.67, mejor: { peso: 55, reps: 8 }, valor: 8 },
  ];
  assert.deepEqual(records(puntos), {
    unidad: 'kg',
    peso: { valor: 55, fecha: '2026-09-28' }, // el empate se queda con la primera vez
    e1rm: { valor: 69.67, fecha: '2026-09-28', peso: 55, reps: 8 },
    valor: null,
    omitidas: 1,
  });
  const plancha = records([{ fecha: '2026-09-21', unidad: 'corporal', peso: null, e1rm: null, mejor: null, valor: 40 }]);
  assert.deepEqual(plancha.valor, { valor: 40, fecha: '2026-09-21' });
  assert.equal(plancha.peso, null);
  assert.equal(records([]), null);
});

test('récord al guardar: más peso, o mismo peso con más reps; nunca la primera vez ni en empate', () => {
  const antes = [serie(1, '2026-W39', 102, 1, 50, 10), serie(1, '2026-W39', 102, 2, 50, 10)];
  const nueva = (peso, reps) => [serie(2, '2026-W40', 102, 1, peso, reps)];
  assert.deepEqual(recordNuevo({ previas: antes, nuevas: nueva(55, 8), tipoMedida: 'reps' }), { tipo: 'peso', valor: 55, unidad: 'kg' });
  assert.deepEqual(recordNuevo({ previas: antes, nuevas: nueva(50, 12), tipoMedida: 'reps' }), { tipo: 'e1rm', valor: 70, unidad: 'kg', peso: 50, reps: 12 });
  assert.equal(recordNuevo({ previas: antes, nuevas: nueva(50, 10), tipoMedida: 'reps' }), null);
  // Primera sesión del ejercicio: lo de hoy no cuenta como historial.
  assert.equal(recordNuevo({ previas: antes, nuevas: [serie(1, '2026-W39', 102, 3, 60, 10)], tipoMedida: 'reps' }), null);
  // Otra unidad: no se compara.
  assert.equal(recordNuevo({ previas: antes, nuevas: [serie(2, '2026-W40', 102, 1, 120, 10, { unidadPeso: 'lb' })], tipoMedida: 'reps' }), null);
  // Sin peso: la mejor serie; por lado vale el peor lado.
  const plancha = [serie(1, '2026-W39', 103, 1, null, 40)];
  assert.deepEqual(recordNuevo({ previas: plancha, nuevas: [serie(2, '2026-W40', 103, 1, null, 45)], tipoMedida: 'segundos' }), { tipo: 'valor', valor: 45, unidad: 'corporal' });
  const lados = [serie(2, '2026-W40', 103, 1, null, 50, { lado: 'izq' }), serie(2, '2026-W40', 103, 1, null, 38, { lado: 'der' })];
  assert.equal(recordNuevo({ previas: plancha, nuevas: lados, tipoMedida: 'segundos' }), null);
});

/** Dos semanas: la W39 entera y la W40 hasta el miércoles. */
function historial() {
  const sesiones = [
    sesion(1, '2026-09-21', '2026-W39', 1), sesion(2, '2026-09-22', '2026-W39', 2), sesion(3, '2026-09-23', '2026-W39', 3),
    sesion(4, '2026-09-25', '2026-W39', 4, { recorrido: true }), sesion(5, '2026-09-26', '2026-W39', 6),
    sesion(6, '2026-09-28', '2026-W40', 1), sesion(7, '2026-09-29', '2026-W40', 2, { estado: 'en_curso' }),
  ];
  const series = [
    serie(1, '2026-W39', 101, 1, null, 30), serie(1, '2026-W39', 101, 2, null, 30),
    serie(1, '2026-W39', 102, 1, 50, 10), serie(1, '2026-W39', 102, 2, 50, 10), serie(1, '2026-W39', 102, 3, 50, 10),
    serie(1, '2026-W39', 103, 1, null, 40), serie(1, '2026-W39', 103, 2, null, 40),
    serie(2, '2026-W39', 201, 1, null, 30), serie(2, '2026-W39', 201, 2, null, 30),
    serie(3, '2026-W39', 301, 1, 40, 10), serie(3, '2026-W39', 301, 2, null, null, { completada: false }),
    serie(4, '2026-W39', 401, 1, 60, 10), serie(4, '2026-W39', 401, 2, 60, 10),
    serie(5, '2026-W39', 601, 1, null, 1800),
    serie(6, '2026-W40', 101, 1, null, 30), serie(6, '2026-W40', 101, 2, null, 30),
    serie(6, '2026-W40', 102, 1, 55, 8), serie(6, '2026-W40', 102, 2, 55, 8), serie(6, '2026-W40', 102, 3, 55, 8),
    serie(6, '2026-W40', 103, 1, null, 50), serie(6, '2026-W40', 103, 2, null, 45),
    serie(7, '2026-W40', 201, 1, null, 30),
  ];
  return { sesiones, series, puntos: puntosPorClave({ rutina: RUTINA, sesiones, series }) };
}

test('resumen de la semana: días, caminatas y series contra lo planeado, y qué subió', () => {
  const { sesiones, series, puntos } = historial();
  const w39 = resumenSemana({ semana: '2026-W39', rutina: RUTINA, sesiones, series, puntos });
  assert.deepEqual(w39.dias, { hechos: 4, plan: 5 });
  assert.deepEqual(w39.caminatas, { hechas: 1, plan: 2 });
  assert.deepEqual(w39.series, { hechas: 12, plan: 15 }); // 2+3+2 + 2 + 1 (una saltada) + 2 + 0
  assert.deepEqual(w39.subio, []); // no había semana anterior

  const w40 = resumenSemana({ semana: '2026-W40', rutina: RUTINA, sesiones, series, puntos });
  assert.deepEqual(w40.dias, { hechos: 1, plan: 5 }); // el martes sigue en curso
  assert.deepEqual(w40.series, { hechas: 8, plan: 15 });
  assert.deepEqual(w40.subio.map((s) => [s.clave, s.tipo, s.antes, s.ahora, s.unidad]), [
    ['banca', 'peso', 50, 55, 'kg'],
    ['plancha', 'valor', 40, 50, 'corporal'],
  ]);
});

test('semanas de la constancia: desde el inicio del programa y como mucho 8', () => {
  assert.deepEqual(ultimasSemanas('2026-W38', '2026-W40', 8), ['2026-W38', '2026-W39', '2026-W40']);
  const largas = ultimasSemanas('2025-W40', '2026-W02', 8);
  assert.equal(largas.length, 8);
  assert.deepEqual([largas[0], largas.at(-1)], ['2025-W47', '2026-W02']);
  assert.deepEqual(ultimasSemanas(null, '2026-W40', 8), []);
});

test('constancia: hecho, recorrido, saltado, no hecho, antes de empezar y la semana en curso', () => {
  // Empezó el miércoles 16-sep (W38). Hoy es miércoles 30-sep (W40).
  const sesiones = [
    sesion(1, '2026-09-16', '2026-W38', 3), sesion(2, '2026-09-18', '2026-W38', 4, { recorrido: true }),
    sesion(3, '2026-09-21', '2026-W39', 1), sesion(4, '2026-09-23', '2026-W39', 3), sesion(5, '2026-09-24', '2026-W39', 4),
    sesion(6, '2026-09-25', '2026-W39', 5, { estado: 'abandonada' }),
    sesion(7, '2026-09-28', '2026-W40', 1),
  ];
  const decisiones = { '2026-W39': { desplazamiento: 0, saltados: [2] } };
  const r = constancia({ semanas: ['2026-W38', '2026-W39', '2026-W40'], sesiones, decisiones, hoy: { semana: '2026-W40', dia: 3 } });
  const estados = r.filas.map((f) => f.dias.map((d) => d.estado));
  assert.deepEqual(estados, [
    ['antes', 'antes', 'hecho', 'recorrido', 'no_hecho'],
    ['hecho', 'saltado', 'hecho', 'hecho', 'no_hecho'],
    ['hecho', 'pendiente', 'hoy', 'por_venir', 'por_venir'],
  ]);
  assert.deepEqual(r.filas.map((f) => [f.hechos, f.cuentan]), [[2, 3], [3, 5], [1, 5]]);
  assert.deepEqual(r.cerradas, { semanas: 2, hechos: 5, posibles: 8 }); // la semana en curso no cuenta
});

test('series por grupo: esta semana contra la anterior, sin contar dos veces el mismo lado', () => {
  const { series } = historial();
  series.push(serie(6, '2026-W40', 101, 1, null, 28, { lado: 'der' })); // el otro lado de una serie ya contada
  const grupos = seriesPorGrupo({ rutina: RUTINA, series, actual: '2026-W40', anterior: '2026-W39' });
  assert.deepEqual(grupos.map((g) => [g.grupo, g.plan, g.actual, g.anterior]), [
    ['Tobillo', 4, 3, 4], ['Pecho', 3, 3, 3], ['Core', 2, 2, 2], ['Espalda', 2, 0, 1], ['Cuádriceps', 2, 0, 2], ['Bíceps', 2, 0, 0],
  ]);
});

test('lista de ejercicios, el que se abre primero y dónde van los avisos aceptados', () => {
  const { puntos } = historial();
  const lista = ejerciciosConHistorial({ rutina: RUTINA, puntos });
  assert.deepEqual(lista.map((e) => [e.clave, e.sesiones]), [['equilibrio', 4], ['banca', 2], ['plancha', 2], ['remo', 1], ['sentadilla', 1], ['caminata', 1]]);
  // El más reciente con regla de progresión (equilibrio y caminata son manuales).
  assert.equal(ejercicioPorDefecto(lista), 'plancha');
  assert.equal(ejercicioPorDefecto([]), null);

  const banca = puntos.get('banca');
  const marcas = marcasDeAvisos(banca, [{ hora: banca[0].fin, peso: 55 }, { hora: '2026-01-01T00:00:00.000Z', peso: 1 }]);
  assert.deepEqual([...marcas.keys()], [0]); // el aviso anterior a todo no tiene sesión
});

test('estancamiento: 3 semanas sin récord ni aviso aceptado, en la unidad actual', () => {
  const punto = (semana, peso, e1rmValor, extra = {}) => ({
    fecha: `f-${semana}`, semanaISO: `2026-W${semana}`, inicio: `2026-09-${semana}T10:00:00.000Z`, unidad: 'kg', peso, e1rm: e1rmValor, valor: 8, ...extra,
  });
  const quietos = [punto(35, 50, 66), punto(36, 50, 66), punto(37, 50, 66), punto(38, 50, 66)];
  assert.deepEqual(estancamiento(quietos), { semanas: 3, sesiones: 3, desde: 'f-35', estancado: true });
  assert.equal(estancamiento(quietos.slice(0, 3)).estancado, false); // solo 2 semanas
  const subeReps = [punto(35, 50, 66), punto(36, 50, 66), punto(37, 50, 68), punto(38, 50, 68)];
  assert.deepEqual(estancamiento(subeReps), { semanas: 1, sesiones: 1, desde: 'f-37', estancado: false });
  // Un aviso aceptado en la semana 36 también cuenta como avance.
  assert.equal(estancamiento(quietos, [{ hora: '2026-09-36T11:00:00.000Z' }]).semanas, 2);
  // Sin peso cuenta la mejor serie; las sesiones en otra unidad no se mezclan.
  const plancha = [35, 36, 37, 38].map((s) => punto(s, null, null, { unidad: 'corporal', valor: 40 }));
  assert.equal(estancamiento(plancha).estancado, true);
  const cambioUnidad = [punto(30, 90, 120, { unidad: 'lb' }), punto(35, 50, 66), punto(36, 50, 66)];
  assert.deepEqual(estancamiento(cambioUnidad), { semanas: 1, sesiones: 1, desde: 'f-35', estancado: false });
  assert.equal(estancamiento([]), null);
});
