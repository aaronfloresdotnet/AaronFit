// Capa de aplicación: tu equipo (calculadora de discos) y tus preferencias
// del descanso (voz, guía de respiración y aviso con la pantalla apagada).
// Todo va en `estado`; no cambia la base.

import { normalizarEquipo } from '../logica/equipo.js';

// La voz empieza apagada (tanda 3); la guía de respiración, encendida: la pediste (2026-09-23).
// El aviso con la pantalla apagada (2026-09-27), apagado: encenderlo pide permiso de notificaciones.
export const PREFERENCIAS_INICIALES = Object.freeze({ voz: false, respiracion: true, avisoPantallaApagada: false });

export function crearServicioAjustes({ repos }) {
  /** Tu equipo guardado, completado con el inicial. */
  const equipo = async () => normalizarEquipo(await repos.estado.leer('equipo'));

  async function guardarEquipo(cambios) {
    const nuevo = normalizarEquipo({ ...(await equipo()), ...cambios });
    await repos.estado.escribir('equipo', nuevo);
    return nuevo;
  }

  const preferencias = async () => ({ ...PREFERENCIAS_INICIALES, ...((await repos.estado.leer('preferencias')) ?? {}) });

  async function guardarPreferencias(cambios) {
    const nuevas = { ...(await preferencias()), ...cambios };
    await repos.estado.escribir('preferencias', nuevas);
    return nuevas;
  }

  return { equipo, guardarEquipo, preferencias, guardarPreferencias };
}
