// Configuración de la variante de la app. Es una hoja: cualquier capa puede
// importarla y ella no importa nada. Aquí van los valores de producción;
// herramientas/empaquetar.js reescribe este archivo al armar la beta.
// La beta vive en el mismo dominio (github.io): se separa POR NOMBRE de base
// de datos y de caché, no por un aislamiento del navegador.

export const CONFIG = Object.freeze({
  variante: 'prod',
  nombre: 'AaronFit',
  nombreBD: 'entrena',
  prefijoCache: 'aaronfit-',
  version: 'produccion',
});
