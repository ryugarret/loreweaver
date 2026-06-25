import { db } from './db'
import { exportAll } from './repo'

/**
 * Guardado en DISCO REAL (no solo IndexedDB): vincula un archivo `.json` con la
 * File System Access API (Chrome/Edge) y lo mantiene al día automáticamente en
 * cada cambio (debounced). El handle se persiste en `kv`, así que sobrevive a
 * las recargas; tras recargar hace falta un clic para reotorgar permiso
 * (limitación del navegador). En Firefox/Safari no hay API → se usa el guardado
 * manual ("Guardar/Abrir copia").
 */

/**
 * off      = sin archivo vinculado
 * active   = vinculado y guardando bien
 * saving   = escribiendo en este momento
 * paused   = vinculado pero el permiso se perdió al recargar (se puede reanudar)
 * denied   = el navegador denegó el permiso → NO se puede autoguardar aquí
 * error    = falló la escritura (disco lleno, archivo movido…)
 */
export type DiskState = 'off' | 'active' | 'saving' | 'paused' | 'denied' | 'error'

export interface DiskStatus {
  supported: boolean
  fileName: string | null
  state: DiskState
  lastSavedAt: number | null
}

function fsaSupported(): boolean {
  return typeof (window as unknown as { showSaveFilePicker?: unknown })
    .showSaveFilePicker === 'function'
}

let status: DiskStatus = {
  supported: fsaSupported(),
  fileName: null,
  state: 'off',
  lastSavedAt: null,
}
const listeners = new Set<() => void>()
function emit() {
  for (const l of listeners) l()
}
function setStatus(p: Partial<DiskStatus>) {
  status = { ...status, ...p }
  emit()
}
export function subscribeDisk(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function getDiskStatus(): DiskStatus {
  return status
}

// El handle no está siempre tipado según la versión de lib DOM → `any` pragmático.
/* eslint-disable @typescript-eslint/no-explicit-any */
let handle: any = null
let dirty = false
let saveTimer: number | null = null
let hooksRegistered = false

const PICKER_TYPES = [
  {
    description: 'Copia de Loreweaver',
    accept: { 'application/json': ['.json'] },
  },
]

function suggestedName(): string {
  return `loreweaver-${new Date().toISOString().slice(0, 10)}.json`
}

function registerHooks() {
  if (hooksRegistered) return
  hooksRegistered = true
  const mark = () => {
    dirty = true
    scheduleSave()
  }
  db.tables.forEach((t) => {
    if (t.name === 'kv') return // escribir el handle no debe disparar guardado
    t.hook('creating', mark)
    t.hook('updating', mark)
    t.hook('deleting', mark)
  })
}

function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void flush(), 4000)
}

async function flush() {
  if (!handle || !dirty) return
  const perm = await handle.queryPermission?.({ mode: 'readwrite' })
  if (perm !== 'granted') {
    setStatus({ state: perm === 'denied' ? 'denied' : 'paused' })
    return
  }
  try {
    setStatus({ state: 'saving' })
    const json = await exportAll()
    const writable = await handle.createWritable()
    await writable.write(json)
    await writable.close()
    dirty = false
    setStatus({ state: 'active', lastSavedAt: Date.now() })
  } catch {
    setStatus({ state: 'error' })
  }
}

/** Carga el handle guardado al arrancar y comprueba el permiso. */
export async function initDiskSync(): Promise<void> {
  if (!status.supported) return
  const row = await db.kv.get('backupHandle')
  handle = (row?.value as any) ?? null
  if (!handle) return
  const perm = await handle.queryPermission?.({ mode: 'readwrite' })
  setStatus({
    fileName: handle.name ?? null,
    state: perm === 'granted' ? 'active' : perm === 'denied' ? 'denied' : 'paused',
  })
  if (perm === 'granted') registerHooks()
}

/** Pide al usuario un archivo y lo vincula (guardado inmediato + auto-guardado). */
export async function linkBackupFile(): Promise<boolean> {
  const w = window as any
  if (typeof w.showSaveFilePicker !== 'function') return false
  try {
    handle = await w.showSaveFilePicker({
      suggestedName: suggestedName(),
      types: PICKER_TYPES,
    })
    await db.kv.put({ key: 'backupHandle', value: handle })
    setStatus({ fileName: handle.name ?? null, state: 'active' })
    registerHooks()
    dirty = true
    await flush()
    return true
  } catch {
    return false // el usuario canceló u otro error
  }
}

/** Reanuda tras recargar: pide el permiso (requiere gesto). Si lo deniegan,
 *  marca 'denied' (no se puede autoguardar aquí) en vez de insistir. */
export async function reconnectBackupFile(): Promise<boolean> {
  if (!handle) return false
  const perm = await handle.requestPermission?.({ mode: 'readwrite' })
  if (perm === 'granted') {
    setStatus({ state: 'active' })
    registerHooks()
    dirty = true
    await flush()
    return true
  }
  setStatus({ state: 'denied' })
  return false
}

export async function unlinkBackupFile(): Promise<void> {
  // Cancelar cualquier guardado pendiente para que NO se escriba después de
  // desvincular (clave al "Borrar todo": si no, sobreescribiría el archivo con
  // datos vacíos 4 s más tarde).
  if (saveTimer) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  dirty = false
  handle = null
  await db.kv.delete('backupHandle')
  setStatus({ fileName: null, state: 'off' })
}

/** Fuerza un guardado inmediato en el archivo vinculado. */
export async function saveToDiskNow(): Promise<void> {
  dirty = true
  await flush()
}
/* eslint-enable @typescript-eslint/no-explicit-any */
