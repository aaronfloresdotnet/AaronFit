// Plataforma: bajar, compartir y leer archivos (respaldo).

/** Descarga `texto` como archivo; en Android queda en la carpeta Descargas. */
export function descargar(nombre, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * ¿Este teléfono puede mandar un archivo de texto con su menú de compartir?
 * (Web Share con archivos, 2026-09-27). Chrome en Android no comparte .json;
 * .txt sí (lista de tipos permitidos en el código de Chromium).
 */
export function puedeCompartir() {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([''], 'respaldo.txt', { type: 'text/plain' })] }));
  } catch {
    return false;
  }
}

/**
 * Abre el menú de compartir con `texto` como archivo. El navegador lo exige
 * pocos segundos después de un toque.
 * @returns {Promise<boolean>} true si se compartió; false si cerraste el menú.
 */
export async function compartir(nombre, texto, tipo = 'text/plain') {
  try {
    await navigator.share({ files: [new File([texto], nombre, { type: tipo })] });
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    throw error;
  }
}

export const leerTexto = (archivo) => archivo.text();
