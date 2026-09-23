// Repositorios en memoria con la misma interfaz que docs/js/datos/repos.js.
// Sirven para probar los casos de uso (servicios/) sin IndexedDB.
// Lo que NO reproducen: transacciones reales, modos de solo lectura ni índices.

const copia = (x) => (x === undefined ? undefined : structuredClone(x));

export function crearReposEnMemoria() {
  const tablas = { rutina: [], sesiones: [], series: [], medidas: [], estado: new Map() };
  const siguiente = { sesiones: 1, series: 1, medidas: 1 };

  function poner(tabla, registro) {
    const r = copia(registro);
    if (r.id === undefined) r.id = siguiente[tabla]++;
    const i = tablas[tabla].findIndex((x) => x.id === r.id);
    if (i >= 0) tablas[tabla][i] = r;
    else tablas[tabla].push(r);
    return r.id;
  }

  const donde = (tabla, filtro) => copia(tablas[tabla].filter(filtro));

  const repos = {
    tablas,
    rutina: {
      todas: async () => copia(tablas.rutina),
      sembrar: async (renglones, version) => {
        for (const r of renglones) {
          const i = tablas.rutina.findIndex((x) => x.id === r.id);
          if (i >= 0) tablas.rutina[i] = copia(r);
          else tablas.rutina.push(copia(r));
        }
        tablas.estado.set('versionSemilla', version);
      },
    },
    sesiones: {
      obtener: async (id) => copia(tablas.sesiones.find((s) => s.id === id)),
      todas: async () => copia(tablas.sesiones),
      deSemana: async (semana) => donde('sesiones', (s) => s.semanaISO === semana),
      enCurso: async () => donde('sesiones', (s) => s.estado === 'en_curso'),
      guardar: async (sesion) => poner('sesiones', sesion),
    },
    series: {
      deSesion: async (id) => donde('series', (s) => s.sesionId === id),
      deRutinas: async (ids) => donde('series', (s) => ids.includes(s.rutinaId)),
    },
    guardarCaptura: async ({ nuevas, borrar = [], sesion }) => {
      tablas.series = tablas.series.filter((s) => !borrar.includes(s.id));
      const ids = nuevas.map((n) => poner('series', n));
      if (sesion) poner('sesiones', sesion);
      return ids;
    },
    deshacerCaptura: async ({ borrarSeries, sesion, borrarEstado = [] }) => {
      tablas.series = tablas.series.filter((s) => !borrarSeries.includes(s.id));
      if (sesion) poner('sesiones', sesion);
      for (const llave of borrarEstado) tablas.estado.delete(llave);
    },
    medidas: {
      todas: async () => copia(tablas.medidas),
      porFecha: async (fecha) => donde('medidas', (m) => m.fecha === fecha),
      deSemana: async (semana) => donde('medidas', (m) => m.semanaISO === semana),
      guardar: async (medida) => poner('medidas', medida),
    },
    estado: {
      leer: async (llave) => copia(tablas.estado.get(llave)),
      escribir: async (llave, valor) => {
        tablas.estado.set(llave, copia(valor));
      },
      escribirVarias: async (pares) => {
        for (const [llave, valor] of pares) tablas.estado.set(llave, copia(valor));
      },
    },
    leerTodo: async () => ({
      rutina: copia(tablas.rutina),
      sesiones: copia(tablas.sesiones),
      series: copia(tablas.series),
      medidas: copia(tablas.medidas),
      estado: [...tablas.estado].map(([llave, valor]) => ({ llave, valor: copia(valor) })),
    }),
    contar: async () => ({
      rutina: tablas.rutina.length,
      sesiones: tablas.sesiones.length,
      series: tablas.series.length,
      medidas: tablas.medidas.length,
      estado: tablas.estado.size,
    }),
    reemplazarTodo: async (colecciones) => {
      repos.reemplazos = (repos.reemplazos ?? 0) + 1;
      tablas.rutina = copia(colecciones.rutina);
      tablas.sesiones = copia(colecciones.sesiones);
      tablas.series = copia(colecciones.series);
      tablas.medidas = copia(colecciones.medidas);
      tablas.estado = new Map(colecciones.estado.map((e) => [e.llave, copia(e.valor)]));
    },
  };
  return repos;
}
