// Reglas de arquitectura (encargo sección 2), revisadas en el código:
// - logica/ es pura: solo importa logica/ y no toca DOM, red ni almacenamiento.
// - La pantalla (vistas/, componentes/, app.js) NUNCA importa datos/.
// - datos/ no conoce a nadie de arriba; servicios/ no conoce la pantalla.
// - Todo import relativo termina en .js y apunta a un archivo que existe
//   (el navegador no adivina extensiones).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const JS = fileURLToPath(new URL('../docs/js/', import.meta.url));

function archivos(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(carpeta, e.name)) : e.name.endsWith('.js') ? [join(carpeta, e.name)] : [],
  );
}

const sinComentarios = (codigo) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function importaciones(archivo) {
  const codigo = sinComentarios(readFileSync(archivo, 'utf8'));
  const rutas = [...codigo.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)];
  return rutas.map((m) => m[1] ?? m[2]);
}

const capa = (archivo) => {
  const partes = relative(JS, archivo).split(sep);
  return partes.length > 1 ? partes[0] : 'app';
};

const modulos = archivos(JS).map((archivo) => ({
  archivo,
  nombre: relative(JS, archivo).split(sep).join('/'),
  capa: capa(archivo),
  importa: importaciones(archivo).map((ruta) => ({ ruta, destino: resolve(dirname(archivo), ruta) })),
}));

const PROHIBIDO = {
  logica: ['datos', 'servicios', 'vistas', 'componentes', 'plataforma', 'app'],
  datos: ['servicios', 'vistas', 'componentes', 'plataforma', 'app'],
  servicios: ['vistas', 'componentes', 'app'],
  plataforma: ['datos', 'servicios', 'vistas', 'componentes', 'app'],
  componentes: ['datos', 'servicios', 'vistas', 'app'],
  vistas: ['datos', 'app'],
  app: ['datos'],
};

test('hay módulos en todas las capas esperadas', () => {
  const capas = new Set(modulos.map((m) => m.capa));
  for (const c of ['logica', 'datos', 'servicios']) assert.ok(capas.has(c), c);
});

// config.js es una hoja: todas las capas pueden leerla y ella no importa nada.
const CONFIG = resolve(JS, 'config.js');

test('config.js es una hoja: no importa nada', () => {
  const config = modulos.find((m) => m.archivo === CONFIG);
  assert.ok(config, 'existe docs/js/config.js');
  assert.deepEqual(config.importa, []);
});

test('ninguna capa importa de una capa que no le toca', () => {
  for (const m of modulos) {
    for (const { ruta, destino } of m.importa) {
      if (!ruta.startsWith('.') || destino === CONFIG) continue;
      const destinoCapa = capa(destino);
      assert.ok(!(PROHIBIDO[m.capa] ?? []).includes(destinoCapa), `${m.nombre} importa ${ruta} (${m.capa} → ${destinoCapa})`);
    }
  }
});

test('logica/ es pura: no toca DOM, red, almacenamiento ni reloj del sistema', () => {
  const impuro = /\b(document|window|indexedDB|localStorage|sessionStorage|navigator|fetch|setTimeout|setInterval)\b|Date\.now\(|new Date\(\)/;
  for (const m of modulos.filter((x) => x.capa === 'logica')) {
    const codigo = sinComentarios(readFileSync(m.archivo, 'utf8'));
    // fechaLocal(instante = new Date()) es el único adaptador permitido.
    const revisable = codigo.replace('export function fechaLocal(instante = new Date())', '');
    assert.doesNotMatch(revisable, impuro, m.nombre);
  }
});

test('todo import relativo lleva .js y el archivo existe', () => {
  for (const m of modulos) {
    for (const { ruta, destino } of m.importa) {
      if (!ruta.startsWith('.')) continue;
      assert.ok(ruta.endsWith('.js') || ruta.endsWith('.json'), `${m.nombre}: "${ruta}" sin extensión`);
      assert.ok(existsSync(destino), `${m.nombre}: "${ruta}" no existe`);
    }
  }
});
