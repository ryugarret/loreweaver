/**
 * Registro del "flush" del editor de capítulo activo. El editor autoguarda con
 * debounce (500 ms); cualquier acción que lea el contenido (exportar, etc.) debe
 * forzar antes este flush para no leer texto viejo. Solo hay un editor montado a
 * la vez, así que basta una referencia.
 */
let activeFlush: (() => Promise<void>) | null = null

export function setActiveEditorFlush(fn: (() => Promise<void>) | null): void {
  activeFlush = fn
}

export async function flushActiveEditor(): Promise<void> {
  if (activeFlush) await activeFlush()
}
