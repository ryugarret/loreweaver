import { exportAll } from './repo'

/**
 * Guardar/abrir la copia de seguridad como ARCHIVO REAL en disco con la File
 * System Access API (Chrome/Edge). Si el navegador no la soporta (Firefox,
 * Safari), cae a descarga / input de archivo. Mantiene el handle del archivo
 * durante la sesión para que "Guardar copia" sobrescriba el mismo archivo sin
 * volver a preguntar (no se persiste entre recargas).
 */

type PickerWindow = typeof window & {
  showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>
  showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>
}

// El handle no está siempre tipado según la versión de lib DOM → `any` pragmático.
let linkedHandle: any = null

const JSON_TYPES = [
  {
    description: 'Copia de Loreweaver',
    accept: { 'application/json': ['.json'] },
  },
]

function suggestedName(): string {
  return `loreweaver-backup-${new Date().toISOString().slice(0, 10)}.json`
}

export function linkedFileName(): string | null {
  return linkedHandle?.name ?? null
}

function download(json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName()
  a.click()
  URL.revokeObjectURL(url)
}

export type SaveResult = 'saved' | 'downloaded' | 'cancelled'

/** Guarda la copia en disco (mismo archivo si ya hay uno vinculado). */
export async function saveBackup(): Promise<SaveResult> {
  const json = await exportAll()
  const w = window as PickerWindow
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      if (!linkedHandle) {
        linkedHandle = await w.showSaveFilePicker({
          suggestedName: suggestedName(),
          types: JSON_TYPES,
        })
      }
      const writable = await linkedHandle.createWritable()
      await writable.write(json)
      await writable.close()
      return 'saved'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
      // permiso revocado u otro fallo → olvidar handle y descargar
      linkedHandle = null
      download(json)
      return 'downloaded'
    }
  }
  download(json)
  return 'downloaded'
}

export type OpenResult =
  | { status: 'opened'; text: string }
  | { status: 'cancelled' }
  | { status: 'unsupported' }

/**
 * Abre una copia desde disco y devuelve su TEXTO (no importa todavía, para poder
 * confirmar antes). 'unsupported' → usar input de archivo.
 */
export async function openBackup(): Promise<OpenResult> {
  const w = window as PickerWindow
  if (typeof w.showOpenFilePicker !== 'function') return { status: 'unsupported' }
  try {
    const [handle] = await w.showOpenFilePicker({ types: JSON_TYPES })
    const file = await handle.getFile()
    const text = await file.text()
    linkedHandle = handle
    return { status: 'opened', text }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return { status: 'cancelled' }
    throw e
  }
}
