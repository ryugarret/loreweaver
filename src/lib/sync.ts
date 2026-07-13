/**
 * Motor de sincronización E2E (opt-in). Sube/baja registros CIFRADOS a Supabase
 * con "última escritura gana" por registro. Enfoque de bajo riesgo:
 *  - No usa hooks de Dexie ni cambia el esquema ni toca los borrados existentes.
 *  - Un mapa de estado en `kv` (id → {ts, tabla} ya sincronizado) detecta altas,
 *    cambios Y borrados por diferencia de conjuntos.
 *  - PULL antes que PUSH para no pisar en el servidor algo más nuevo.
 *
 * Texto/estructura (projects, chapters, wiki, events, nodes, links) va en la tabla
 * `records` (cifrado). Las IMÁGENES van aparte: el blob comprimido se cifra en
 * binario y se sube a Supabase Storage con dedupe por hash de contenido (misma
 * imagen = un solo objeto); en `records` solo viaja su metadata cifrada + el hash.
 * Así ocupan lo mínimo y el 1 GB gratis cunde. (Música, historial, tramas, grafo
 * y racha quedan para más adelante.)
 */
import { supabase } from './supabase'
import { db, type ImageAsset } from './db'
import { now } from './utils'
import { currentDEK, restoreDEK } from './account'
import {
  encryptJSON,
  decryptJSON,
  encryptBlob,
  decryptBlob,
  sha256Hex,
  type Cipher,
} from './crypto'
import { compressImage } from './image'

const SYNCED = ['projects', 'chapters', 'wiki', 'events', 'nodes', 'links'] as const
type Coll = (typeof SYNCED)[number] | 'images'

const BUCKET = 'assets'
const STATE_KEY = 'sync.state'
const PAGE = 1000
const CHUNK = 200

interface SyncState {
  /** id → {ts, tabla} de lo ya sincronizado. ts = updatedAt (o addedAt en imágenes). */
  map: Record<string, { u: number; c: Coll }>
  /** máximo updated_at del servidor ya traído (cursor de PULL). */
  cursor: number
  /** hashes de imagen ya subidos a Storage desde este dispositivo (dedupe). */
  up: Record<string, 1>
}

interface ServerRow {
  id: string
  coll: Coll
  cipher: Cipher
  deleted: boolean
  updated_at: number
}

/** Metadata de imagen que viaja cifrada (el blob va aparte, en Storage). */
interface ImageMeta {
  id: string
  entryId: string
  projectId: string
  addedAt: number
  hash: string
  type: string
}

async function loadState(): Promise<SyncState> {
  const row = await db.kv.get(STATE_KEY)
  return (row?.value as SyncState) ?? { map: {}, cursor: 0, up: {} }
}
async function saveState(s: SyncState): Promise<void> {
  await db.kv.put({ key: STATE_KEY, value: s })
}

/* ---------- estado observable para la UI ---------- */

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

/* ---------- imágenes ---------- */

/** Aplica una fila de imagen bajada: descarga+descifra el blob de Storage si falta. */
async function applyImage(
  s: ServerRow,
  dek: CryptoKey,
  uid: string,
  state: SyncState,
): Promise<void> {
  const local = await db.images.get(s.id)
  if (s.deleted) {
    if (local) await db.images.delete(s.id)
    delete state.map[s.id]
    return
  }
  const meta = await decryptJSON<ImageMeta>(s.cipher, dek)
  if (local?.blob) {
    // ya tenemos el blob; solo registramos que está sincronizada.
    state.map[s.id] = { u: meta.addedAt, c: 'images' }
    state.up[meta.hash] = 1
    return
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${uid}/${meta.hash}`)
  if (error || !data) throw error ?? new Error('No se pudo descargar una imagen.')
  const plain = await decryptBlob(data, dek)
  const asset: ImageAsset = {
    id: meta.id,
    entryId: meta.entryId,
    projectId: meta.projectId,
    addedAt: meta.addedAt,
    blob: plain.slice(0, plain.size, meta.type || 'application/octet-stream'),
    hash: meta.hash,
  }
  await db.images.put(asset)
  state.map[s.id] = { u: meta.addedAt, c: 'images' }
  state.up[meta.hash] = 1
}

/** Sube (cifrada) una imagen local nueva a Storage y devuelve su fila para `records`. */
async function pushImage(
  img: ImageAsset,
  dek: CryptoKey,
  uid: string,
  state: SyncState,
): Promise<Record<string, unknown>> {
  // Asegurar hash; de paso comprimir las antiguas (idempotente: si ya está
  // comprimida, compressImage devuelve algo no menor y la dejamos igual).
  let blob = img.blob
  let hash = img.hash
  if (!hash) {
    const c = await compressImage(img.blob)
    if (c.size < img.blob.size) blob = c
    hash = await sha256Hex(blob)
    await db.images.update(img.id, { blob, hash })
  }
  if (!state.up[hash]) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${uid}/${hash}`, await encryptBlob(blob, dek), {
        upsert: true,
        contentType: 'application/octet-stream',
      })
    if (error) throw error
    state.up[hash] = 1
  }
  const meta: ImageMeta = {
    id: img.id,
    entryId: img.entryId,
    projectId: img.projectId,
    addedAt: img.addedAt,
    hash,
    type: blob.type,
  }
  return {
    user_id: uid,
    id: img.id,
    coll: 'images',
    cipher: await encryptJSON(meta, dek),
    deleted: false,
    updated_at: img.addedAt,
  }
}

/* ---------- núcleo ---------- */

let running = false

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
        if (s.coll === 'images') {
          await applyImage(s, dek, uid, state)
        } else {
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
        }
        cursor = Math.max(cursor, s.updated_at)
        pulled++
      }
      if (rows.length < PAGE) break
    }
    state.cursor = cursor

    // ---- PUSH: local → servidor ----
    const currentIds = new Set<string>()
    const toUpsert: Record<string, unknown>[] = []

    // Texto/estructura
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

    // Imágenes: inmutables → solo procesamos las que aún no están en el mapa (blob
    // aparte, así no cargamos en memoria los blobs ya sincronizados).
    const imgIds = (await db.images.toCollection().primaryKeys()) as string[]
    for (const id of imgIds) currentIds.add(id)
    for (const id of imgIds) {
      if (state.map[id]) continue
      const img = await db.images.get(id)
      if (img) toUpsert.push(await pushImage(img, dek, uid, state))
    }

    // Borrados: en el mapa pero ya no en local (cualquier tabla, incl. imágenes).
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
