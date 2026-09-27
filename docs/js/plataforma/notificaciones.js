// Plataforma: aviso de fin de descanso con la pantalla apagada (Aarón, 2026-09-27).
// Con la pantalla apagada Android congela la página, pero no al service worker:
// al empezar el descanso la página le encarga una notificación para la hora de
// fin, y la cancela si saltas o deshaces el descanso, o al cerrarlo cuando
// vuelves. Si estás viendo la app no sale: ya suena el timbre (lo decide sw.js).
// No está garantizado: Android puede retrasarla o callarla (ahorro de batería).
// El permiso es por sitio: la beta y la app real comparten sitio y permiso.

export function crearNotificaciones() {
  const soportado = typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
  let cola = Promise.resolve(); // los mensajes llegan al service worker en el orden en que se mandan
  let encargado = false;

  function enviar(mensaje) {
    cola = cola
      .then(() => navigator.serviceWorker.getRegistration())
      .then((registro) => registro?.active?.postMessage(mensaje))
      .catch(() => {});
  }

  return {
    /** 'granted', 'denied', 'default' o 'no-soportado'. */
    get permiso() {
      return soportado ? Notification.permission : 'no-soportado';
    },

    /** Pide permiso; llamar dentro de un toque. true si quedó concedido. */
    async pedirPermiso() {
      if (!soportado) return false;
      if (Notification.permission === 'granted') return true;
      return (await Notification.requestPermission()) === 'granted';
    },

    /** Encarga la notificación para `finEn` (milisegundos, como Date.now()). */
    programar(finEn, { titulo, cuerpo }) {
      if (!soportado || Notification.permission !== 'granted') return;
      encargado = true;
      enviar({ tipo: 'programar-aviso', finEn, titulo, cuerpo });
    },

    /** Cancela la que esté pendiente y quita la que ya se mostró. */
    cancelar() {
      if (!encargado) return;
      encargado = false;
      enviar({ tipo: 'cancelar-aviso' });
    },
  };
}
