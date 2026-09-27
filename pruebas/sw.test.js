// El service worker guarda TODOS los archivos de la app y su versión es la
// huella del contenido actual. Si falla: node herramientas/versionar-sw.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { bloque, calcular, DOCS, leerBloqueActual } from '../herramientas/versionar-sw.js';

test('sw.js lista todos los archivos de la app y su versión corresponde al contenido actual', () => {
  assert.equal(leerBloqueActual(), bloque(calcular()), 'Corre: node herramientas/versionar-sw.js');
});

test('la lista incluye lo indispensable para abrir sin internet', () => {
  const { archivos } = calcular();
  for (const indispensable of ['./', './index.html', './manifest.webmanifest', './css/estilos.css', './js/app.js', './js/config.js', './js/datos/videos.json', './iconos/icono-192.png']) {
    assert.ok(archivos.includes(indispensable), indispensable);
  }
  assert.ok(!archivos.includes('./sw.js'));
});

test('producción usa el prefijo aaronfit- y la limpieza de caché solo toca ese prefijo', () => {
  const { prefijo, version } = calcular();
  assert.equal(prefijo, 'aaronfit-');
  assert.match(version, /^aaronfit-[0-9a-f]{12}$/);
  const sw = readFileSync(`${DOCS}sw.js`, 'utf8');
  assert.match(sw, /n\.startsWith\(PREFIJO\) && n !== VERSION/);
  assert.doesNotMatch(sw.replace(/\/\/ <archivos>[\s\S]*?\/\/ <\/archivos>/, ''), /'aaronfit-/, 'fuera del bloque generado no debe haber prefijos escritos a mano');
});

test('el prefijo de la beta no empieza con el de producción (la v1.0 del cel borra todo lo que empiece con aaronfit-)', () => {
  const beta = 'beta-aaronfit-';
  assert.ok(!beta.startsWith('aaronfit-'));
  assert.ok(!'aaronfit-'.startsWith(beta));
});

// Aviso con la pantalla apagada (2026-09-27): sw.js corre aquí en una caja
// aparte, con un `self` de mentira. Cubre cuándo se muestra, se calla o se
// cancela; NO cubre a Android (si la retrasa o la calla): eso solo en el cel.
function cargarSW({ ventanas = [] } = {}) {
  const oyentes = {};
  const mostradas = [];
  const cerradas = [];
  const self = {
    addEventListener: (tipo, fn) => {
      oyentes[tipo] = fn;
    },
    clients: { matchAll: async () => ventanas, openWindow: async () => null },
    registration: {
      showNotification: async (titulo, opciones) => {
        mostradas.push({ titulo, cuerpo: opciones.body, etiqueta: opciones.tag });
      },
      getNotifications: async () => mostradas.map((m) => ({ close: () => cerradas.push(m) })),
    },
  };
  vm.runInNewContext(readFileSync(`${DOCS}sw.js`, 'utf8'), { self, caches: {}, fetch: () => {}, setTimeout, clearTimeout, Date, URL });
  /** Manda un mensaje como lo haría la página y devuelve lo que el evento dejó pendiente. */
  const enviar = (data) => {
    const pendientes = [];
    oyentes.message({ data, waitUntil: (p) => pendientes.push(p) });
    return Promise.all(pendientes);
  };
  return { enviar, mostradas, cerradas };
}

const programar = (ms, cuerpo = 'Sigue: serie 2 · 55 kg × 8') => ({ tipo: 'programar-aviso', finEn: Date.now() + ms, titulo: '¡A darle! Terminó el descanso', cuerpo });

test('aviso: con la pantalla apagada sale al terminar el descanso, con la siguiente serie', async () => {
  const sw = cargarSW({ ventanas: [{ visibilityState: 'hidden', focused: false }] });
  await sw.enviar(programar(20));
  assert.equal(sw.mostradas.length, 1);
  assert.equal(sw.mostradas[0].titulo, '¡A darle! Terminó el descanso');
  assert.equal(sw.mostradas[0].cuerpo, 'Sigue: serie 2 · 55 kg × 8');
  assert.equal(sw.mostradas[0].etiqueta, 'fin-descanso');
});

test('aviso: si la app se ve en pantalla no sale (ya suena el timbre), aunque diga que no tiene el foco', async () => {
  for (const focused of [true, false]) {
    const sw = cargarSW({ ventanas: [{ visibilityState: 'visible', focused }] });
    await sw.enviar(programar(20));
    assert.equal(sw.mostradas.length, 0, `focused: ${focused}`);
  }
});

test('aviso: saltar o deshacer lo cancela; un descanso nuevo reemplaza al anterior; callarlo quita el que salió', async () => {
  const sw = cargarSW();
  const pendiente = sw.enviar(programar(40));
  await sw.enviar({ tipo: 'cancelar-aviso' });
  await pendiente;
  assert.equal(sw.mostradas.length, 0, 'cancelado antes de tiempo');

  const primero = sw.enviar(programar(40, 'el viejo'));
  await sw.enviar(programar(20, 'el nuevo'));
  await primero;
  assert.deepEqual(sw.mostradas.map((m) => m.cuerpo), ['el nuevo']);

  await sw.enviar({ tipo: 'cancelar-aviso' });
  assert.equal(sw.cerradas.length, 1, 'al callar el descanso en la app, se quita la notificación');
});
