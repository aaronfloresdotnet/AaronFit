// Casos de uso (capa de aplicación) con repositorios en memoria y reloj fijo.
// Cubren la orquestación: cuándo sale el aviso, qué se precarga después de
// aceptarlo, correcciones, por lado, terminar a medias, recorrer, medidas,
// respaldo y (tanda 2) récords, avance y perfil. NO cubren IndexedDB real:
// eso se probó en el navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA, VERSION_SEMILLA } from '../docs/js/datos/semilla.js';
import { crearServicioAjustes } from '../docs/js/servicios/ajustes.js';
import { crearServicioAvance } from '../docs/js/servicios/avance.js';
import { crearServicioEntrenamiento } from '../docs/js/servicios/entrenamiento.js';
import { crearServicioMedidas } from '../docs/js/servicios/medidas.js';
import { crearServicioPlan } from '../docs/js/servicios/plan.js';
import { crearServicioRespaldo } from '../docs/js/servicios/respaldo.js';
import { COLUMNAS_RUTINA } from '../docs/js/logica/plan.js';
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

test('al volver a inicio con el entrenamiento de hoy empezado, se ofrece continuarlo', async () => {
  const m = await montaje('2026-09-22T15:00:00Z'); // martes, sin lunes
  await m.servicio.decidirDiaVencido(1, 'recorrer');
  const id = await m.servicio.iniciarSesion(1);
  await m.servicio.guardarSerie({ sesionId: id, rutinaId: 101, numeroSerie: 1, peso: null, unidadPeso: 'corporal', valor: 30 });
  const inicio = await m.servicio.resumenInicio();
  assert.equal(inicio.hoyToca.dia, 1);
  assert.equal(inicio.enCurso.id, id);
  assert.equal(inicio.enCurso.hechas, 1);
  assert.equal(inicio.enCurso.total, 22);
  assert.equal(await m.servicio.iniciarSesion(1), id, 'continuar reusa la misma sesión');
});

test('deshacer: quita la última serie y el aviso aceptado después; la precarga vuelve a 50', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const id = await m.servicio.iniciarSesion(1);
  const aviso = (await hacer(m, id, banca, 10)).at(-1).progresion;
  await m.servicio.aceptarProgresion({ sesionId: id, rutinaId: banca.id, propuesta: aviso });
  assert.equal((await m.repos.estado.leer('referencia:press-de-banca')).peso, 55);
  const avisos = await m.repos.estado.leer('avisosAceptados');
  assert.deepEqual(avisos.map((a) => [a.clave, a.sesionId, a.peso]), [['press-de-banca', id, 55]]);

  const deshecha = await m.servicio.deshacerUltimaSerie(id);
  assert.deepEqual(await m.repos.estado.leer('avisosAceptados'), [], 'el aviso deshecho sale de la lista (y de la gráfica)');
  assert.equal(deshecha.rutinaId, banca.id);
  assert.equal(deshecha.numeroSerie, 3);
  assert.deepEqual(deshecha.borrador, { peso: 50, unidadPeso: 'kg', rir: null, valor: 10, lados: null });
  assert.equal(await m.repos.estado.leer('referencia:press-de-banca'), undefined);
  assert.equal((await m.repos.series.deSesion(id)).length, 2);

  m.irA('2026-09-28T15:00:00Z');
  const siguiente = await m.servicio.iniciarSesion(1);
  const { precarga } = await m.servicio.datosEjercicio(siguiente, banca.id);
  assert.deepEqual(precarga.map((p) => p.peso), [50, 50, 50]);
});

test('deshacer: reabre la sesión que la última serie había cerrado, y borra los dos lados', async () => {
  const m = await montaje('2026-09-27T16:00:00Z'); // domingo: caminata, 1 serie
  const id = await m.servicio.iniciarSesion(7);
  await hacer(m, id, delDia(7)[0]);
  assert.equal((await m.repos.sesiones.obtener(id)).estado, 'completa');
  await m.servicio.deshacerUltimaSerie(id);
  const sesion = await m.repos.sesiones.obtener(id);
  assert.equal(sesion.estado, 'en_curso');
  assert.equal(sesion.fin, null);

  const lunes = await montaje('2026-09-21T15:00:00Z');
  const sesionLunes = await lunes.servicio.iniciarSesion(1);
  await lunes.servicio.guardarSerie({ sesionId: sesionLunes, rutinaId: 101, numeroSerie: 1, peso: null, unidadPeso: 'corporal', lados: { izq: 30, der: 25 } });
  const deshecha = await lunes.servicio.deshacerUltimaSerie(sesionLunes);
  assert.deepEqual(deshecha.borrador.lados, { izq: 30, der: 25 });
  assert.equal((await lunes.repos.series.deSesion(sesionLunes)).length, 0);
});

test('frases del descanso: incluyen tu avance cuando el peso subió', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const semana1 = await m.servicio.iniciarSesion(1);
  await hacer(m, semana1, banca, 10);
  m.irA('2026-09-28T15:00:00Z');
  const semana2 = await m.servicio.iniciarSesion(1);
  for (let k = 1; k <= 3; k++) {
    m.avanzar();
    await m.servicio.guardarSerie({ sesionId: semana2, rutinaId: banca.id, numeroSerie: k, peso: 55, unidadPeso: 'kg', valor: 8 });
  }
  const frases = await m.servicio.frasesDescanso(() => 0.5);
  assert.equal(frases[0], 'Press de banca: hace 1 semana 50 kg. Hoy 55 kg.');
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

test('récord: la primera vez no; con más peso la semana siguiente sí; en empate o al corregir, no', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const semana1 = await m.servicio.iniciarSesion(1);
  assert.deepEqual((await hacer(m, semana1, banca, 10)).map((r) => r.record), [null, null, null]);

  m.irA('2026-09-28T15:00:00Z');
  const semana2 = await m.servicio.iniciarSesion(1);
  const guardar = (k, peso, valor) => {
    m.avanzar();
    return m.servicio.guardarSerie({ sesionId: semana2, rutinaId: banca.id, numeroSerie: k, peso, unidadPeso: 'kg', valor });
  };
  assert.deepEqual((await guardar(1, 55, 8)).record, { tipo: 'peso', valor: 55, unidad: 'kg' });
  assert.equal((await guardar(2, 55, 8)).record, null, 'empate');
  assert.equal((await guardar(2, 60, 8)).record, null, 'corregir nunca avisa');
});

test('si revisar el récord falla, la serie se guarda igual y el fallo queda anotado', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const fallos = [];
  const reposQueFallan = { ...m.repos, series: { ...m.repos.series, deRutinas: async () => { throw new Error('lectura rota'); } } };
  const servicio = crearServicioEntrenamiento({ repos: reposQueFallan, reloj: m.reloj, alFallar: (error, donde) => fallos.push([error.message, donde]) });
  const banca = porClave('press-de-banca');
  const id = await servicio.iniciarSesion(1);
  const r = await servicio.guardarSerie({ sesionId: id, rutinaId: banca.id, numeroSerie: 1, peso: 50, unidadPeso: 'kg', valor: 10 });
  assert.equal(r.record, null);
  assert.equal((await m.repos.series.deSesion(id)).length, 1, 'la serie quedó guardada');
  assert.deepEqual(fallos, [['lectura rota', 'récord']]);
});

test('avance: resumen, constancia, gráfica con la marca del aviso, y la semana pasada solo lunes y martes', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const semana1 = await m.servicio.iniciarSesion(1);
  const aviso = (await hacer(m, semana1, banca, 10)).at(-1).progresion;
  await m.servicio.aceptarProgresion({ sesionId: semana1, rutinaId: banca.id, propuesta: aviso });
  await m.servicio.terminarSesion(semana1);

  m.irA('2026-09-28T15:00:00Z'); // lunes de la W40
  const semana2 = await m.servicio.iniciarSesion(1);
  await hacer(m, semana2, banca, 8); // sale precargado con 55 kg
  const avance = crearServicioAvance({ repos: m.repos, reloj: m.reloj });
  const r = await avance.resumen();
  assert.deepEqual(r.semana.subio.map((s) => [s.clave, s.antes, s.ahora, s.unidad]), [['press-de-banca', 50, 55, 'kg']]);
  assert.deepEqual(r.semana.series, { hechas: 3, plan: 119 });
  assert.deepEqual(r.semanaPasada.dias, { hechos: 1, plan: 5 });
  assert.deepEqual(r.constancia.filas.map((f) => f.dias.map((d) => d.estado)), [
    ['hecho', 'no_hecho', 'no_hecho', 'no_hecho', 'no_hecho'],
    ['en_curso', 'por_venir', 'por_venir', 'por_venir', 'por_venir'],
  ]);
  assert.deepEqual(r.constancia.cerradas, { semanas: 1, hechos: 1, posibles: 5 });
  assert.equal(r.porDefecto, 'press-de-banca');
  assert.deepEqual(r.grupos.find((g) => g.grupo === 'Pecho'), { grupo: 'Pecho', actual: { hechas: 3, plan: 3 }, anterior: { hechas: 3, plan: 3 } });

  const g = await avance.ejercicio('press-de-banca');
  assert.deepEqual(g.puntos.map((p) => [p.fecha, p.peso]), [['2026-09-21', 50], ['2026-09-28', 55]]);
  assert.deepEqual(g.marcas.map((x) => [x.indice, x.avisos.length, x.avisos[0].peso]), [[0, 1, 55]]);
  assert.equal(g.records.peso.valor, 55);
  assert.equal(await avance.ejercicio('no-existe'), null);

  assert.equal((await avance.semanaPasadaParaInicio()).semana, '2026-W39');
  m.irA('2026-09-30T15:00:00Z'); // miércoles
  assert.equal(await avance.semanaPasadaParaInicio(), null);
});

test('medidas: sin perfil no hay % de grasa; con perfil, grasa, cintura/estatura, comparación y fotos', async () => {
  const repos = crearReposEnMemoria();
  const medidas = crearServicioMedidas({ repos, reloj: () => new Date('2026-09-26T16:00:00Z') });
  await medidas.guardar({ fecha: '2026-08-29', valores: { pesoCorporal: 81, cintura: 92, cuello: 40 }, fotosTomadas: true, nota: '' });
  await medidas.guardar({ fecha: '2026-09-26', valores: { pesoCorporal: 80, cintura: 90, cuello: 40 }, fotosTomadas: false, nota: '' });
  const sinPerfil = await medidas.datos();
  assert.equal(sinPerfil.perfil, null);
  assert.equal(sinPerfil.analisis.grasa, null, 'la fórmula no se supone');
  await assert.rejects(medidas.guardarPerfil({ estatura: 180, formula: 'otra' }));
  await assert.rejects(medidas.guardarPerfil({ estatura: 1.8, formula: 'hombre' }));

  await medidas.guardarPerfil({ estatura: 180, formula: 'hombre' });
  const { analisis } = await medidas.datos();
  assert.equal(analisis.grasa.fecha, '2026-09-26');
  assert.ok(Math.abs(analisis.grasa.valor - 18.37) < 0.05, String(analisis.grasa.valor));
  assert.deepEqual(analisis.cinturaEstatura, { valor: 0.5, fecha: '2026-09-26' });
  assert.equal(analisis.comparacion.antes, '2026-08-29');
  assert.deepEqual(analisis.comparacion.cambios.map((c) => [c.campo, c.cambio]), [['pesoCorporal', -1], ['cintura', -2], ['cuello', 0]]);
  assert.deepEqual(analisis.fotos, { toca: true, ultima: '2026-08-29', dias: 28 });
  assert.deepEqual(analisis.peso.map((p) => p.valor), [81, 80]);
});

test('respaldo: el recordatorio (nunca, y a los 8 días) y el TSV, que no cuenta como respaldo', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const id = await m.servicio.iniciarSesion(1);
  await hacer(m, id, porClave('press-de-banca'));
  const respaldo = crearServicioRespaldo({ repos: m.repos, reloj: m.reloj });
  assert.deepEqual(await respaldo.situacion(), { fecha: null, cuentas: await m.repos.contar(), dias: null, toca: true });

  const historial = await respaldo.exportarHistorial();
  assert.equal(historial.nombre, 'aaronfit-historial-2026-09-21.tsv');
  assert.equal(historial.texto.trimEnd().split('\n').length, 1 + 3);
  assert.equal(await respaldo.ultimo(), undefined, 'exportar el TSV no mueve la fecha del respaldo');

  await respaldo.exportar();
  const hoy = await respaldo.situacion();
  assert.deepEqual([hoy.fecha, hoy.dias, hoy.toca], ['2026-09-21', 0, false]);
  m.irA('2026-09-29T15:00:00Z');
  const despues = await respaldo.situacion();
  assert.deepEqual([despues.dias, despues.toca], [8, true]);
});

test('tanda 3: calentamiento solo en el primer ejercicio con barra del día y antes de su primera serie', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const inclinado = porClave('press-inclinado-con-barra');
  const id = await m.servicio.iniciarSesion(1);
  const datos = await m.servicio.datosEjercicio(id, banca.id);
  assert.equal(datos.implementoCarga, 'barra');
  assert.equal(datos.equipo.barra, 20);
  assert.deepEqual(datos.calentamiento.map((s) => [s.peso, s.reps]), [[20, 10], [25, 5], [35, 3]]); // trabajo: 50 kg
  assert.deepEqual((await m.servicio.datosEjercicio(id, inclinado.id)).calentamiento, [], 'el segundo con barra ya no');
  await hacer(m, id, banca, 10);
  assert.deepEqual((await m.servicio.datosEjercicio(id, banca.id)).calentamiento, [], 'con series hechas ya no');
});

test('tanda 3: nota por ejercicio (guardar y borrar) y aviso de estancamiento a las 3 semanas sin subir', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  const primera = await m.servicio.iniciarSesion(1);
  assert.deepEqual(await m.servicio.guardarNota(banca.clave, '  molestia en el hombro  '), { texto: 'molestia en el hombro', fecha: '2026-09-21' });
  assert.equal((await m.servicio.datosEjercicio(primera, banca.id)).nota.texto, 'molestia en el hombro');
  assert.equal(await m.servicio.guardarNota(banca.clave, ''), null);
  assert.equal(await m.repos.estado.leer(`nota:${banca.clave}`), undefined, 'la nota vacía se borra');

  // Cuatro lunes con 50 kg × 8: la primera sesión es la base; después, 3 semanas sin subir.
  await hacer(m, primera, banca, 8);
  for (const lunes of ['2026-09-28', '2026-10-05', '2026-10-12']) {
    m.irA(`${lunes}T15:00:00Z`);
    const id = await m.servicio.iniciarSesion(1);
    const { estancado } = await m.servicio.datosEjercicio(id, banca.id);
    if (lunes === '2026-10-12') assert.equal(estancado, null, 'antes de la tercera semana, todavía no');
    await hacer(m, id, banca, 8);
  }
  m.irA('2026-10-19T15:00:00Z');
  const id = await m.servicio.iniciarSesion(1);
  assert.deepEqual((await m.servicio.datosEjercicio(id, banca.id)).estancado, { semanas: 3, sesiones: 3, desde: '2026-09-21', estancado: true });
  const avance = crearServicioAvance({ repos: m.repos, reloj: m.reloj });
  assert.deepEqual((await avance.resumen()).estancados.map((e) => [e.clave, e.semanas]), [['press-de-banca', 3]]);
});

// Tanda 4: una rutina de 3 días como la devolvería la IA (con texto alrededor).
const RESPUESTA_IA = [
  'Aquí tienes tu rutina nueva:',
  '```tsv',
  COLUMNAS_RUTINA.join('\t'),
  ['LUNES - Fuerza A', '1', 'Pecho', 'Press de banca', 'Barra + banco plano + postes J', '-', '50 kg', '3', '8-10', '3', '2-3 min', 'Cuando hagas 10/10/10, sube 5 kg', 'https://musclewiki.com/exercise/barbell-bench-press', 'todas 10 +5 kg'].join('\t'),
  ['LUNES - Fuerza A', '2', 'Cara posterior', 'Face pull con cuerda', 'Polea a la altura de la cara', 'Cuerda', '12 kg', '3', '15-20', '2', '60 s', 'Cuando hagas 20/20/20, sube 2.5 kg', 'SIN LIGA', 'todas 20 +2.5 kg'].join('\t'),
  ['MIÉRCOLES - Fuerza B', '1', 'Espalda', 'Remo con barra', 'Barra', '-', '40 kg', '3', '8-10', '2', '2 min', 'Cuando hagas 10/10/10, sube 5 kg', 'https://inventada.com/remo', 'todas 10 +5 kg'].join('\t'),
  ['VIERNES - Fuerza C', '1', 'Cuádriceps', 'Sentadilla con barra', 'Barra + postes J', '-', '40 kg', '3', '8-10', '2', '3 min', 'Cuando hagas 10/10/10, sube 5 kg', 'SIN LIGA', 'todas 10 +5 kg'].join('\t'),
  ['SÁBADO - Caminata', '1', 'Caminata', 'Paseo con los perros', 'Ninguno', '-', '-', '1', '30 min', '-', '-', 'Ya lo haces; no cambiar nada', 'SIN LIGA', 'manual'].join('\t'),
  '```',
  '¡Éxito!',
].join('\n');

test('tanda 4: prompt, revisar, programar desde el lunes; el historial de press de banca sigue', async () => {
  const m = await montaje('2026-09-21T15:00:00Z'); // lunes W39
  const banca = porClave('press-de-banca');
  const semana1 = await m.servicio.iniciarSesion(1);
  const aviso = (await hacer(m, semana1, banca, 10)).at(-1).progresion;
  await m.servicio.aceptarProgresion({ sesionId: semana1, rutinaId: banca.id, propuesta: aviso }); // la próxima vez: 55 kg
  const plan = crearServicioPlan({
    repos: m.repos,
    reloj: m.reloj,
    ligasConVideo: async () => ['https://musclewiki.com/exercise/barbell-bench-press'],
    despuesDeCambiar: () => m.servicio.olvidarRutina(),
  });

  const { texto } = await plan.prompt({ queQuiero: 'Quiero entrenar 3 días', conMedidas: false });
  assert.match(texto, /## Lo que quiero\nQuiero entrenar 3 días/);
  assert.match(texto, /Press de banca \(lunes\): última vez 21 sep: 50 kg × 10, 50 kg × 10, 50 kg × 10; récord 50 kg\./);
  assert.ok(texto.includes(COLUMNAS_RUTINA.join('\t')), 'la rutina actual va en el formato de respuesta');
  assert.doesNotMatch(texto, /## Mis medidas/, 'sin medidas si así lo pides');

  const malo = await plan.revisar(RESPUESTA_IA.replace('50 kg', 'pesado'));
  assert.equal(malo.ok, false);
  assert.match(malo.errores[0], /^Renglón 2: Peso no reconocido/);

  const revision = await plan.revisar(RESPUESTA_IA);
  assert.equal(revision.ok, true);
  assert.equal(revision.numero, 2);
  assert.equal(revision.desde, '2026-W40');
  assert.deepEqual(revision.resumen, {
    dias: [
      { dia: 'LUNES - Fuerza A', ejercicios: 2 }, { dia: 'MIÉRCOLES - Fuerza B', ejercicios: 1 },
      { dia: 'VIERNES - Fuerza C', ejercicios: 1 }, { dia: 'SÁBADO - Caminata', ejercicios: 1 },
    ],
    diasFuerza: 3,
    diasCaminata: 1,
    ejercicios: 5,
    seriesSemana: 12,
  });
  assert.ok(revision.avisos.some((a) => a.startsWith('Renglón 4 (Remo con barra): la liga no es de la lista')));
  assert.ok(revision.avisos.includes('Face pull con cuerda: 12 kg no sale exacto con tus discos (10 kg o 15 kg).'));
  assert.deepEqual(revision.diferencias.nuevos, ['Remo con barra', 'Sentadilla con barra']);
  assert.equal(await m.repos.estado.leer('planes'), undefined, 'revisar no guarda nada');

  assert.deepEqual(await plan.programar(RESPUESTA_IA), { ok: true, numero: 2, desde: '2026-W40', avisos: revision.avisos });
  assert.equal((await m.repos.rutina.todas()).length, 43 + 5);

  // Lo que queda de esta semana sigue con tu rutina de siempre.
  m.irA('2026-09-22T15:00:00Z'); // martes W39
  assert.equal((await m.servicio.resumenInicio()).hoyToca.nombre, 'MARTES - Pierna A');

  // El lunes entra la nueva: 3 días de fuerza y caminata el sábado.
  m.irA('2026-09-28T15:00:00Z');
  const inicio = await m.servicio.resumenInicio();
  assert.equal(inicio.hoyToca.nombre, 'LUNES - Fuerza A');
  assert.equal(inicio.semanaPrograma, 1);
  assert.deepEqual(inicio.dias.map((d) => d.dia), [1, 3, 5, 6]);
  const lunes = await m.servicio.iniciarSesion(1);
  const dia = await m.servicio.datosDia(lunes);
  assert.deepEqual(dia.ejercicios.map((x) => x.ejercicio.id), [2101, 2102]);
  const { precarga } = await m.servicio.datosEjercicio(lunes, 2101);
  assert.deepEqual(precarga.map((p) => [p.peso, p.valor]), [[55, 8], [55, 8], [55, 8]], 'el aviso aceptado en la rutina 1 sigue');

  const avance = crearServicioAvance({ repos: m.repos, reloj: m.reloj });
  const r = await avance.resumen();
  assert.deepEqual(r.semana.dias, { hechos: 0, plan: 3 });
  assert.deepEqual(r.semana.series, { hechas: 0, plan: 12 });
});

test('tanda 4: la rutina programada se puede reemplazar o quitar antes de que empiece', async () => {
  const m = await montaje('2026-09-23T15:00:00Z'); // miércoles W39
  const plan = crearServicioPlan({ repos: m.repos, reloj: m.reloj, despuesDeCambiar: () => m.servicio.olvidarRutina() });
  await plan.programar(RESPUESTA_IA);
  const otra = RESPUESTA_IA.replace('Remo con barra', 'Remo Pendlay');
  const reemplazo = await plan.programar(otra);
  assert.equal(reemplazo.numero, 2, 'reemplaza a la programada, no crea otra');
  const rutina = await m.repos.rutina.todas();
  assert.equal(rutina.length, 43 + 5);
  assert.ok(rutina.some((r) => r.ejercicio === 'Remo Pendlay'));
  assert.equal((await plan.situacion()).programado.numero, 2);

  assert.deepEqual(await plan.quitarProgramada(), { ok: true });
  assert.equal((await m.repos.rutina.todas()).length, 43);
  assert.equal((await plan.situacion()).programado, null);
  assert.equal((await plan.quitarProgramada()).ok, false);
});

test('nombres entre rutinas: el prompt los lleva; si la IA cambia uno, la app pregunta y no programa sin respuesta', async () => {
  const m = await montaje('2026-09-21T15:00:00Z');
  const banca = porClave('press-de-banca');
  await hacer(m, await m.servicio.iniciarSesion(1), banca, 10);
  const plan = crearServicioPlan({ repos: m.repos, reloj: m.reloj, despuesDeCambiar: () => m.servicio.olvidarRutina() });

  const { texto } = await plan.prompt({ conMedidas: false });
  const seccion = texto.split('## Ejercicios que ya tengo (nombres fijos)\n')[1].split('\n## ')[0];
  assert.equal(seccion.split('\n').filter((l) => l.startsWith('- ')).length, 34, 'tus 34 nombres');
  assert.ok(seccion.includes('\n- Press de banca\n') && seccion.includes('\n- Elevación lateral\n'));
  assert.doesNotMatch(seccion, /De rutinas anteriores/, 'con una sola rutina no hay anteriores');

  // La IA escribe «Press bank»: la app pregunta y no deja programar.
  const conError = RESPUESTA_IA.replace('Press de banca', 'Press bank');
  const duda = await plan.revisar(conError);
  assert.equal(duda.ok, true);
  assert.equal(duda.pendientes, 1);
  assert.deepEqual(duda.nombres.filter((n) => n.parecidos.length), [{ nombre: 'Press bank', parecidos: ['Press de banca'], decision: undefined }]);
  assert.equal(duda.conocidos.length, 34);
  assert.deepEqual(await plan.programar(conError), { ok: false, errores: ['Falta contestar si un nombre es de un ejercicio que ya tienes.'], avisos: duda.avisos });
  assert.equal(await m.repos.estado.leer('planes'), undefined, 'no se guardó nada');

  // «No, es otro»: empieza sin historial.
  const otro = await plan.revisar(conError, { equivalencias: { 'Press bank': null } });
  assert.equal(otro.pendientes, 0);
  assert.ok(otro.diferencias.nuevos.includes('Press bank'));

  // «Sí, es Press de banca»: se escribe tu nombre y sigue su historial.
  const opciones = { equivalencias: { 'Press bank': 'Press de banca' } };
  const mismo = await plan.revisar(conError, opciones);
  assert.equal(mismo.pendientes, 0);
  assert.deepEqual([mismo.renglones[0].ejercicio, mismo.renglones[0].clave], ['Press de banca', 'press-de-banca']);
  assert.ok(!mismo.diferencias.nuevos.includes('Press bank') && mismo.diferencias.cambian.some((c) => c.ejercicio === 'Press de banca'));
  assert.equal((await plan.programar(conError, opciones)).ok, true);
  const guardado = (await m.repos.rutina.todas()).find((r) => r.id === 2101);
  assert.deepEqual([guardado.ejercicio, guardado.clave], ['Press de banca', 'press-de-banca']);

  // Mayúsculas y acentos no cuentan: se guarda tu nombre como siempre, sin preguntar.
  const minusculas = await plan.revisar(RESPUESTA_IA.replace('Press de banca', 'press de banca').replace('Face pull con cuerda', 'FACE PULL CON CUERDA'));
  assert.deepEqual(minusculas.nombres.map((n) => n.nombre), ['Remo con barra', 'Sentadilla con barra']);
  assert.deepEqual(minusculas.renglones.slice(0, 2).map((r) => r.ejercicio), ['Press de banca', 'Face pull con cuerda']);
});

test('tanda 3: tu equipo y tus preferencias, guardados en estado', async () => {
  const repos = crearReposEnMemoria();
  const ajustes = crearServicioAjustes({ repos });
  assert.equal((await ajustes.equipo()).maneral, 0, 'el mango de aluminio no cuenta');
  await ajustes.guardarEquipo({ maneral: 5 });
  const equipo = await ajustes.equipo();
  assert.equal(equipo.maneral, 5);
  assert.equal(equipo.barra, 20, 'lo que no cambiaste se queda');
  assert.deepEqual(await ajustes.preferencias(), { voz: false, respiracion: true }, 'la voz viene apagada; la guía de respiración, encendida');
  assert.deepEqual(await ajustes.guardarPreferencias({ voz: true }), { voz: true, respiracion: true });
  assert.deepEqual(await ajustes.guardarPreferencias({ respiracion: false }), { voz: true, respiracion: false });
});
