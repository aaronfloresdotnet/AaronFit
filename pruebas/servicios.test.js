// Casos de uso (capa de aplicación) con repositorios en memoria y reloj fijo.
// Cubren la orquestación: cuándo sale el aviso, qué se precarga después de
// aceptarlo, correcciones, por lado, terminar a medias, recorrer, medidas y
// respaldo. NO cubren IndexedDB real: eso se probó en el navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA, VERSION_SEMILLA } from '../docs/js/datos/semilla.js';
import { crearServicioEntrenamiento } from '../docs/js/servicios/entrenamiento.js';
import { crearServicioMedidas } from '../docs/js/servicios/medidas.js';
import { crearServicioRespaldo } from '../docs/js/servicios/respaldo.js';
import { crearReposEnMemoria } from './apoyo/repos-en-memoria.js';

process.env.TZ = 'America/Mexico_City';

async function montaje(inicioISO) {
  const repos = crearReposEnMemoria();
  await repos.rutina.sembrar(RUTINA, VERSION_SEMILLA);
  let instante = new Date(inicioISO);
  const reloj = () => new Date(instante);
  return {
    repos,
    reloj,
    servicio: crearServicioEntrenamiento({ repos, reloj }),
    avanzar: (ms = 60_000) => {
      instante = new Date(instante.getTime() + ms);
    },
    irA: (iso) => {
      instante = new Date(iso);
    },
  };
}

const delDia = (dia) => RUTINA.filter((r) => r.diaSemana === dia).sort((a, b) => a.orden - b.orden);
const porClave = (clave) => RUTINA.find((r) => r.clave === clave);
const valorMaximo = (e) => (e.tipoMedida === 'minutos' ? e.repsMax * 60 : e.repsMax);

/** Hace todas las series de un ejercicio con la precarga de peso y el valor dado. */
async function hacer(m, sesionId, ejercicio, valor = valorMaximo(ejercicio)) {
  const { precarga } = await m.servicio.datosEjercicio(sesionId, ejercicio.id);
  const resultados = [];
  for (const p of precarga) {
    m.avanzar();
    resultados.push(await m.servicio.guardarSerie({
      sesionId, rutinaId: ejercicio.id, numeroSerie: p.numeroSerie, peso: p.peso, unidadPeso: p.unidadPeso, valor,
    }));
  }
  return resultados;
}

test('un lunes completo: el aviso sale solo al cerrar la última serie y la sesión se cierra sola', async () => {
  const m = await montaje('2026-09-21T15:00:00Z'); // lunes 21-sep, 9:00 en CDMX
  assert.equal((await m.servicio.resumenInicio()).hoyToca.dia, 1);
  const id = await m.servicio.iniciarSesion(1);
  const avisos = {};
  for (const ejercicio of delDia(1)) {
    const resultados = await hacer(m, id, ejercicio);
    resultados.slice(0, -1).forEach((r) => assert.equal(r.progresion, null, `${ejercicio.ejercicio}: avisó antes de la última serie`));
    avisos[ejercicio.clave] = resultados.at(-1).progresion;
  }
  assert.equal((await m.repos.sesiones.obtener(id)).estado, 'completa');
  assert.deepEqual(avisos['press-de-banca'], { tipo: 'peso', peso: 55, unidadPeso: 'kg', libre: false });
  assert.deepEqual(avisos['press-militar-sentado-con-mancuernas'], { tipo: 'peso', peso: 40, unidadPeso: 'lb', libre: false });
  assert.deepEqual(avisos.plancha, { tipo: 'tiempo', valor: 50 });
  assert.equal(avisos['equilibrio-en-un-pie'], null); // regla manual
  assert.equal(avisos['eversion-de-tobillo-en-polea'], null); // regla manual
  assert.equal(await m.repos.estado.leer('inicioPrograma'), '2026-W39');
});

test('aceptar el aviso: la semana siguiente sale el peso nuevo con repsMin; "ahora no" vuelve a avisar', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const inclinado = porClave('press-inclinado-con-barra');
  const semana1 = await m.servicio.iniciarSesion(1);
  const avisoBanca = (await hacer(m, semana1, banca)).at(-1).progresion;
  await m.servicio.aceptarProgresion({ sesionId: semana1, rutinaId: banca.id, propuesta: avisoBanca });
  assert.ok((await hacer(m, semana1, inclinado)).at(-1).progresion, 'el inclinado avisó'); // y se ignora ("ahora no")

  m.irA('2026-09-28T15:00:00Z'); // lunes siguiente
  const semana2 = await m.servicio.iniciarSesion(1);
  assert.notEqual(semana2, semana1);
  const datosBanca = await m.servicio.datosEjercicio(semana2, banca.id);
  assert.deepEqual(datosBanca.precarga.map((p) => [p.peso, p.valor]), [[55, 8], [55, 8], [55, 8]]);
  const datosInclinado = await m.servicio.datosEjercicio(semana2, inclinado.id);
  assert.deepEqual(datosInclinado.precarga.map((p) => [p.peso, p.valor]), [[30, 12], [30, 12], [30, 12]]);
  assert.deepEqual((await hacer(m, semana2, inclinado)).at(-1).progresion, { tipo: 'peso', peso: 35, unidadPeso: 'kg', libre: false });
});

test('corregir una serie la sobreescribe: mismo registro, sin aviso repetido', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const id = await m.servicio.iniciarSesion(1);
  await hacer(m, id, banca, 10);
  const antes = await m.repos.series.deSesion(id);
  const serie2 = antes.find((s) => s.numeroSerie === 2);
  const r = await m.servicio.guardarSerie({ sesionId: id, rutinaId: banca.id, numeroSerie: 2, peso: 50, unidadPeso: 'kg', valor: 9 });
  assert.equal(r.progresion, null);
  const despues = await m.repos.series.deSesion(id);
  assert.equal(despues.length, antes.length);
  const corregida = despues.find((s) => s.numeroSerie === 2);
  assert.equal(corregida.id, serie2.id);
  assert.equal(corregida.repsHechas, 9);
  assert.equal(corregida.hora, serie2.hora);
});

test('por lado: pasar de un valor a izquierda y derecha reemplaza el registro único', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const equilibrio = porClave('equilibrio-en-un-pie');
  const id = await m.servicio.iniciarSesion(1);
  const base = { sesionId: id, rutinaId: equilibrio.id, numeroSerie: 1, peso: null, unidadPeso: 'corporal' };
  await m.servicio.guardarSerie({ ...base, valor: 30 });
  await m.servicio.guardarSerie({ ...base, lados: { izq: 30, der: 25 } });
  const series = await m.repos.series.deSesion(id);
  assert.deepEqual(series.map((s) => [s.lado, s.segundos]).sort(), [['der', 25], ['izq', 30]]);
});

test('terminar a medias: lo que falta queda saltado; sin ninguna serie, abandonada y el día sigue pendiente', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const id = await m.servicio.iniciarSesion(1);
  await hacer(m, id, delDia(1)[0]);
  const resumen = await m.servicio.terminarSesion(id);
  assert.equal(resumen.estado, 'completa');
  const series = await m.repos.series.deSesion(id);
  assert.equal(series.filter((s) => s.completada).length, 2);
  assert.equal(series.filter((s) => !s.completada).length, 22 - 2);

  m.irA('2026-09-22T15:00:00Z'); // martes
  const vacia = await m.servicio.iniciarSesion(2);
  assert.equal((await m.servicio.terminarSesion(vacia)).estado, 'abandonada');
  m.irA('2026-09-23T15:00:00Z'); // miércoles: el martes quedó pendiente
  assert.equal((await m.servicio.resumenInicio()).vencido.dia, 2);
});

test('recorrer desde inicio: el día perdido se entrena hoy y la sesión queda como recorrida', async () => {
  const m = await montaje('2026-09-22T15:00:00Z'); // martes, sin lunes
  const inicio = await m.servicio.resumenInicio();
  assert.equal(inicio.vencido.dia, 1);
  assert.deepEqual(inicio.vencido.noCabrian, []);
  await m.servicio.decidirDiaVencido(1, 'recorrer');
  const despues = await m.servicio.resumenInicio();
  assert.equal(despues.hoyToca.dia, 1);
  assert.equal(despues.hoyToca.recorrido, true);
  const sesion = await m.repos.sesiones.obtener(await m.servicio.iniciarSesion(1));
  assert.equal(sesion.recorrido, true);
  assert.equal(sesion.fecha, '2026-09-22');
  assert.equal(sesion.semanaISO, '2026-W39');
});

test('la fecha es la local: una serie a las 23:30 del domingo cuenta en esa semana', async () => {
  const m = await montaje('2026-09-28T05:30:00Z'); // domingo 27-sep 23:30 en CDMX
  const sesion = await m.repos.sesiones.obtener(await m.servicio.iniciarSesion(7));
  assert.equal(sesion.fecha, '2026-09-27');
  assert.equal(sesion.semanaISO, '2026-W39');
});

test('medidas: guardar dos veces la misma fecha corrige la misma medición', async () => {
  const repos = crearReposEnMemoria();
  const medidas = crearServicioMedidas({ repos, reloj: () => new Date('2026-09-26T16:00:00Z') });
  await medidas.guardar({ fecha: '2026-09-26', valores: { pesoCorporal: 80.5 }, fotosTomadas: true, nota: '' });
  await medidas.guardar({ fecha: '2026-09-26', valores: { pesoCorporal: 80.3, cintura: 90 }, fotosTomadas: true, nota: ' ok ' });
  const todas = await repos.medidas.todas();
  assert.equal(todas.length, 1);
  assert.equal(todas[0].pesoCorporal, 80.3);
  assert.equal(todas[0].cintura, 90);
  assert.equal(todas[0].cadera, null);
  assert.equal(todas[0].semanaISO, '2026-W39');
  assert.equal(todas[0].nota, 'ok');
});

test('respaldo: un archivo corrupto no toca la base; uno bueno la deja idéntica a la original', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const id = await m.servicio.iniciarSesion(1);
  await hacer(m, id, porClave('press-de-banca'));
  const origen = crearServicioRespaldo({ repos: m.repos, reloj: m.reloj });
  const { texto, nombre } = await origen.exportar();
  assert.equal(nombre, 'aaronfit-respaldo-2026-09-21.json');

  const destinoRepos = crearReposEnMemoria();
  const destino = crearServicioRespaldo({ repos: destinoRepos, reloj: m.reloj });
  for (const malo of ['{roto', texto.slice(0, 200), JSON.stringify({ ...JSON.parse(texto), version: 9 })]) {
    const r = await destino.importar(malo);
    assert.equal(r.ok, false);
    assert.equal(destinoRepos.reemplazos, undefined, 'no se llamó a reemplazarTodo');
  }
  const r = await destino.importar(texto);
  assert.equal(r.ok, true);
  assert.equal(destinoRepos.reemplazos, 1);
  assert.deepEqual(await destinoRepos.leerTodo(), await m.repos.leerTodo());
  assert.ok(await destinoRepos.estado.leer('ultimoRespaldo'), 'el archivo trae su propia fecha');
});
