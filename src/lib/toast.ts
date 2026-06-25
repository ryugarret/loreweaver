/**
 * Sistema de avisos (toasts) mínimo y sin dependencias. Cualquier acción
 * (guardar, exportar, borrar…) puede dar feedback con `toast(...)`. El `<Toaster>`
 * (montado una vez en App) los muestra. Store externo para `useSyncExternalStore`.
 */
export type ToastKind = 'ok' | 'error' | 'info'

export interface Toast {
  id: number
  text: string
  kind: ToastKind
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function subscribeToasts(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function getToasts(): Toast[] {
  return toasts
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast(text: string, kind: ToastKind = 'ok'): void {
  const id = nextId++
  toasts = [...toasts, { id, text, kind }]
  emit()
  window.setTimeout(() => dismissToast(id), 3500)
}
