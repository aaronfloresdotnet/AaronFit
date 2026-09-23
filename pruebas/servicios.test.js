// Casos de uso (capa de aplicación) con repositorios en memoria y reloj fijo.
// Cubren la orquestación: cuándo sale el aviso, qué se precarga después de
// aceptarlo, correcciones, por lado, terminar a medias, recorrer, medidas,
// respaldo y (tanda 2) récords, avance y perfil. NO cubren IndexedDB real:
// eso se probó en el navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RUTINA, VERSION_SEMILLA } from '../docs/js/datos/semilla.js';
import { crearServicioAvance } from '../docs/js/servicios/avance.js';
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
  assert.deepEqual(r.grupos.find((g) => g.grupo === 'Pecho'), { grupo: 'Pecho', plan: 3, actual: 3, anterior: 3 });

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
