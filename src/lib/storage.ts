/**
 * Persistencia local: pide al navegador que NO desaloje los datos.
 * Por defecto IndexedDB es "best-effort" y el navegador puede borrarlo bajo
 * presión de disco. persist() solicita almacenamiento duradero (no garantiza,
 * pero reduce mucho el riesgo). Fuente: web.dev/persistent-storage.
 */

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* ignore */
  }
  return false
}

export interface StorageInfo {
  persisted: boolean
  usageMB: number
  quotaMB: number
}

export async function storageInfo(): Promise<StorageInfo> {
  let persisted = false
  let usageMB = 0
  let quotaMB = 0
  try {
    if (navigator.storage?.persisted) persisted = await navigator.storage.persisted()
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      usageMB = Math.round(((est.usage ?? 0) / 1048576) * 10) / 10
      quotaMB = Math.round((est.quota ?? 0) / 1048576)
    }
  } catch {
    /* ignore */
  }
  return { persisted, usageMB, quotaMB }
}
