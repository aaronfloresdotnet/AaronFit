// El service worker guarda TODOS los archivos de la app y su versión es la
// huella del contenido actual. Si falla: node herramientas/versionar-sw.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bloque, calcular, leerBloqueActual } from '../herramientas/versionar-sw.js';

test('sw.js lista todos los archivos de la app y su versión corresponde al contenido actual', () => {
  const esperado = bloque(calcular());
  assert.equal(leerBloqueActual(), esperado, 'Corre: node herramientas/versionar-sw.js');
});

test('la lista incluye lo indispensable para abrir sin internet', () => {
  const { archivos } = calcular();
  for (const indispensable of ['./', './index.html', './manifest.webmanifest', './css/estilos.css', './js/app.js', './js/datos/videos.json', './iconos/icono-192.png']) {
    assert.ok(archivos.includes(indispensable), indispensable);
  }
  assert.ok(!archivos.includes('./sw.js'));
});
