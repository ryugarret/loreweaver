/**
 * Motor de sincronización E2E (opt-in). Sube/baja registros CIFRADOS a Supabase
 * con "última escritura gana" por registro (updatedAt). Enfoque de bajo riesgo:
 *  - No usa hooks de Dexie ni cambia el esquema ni toca los borrados existentes.
 *  - Un mapa de estado en `kv` (id → {updatedAt, tabla} ya sincronizado) permite
 *    detectar altas, cambios Y borrados (por diferencia de conjuntos), sin tumbas
 *    en el esquema local.
 *  - Hace PULL antes que PUSH para no pisar en el servidor algo más nuevo.
 *
 * v1: solo tablas de texto/estructura (con updatedAt y sin blobs). Imágenes y
 * música (blobs), historial de versiones, tramas, posiciones del grafo y racha
 * quedan para incrementos posteriores.
 */
import { supabase } from './supabase'
import { db } from './db'
import { now } from './utils'
import { currentDEK, restoreDEK } from './account'
import { encryptJSON, decryptJSON, type Cipher } from './crypto'

const SYNCED = ['projects', 'chapters', 'wiki', 'events', 'nodes', 'links'] as const
type Coll = (typeof SYNCED)[number]

const STATE_KEY = 'sync.state'
const PAGE = 1000
const CHUNK = 200

interface SyncState {
  /** id → {updatedAt, tabla} de lo ya sincronizado con el servidor. */
  map: Record<string, { u: number; c: Coll }>
  /** máximo updated_at del servidor ya traído (cursor de PULL). */
  cursor: number
}

interface ServerRow {
  id: string
  coll: Coll
  cipher: Cipher
  deleted: boolean
  updated_at: number
}

async function loadState(): Promise<SyncState> {
  const row = await db.kv.get(STATE_KEY)
  return (row?.value as SyncState) ?? { map: {}, cursor: 0 }
}
async function saveState(s: SyncState): Promise<void> {
  await db.kv.put({ key: STATE_KEY, value: s })
}

/* ---------- estado observable para la UI (patrón useSyncExternalStore) ---------- */

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error'
  lastSyncAt?: number
  error?: string
}
let status: SyncStatus = { state: 'idle' }
const listeners = new Set<() => void>()
function setStatus(next: SyncStatus): void {
  status = next
  listeners.forEach((l) => l())
}
export function subscribeSync(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export function getSyncStatus(): SyncStatus {
  return status
}

/* ---------- núcleo ---------- */

let running = false

/**
 * Sincroniza una vez (pull + push). Requiere sesión iniciada y cofre abierto
 * (DEK). Devuelve cuántos registros bajó/subió, o null si no procede.
 */
export async function sync(): Promise<{ pulled: number; pushed: number } | null> {
  const dek = currentDEK()
  if (!dek) return null
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid || running) return null

  running = true
  setStatus({ state: 'syncing', lastSyncAt: status.lastSyncAt })
  try {
    const state = await loadState()
    let pulled = 0
    let pushed = 0

    // ---- PULL: servidor → local (última gana) ----
    let cursor = state.cursor
    for (;;) {
      const { data, error } = await supabase
        .from('records')
        .select('id, coll, cipher, deleted, updated_at')
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(PAGE)
      if (error) throw error
      const rows = (data ?? []) as ServerRow[]
      for (const s of rows) {
        const local = (await db.table(s.coll).get(s.id)) as
          | { updatedAt?: number }
          | undefined
        const localU = local?.updatedAt ?? -1
        if (s.deleted) {
          if (local && localU <= s.updated_at) await db.table(s.coll).delete(s.id)
          delete state.map[s.id]
        } else if (!local || localU < s.updated_at) {
          await db.table(s.coll).put(await decryptJSON(s.cipher, dek))
          state.map[s.id] = { u: s.updated_at, c: s.coll }
        } else {
          state.map[s.id] = { u: localU, c: s.coll }
        }
        cursor = Math.max(cursor, s.updated_at)
        pulled++
      }
      if (rows.length < PAGE) break
    }
    state.cursor = cursor

    // ---- PUSH: local → servidor (solo lo local más nuevo + borrados) ----
    const currentIds = new Set<string>()
    const toUpsert: Record<string, unknown>[] = []
    for (const coll of SYNCED) {
      const rows = (await db.table(coll).toArray()) as {
        id: string
        updatedAt: number
      }[]
      for (const rec of rows) {
        currentIds.add(rec.id)
        const seen = state.map[rec.id]
        if (!seen || seen.u < rec.updatedAt) {
          toUpsert.push({
            user_id: uid,
            id: rec.id,
            coll,
            cipher: await encryptJSON(rec, dek),
            deleted: false,
            updated_at: rec.updatedAt,
          })
        }
      }
    }
    // Borrados: estaban sincronizados (en el mapa) pero ya no existen en local.
    const ts = now()
    for (const id in state.map) {
      if (!currentIds.has(id)) {
        toUpsert.push({
          user_id: uid,
          id,
          coll: state.map[id].c,
          cipher: {},
          deleted: true,
          updated_at: ts,
        })
      }
    }
    for (let i = 0; i < toUpsert.length; i += CHUNK) {
      const chunk = toUpsert.slice(i, i + CHUNK)
      const { error } = await supabase.from('records').upsert(chunk)
      if (error) throw error
      pushed += chunk.length
    }
    for (const r of toUpsert as {
      id: string
      coll: Coll
      deleted: boolean
      updated_at: number
    }[]) {
      if (r.deleted) delete state.map[r.id]
      else state.map[r.id] = { u: r.updated_at, c: r.coll }
    }

    await saveState(state)
    setStatus({ state: 'idle', lastSyncAt: now() })
    return { pulled, pushed }
  } catch (e) {
    setStatus({
      state: 'error',
      lastSyncAt: status.lastSyncAt,
      error: String((e as Error)?.message ?? e),
    })
    return null
  } finally {
    running = false
  }
}

/** Al arrancar la app: restaura la DEK del dispositivo y sincroniza si hay sesión. */
export async function initSync(): Promise<void> {
  const restored = await restoreDEK()
  const { data } = await supabase.auth.getSession()
  if (restored && data.session) void sync()
}
