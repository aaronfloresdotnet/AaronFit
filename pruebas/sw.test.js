// El service worker guarda TODOS los archivos de la app y su versión es la
// huella del contenido actual. Si falla: node herramientas/versionar-sw.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
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
