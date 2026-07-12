import {
  db,
  type Project,
  type Chapter,
  type ChapterVersion,
  type WikiEntry,
  type WikiType,
  type ImageAsset,
  type Link,
  type EntityKind,
  type TimelineEvent,
  type Lane,
} from './db'
import { uid, now } from './utils'

/* ====== Proyectos ====== */

export async function createProject(data: Partial<Project>): Promise<string> {
  const id = uid()
  const ts = now()
  await db.projects.add({
    id,
    title: data.title?.trim() || 'Proyecto sin título',
    description: data.description ?? '',
    genre: data.genre ?? '',
    coverColor: data.coverColor ?? '#8b5cf6',
    createdAt: ts,
    updatedAt: ts,
  })
  return id
}

export async function touchProject(projectId: string): Promise<void> {
  await db.projects.update(projectId, { updatedAt: now() })
}

/** Edita los datos de un proyecto (título, género, descripción, color…). */
export async function updateProject(
  id: string,
  patch: Partial<Project>,
): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: now() })
}

/** Pone (o reemplaza) la foto de portada del proyecto. La imagen se guarda en la
 *  tabla `images` con entryId = id del proyecto (así `deleteProject`, que borra
 *  por projectId, la limpia sola). */
export async function setProjectCover(
  projectId: string,
  file: File,
): Promise<void> {
  await db.images.where('entryId').equals(projectId).delete()
  const id = uid()
  await db.images.add({
    id,
    entryId: projectId,
    projectId,
    blob: file,
    addedAt: now(),
  })
  await db.projects.update(projectId, { coverImageId: id, updatedAt: now() })
}

/** Quita la foto de portada del proyecto (vuelve al color). */
export async function removeProjectCover(projectId: string): Promise<void> {
  await db.images.where('entryId').equals(projectId).delete()
  await db.projects.update(projectId, {
    coverImageId: undefined,
    updatedAt: now(),
  })
}

export async function setWordGoal(
  projectId: string,
  wordGoal: number,
): Promise<void> {
  await db.projects.update(projectId, { wordGoal, updatedAt: now() })
}

function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Suma las palabras escritas hoy (solo incrementos positivos). */
export async function logWords(delta: number): Promise<void> {
  if (delta <= 0) return
  const date = todayKey()
  await db.transaction('rw', db.daily, async () => {
    const row = await db.daily.get(date)
    await db.daily.put({ date, words: (row?.words ?? 0) + delta })
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.projects,
      db.chapters,
      db.wiki,
      db.events,
      db.nodes,
      db.images,
      db.links,
      db.layout,
      db.lanes,
    ],
    async () => {
      await db.chapters.where('projectId').equals(projectId).delete()
      await db.wiki.where('projectId').equals(projectId).delete()
      await db.events.where('projectId').equals(projectId).delete()
      await db.nodes.where('projectId').equals(projectId).delete()
      await db.images.where('projectId').equals(projectId).delete()
      await db.links.where('projectId').equals(projectId).delete()
      await db.layout.where('projectId').equals(projectId).delete()
      await db.lanes.where('projectId').equals(projectId).delete()
      await db.projects.delete(projectId)
    },
  )
}

/* ====== Capítulos ====== */

export async function createChapter(
  projectId: string,
  title = 'Capítulo nuevo',
): Promise<string> {
  const id = uid()
  const ts = now()
  const order = await db.chapters.where('projectId').equals(projectId).count()
  await db.chapters.add({
    id,
    projectId,
    title,
    content: '',
    synopsis: '',
    order,
    wordCount: 0,
    status: 'draft',
    createdAt: ts,
    updatedAt: ts,
  })
  await touchProject(projectId)
  return id
}

export async function deleteChapter(chapter: Chapter): Promise<void> {
  await db.versions.where('chapterId').equals(chapter.id).delete()
  await db.chapters.delete(chapter.id)
  await touchProject(chapter.projectId)
}

/* ====== Historial de versiones de capítulos (tipo Google Docs) ====== */

/** Intervalo mínimo entre instantáneas AUTOMÁTICAS del mismo capítulo. */
const AUTO_VERSION_MIN_GAP_MS = 3 * 60 * 1000 // 3 minutos

export async function listChapterVersions(
  chapterId: string,
): Promise<ChapterVersion[]> {
  const v = await db.versions.where('chapterId').equals(chapterId).toArray()
  return v.sort((a, b) => b.savedAt - a.savedAt) // más reciente primero
}

export async function saveChapterVersion(
  chapter: Chapter,
  opts: { auto: boolean; label?: string },
): Promise<string> {
  const id = uid()
  await db.versions.add({
    id,
    chapterId: chapter.id,
    projectId: chapter.projectId,
    content: chapter.content,
    title: chapter.title,
    wordCount: chapter.wordCount,
    savedAt: now(),
    label: opts.label?.trim() || undefined,
    auto: opts.auto,
  })
  return id
}

/**
 * Crea una instantánea AUTOMÁTICA solo si el contenido cambió respecto a la
 * última versión y ha pasado el intervalo mínimo (para no crear miles). Pensado
 * para llamarse en cada autoguardado del editor; casi siempre es un no-op barato.
 */
export async function maybeAutoVersion(chapter: Chapter): Promise<void> {
  const versions = await db.versions
    .where('chapterId')
    .equals(chapter.id)
    .toArray()
  const last = versions.sort((a, b) => b.savedAt - a.savedAt)[0]
  if (last) {
    if (last.content === chapter.content) return // sin cambios reales
    if (last.auto && now() - last.savedAt < AUTO_VERSION_MIN_GAP_MS) return
  }
  await saveChapterVersion(chapter, { auto: true })
}

export async function deleteChapterVersion(id: string): Promise<void> {
  await db.versions.delete(id)
}

const _baselined = new Set<string>()

/**
 * Crea la versión "línea base" de un capítulo la primera vez que se abre (para
 * que el historial parta del texto original). Idempotente y a prueba de la doble
 * invocación de efectos de StrictMode (guardia por Set + transacción atómica).
 */
export async function ensureChapterBaseline(chapter: Chapter): Promise<void> {
  if (_baselined.has(chapter.id)) return
  _baselined.add(chapter.id)
  if (!chapter.content || chapter.content === '<p></p>') return
  await db.transaction('rw', db.versions, async () => {
    const count = await db.versions
      .where('chapterId')
      .equals(chapter.id)
      .count()
    if (count > 0) return
    await db.versions.add({
      id: uid(),
      chapterId: chapter.id,
      projectId: chapter.projectId,
      content: chapter.content,
      title: chapter.title,
      wordCount: chapter.wordCount,
      savedAt: now(),
      auto: true,
    })
  })
}

/**
 * Restaura el contenido de una versión en su capítulo. Antes guarda el estado
 * actual como instantánea para poder deshacer la restauración.
 */
export async function restoreChapterVersion(
  version: ChapterVersion,
): Promise<void> {
  const chapter = await db.chapters.get(version.chapterId)
  if (!chapter) return
  if (chapter.content !== version.content) {
    await saveChapterVersion(chapter, { auto: true })
  }
  await db.chapters.update(chapter.id, {
    content: version.content,
    wordCount: version.wordCount,
    updatedAt: now(),
  })
}

/* ====== Wiki ====== */

const DEFAULT_NAME: Record<WikiType, string> = {
  character: 'Personaje sin nombre',
  location: 'Lugar sin nombre',
  faction: 'Facción sin nombre',
  item: 'Objeto sin nombre',
  power: 'Poder sin nombre',
  creature: 'Criatura sin nombre',
  other: 'Entrada sin nombre',
}

export async function createWiki(
  projectId: string,
  type: WikiType,
  color: string,
): Promise<string> {
  const id = uid()
  const ts = now()
  await db.wiki.add({
    id,
    projectId,
    type,
    name: DEFAULT_NAME[type],
    summary: '',
    notes: '',
    color,
    fields: [],
    tags: [],
    order: ts, // se añade al final (ts es monotónico); reordenable a mano
    createdAt: ts,
    updatedAt: ts,
  })
  await touchProject(projectId)
  return id
}

export async function saveWiki(entry: WikiEntry): Promise<void> {
  await db.wiki.put({ ...entry, updatedAt: now() })
  await touchProject(entry.projectId)
}

/** Fija el orden manual de las fichas (arrastrar para reordenar): order = índice. */
export async function reorderWiki(ids: string[]): Promise<void> {
  await db.transaction('rw', db.wiki, async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.wiki.update(ids[i], { order: i })
    }
  })
}

/** Ids de fichas @mencionadas dentro de un HTML (nodos `.mention[data-id]`). */
function htmlMentionIds(html: string): Set<string> {
  const ids = new Set<string>()
  if (!html) return ids
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('.mention[data-id]').forEach((el) => {
    const id = el.getAttribute('data-id')
    if (id) ids.add(id)
  })
  return ids
}

/**
 * Backlinks de una ficha: capítulos y eventos cuyo contenido la @menciona.
 * Para responder "¿dónde aparece este personaje?".
 */
export async function findBacklinks(
  projectId: string,
  entityId: string,
): Promise<{
  chapters: { id: string; title: string }[]
  events: { id: string; title: string }[]
}> {
  const [chapters, events] = await Promise.all([
    db.chapters.where('projectId').equals(projectId).sortBy('order'),
    db.events.where('projectId').equals(projectId).sortBy('sortIndex'),
  ])
  return {
    chapters: chapters
      .filter((c) => htmlMentionIds(c.content).has(entityId))
      .map((c) => ({ id: c.id, title: c.title })),
    events: events
      .filter((e) => htmlMentionIds(e.description).has(entityId))
      .map((e) => ({ id: e.id, title: e.title })),
  }
}

export async function deleteWiki(entry: WikiEntry): Promise<void> {
  await db.images.where('entryId').equals(entry.id).delete()
  await db.links.where('fromId').equals(entry.id).delete()
  await db.links.where('toId').equals(entry.id).delete()
  await db.layout.delete(entry.id)
  await db.wiki.delete(entry.id)
  await touchProject(entry.projectId)
}

/* ====== Imágenes de referencia ====== */

/** Añade imágenes de referencia. Devuelve cuántas se guardaron (para dar feedback
 *  si el archivo no era una imagen válida). */
export async function addImages(
  entryId: string,
  projectId: string,
  files: FileList | File[],
): Promise<number> {
  const items: ImageAsset[] = []
  let i = 0
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image')) continue
    // Guardar un Blob "plano" (no el File): Safari/iOS a veces no clona bien un
    // File en IndexedDB y la subida falla. `slice` devuelve un Blob equivalente.
    const blob = f.slice(0, f.size, f.type)
    items.push({ id: uid(), entryId, projectId, blob, addedAt: now() + i++ })
  }
  if (items.length) await db.images.bulkAdd(items)
  return items.length
}

export async function deleteImage(id: string): Promise<void> {
  await db.images.delete(id)
}

/* ====== Vínculos / relaciones ====== */

export async function createLink(
  projectId: string,
  fromId: string,
  toId: string,
  opts?: {
    fromKind?: EntityKind
    toKind?: EntityKind
    label?: string
    relType?: string
    strength?: number
  },
): Promise<string> {
  const id = uid()
  const ts = now()
  await db.links.add({
    id,
    projectId,
    fromId,
    toId,
    fromKind: opts?.fromKind ?? 'wiki',
    toKind: opts?.toKind ?? 'wiki',
    label: opts?.label ?? '',
    relType: opts?.relType ?? 'other',
    strength: opts?.strength,
    createdAt: ts,
    updatedAt: ts,
  })
  return id
}

export async function updateLink(
  id: string,
  part: Partial<Link>,
): Promise<void> {
  await db.links.update(id, { ...part, updatedAt: now() })
}

export async function deleteLink(id: string): Promise<void> {
  await db.links.delete(id)
}

export async function saveNodePos(
  entityId: string,
  projectId: string,
  x: number,
  y: number,
): Promise<void> {
  await db.layout.put({ id: entityId, projectId, x, y })
}

/* ====== Línea de tiempo ====== */

export async function createEvent(
  projectId: string,
  color: string,
): Promise<string> {
  const id = uid()
  const ts = now()
  const sortIndex = await db.events.where('projectId').equals(projectId).count()
  await db.events.add({
    id,
    projectId,
    title: 'Evento nuevo',
    description: '',
    dateLabel: '',
    era: '',
    sortIndex,
    color,
    createdAt: ts,
    updatedAt: ts,
  })
  await touchProject(projectId)
  return id
}

export async function deleteEvent(event: TimelineEvent): Promise<void> {
  await db.links.where('fromId').equals(event.id).delete()
  await db.links.where('toId').equals(event.id).delete()
  await db.events.delete(event.id)
  await touchProject(event.projectId)
}

/* ====== Tramas / líneas argumentales ====== */

export async function createLane(
  projectId: string,
  name: string,
): Promise<string> {
  const id = uid()
  const order = await db.lanes.where('projectId').equals(projectId).count()
  await db.lanes.add({ id, projectId, name: name.trim() || 'Trama', order })
  return id
}

export async function renameLane(id: string, name: string): Promise<void> {
  await db.lanes.update(id, { name: name.trim() || 'Trama' })
}

export async function deleteLane(lane: Lane): Promise<void> {
  await db.transaction('rw', [db.lanes, db.events], async () => {
    const evs = await db.events
      .where('projectId')
      .equals(lane.projectId)
      .toArray()
    for (const e of evs) {
      if (e.lane === lane.id) await db.events.update(e.id, { lane: undefined })
    }
    await db.lanes.delete(lane.id)
  })
}

const _migrating = new Set<string>()

/**
 * Convierte tramas antiguas (texto libre en event.lane) en entidades Lane,
 * y deduplica tramas con el mismo nombre. Idempotente y a prueba de carreras
 * (no corre dos veces a la vez para el mismo proyecto).
 */
export async function migrateLegacyLanes(projectId: string): Promise<void> {
  if (_migrating.has(projectId)) return
  _migrating.add(projectId)
  try {
    const lanes = (
      await db.lanes.where('projectId').equals(projectId).toArray()
    ).sort((a, b) => a.order - b.order)
    const laneById = new Map(lanes.map((l) => [l.id, l]))
    // nombre -> id canónico (el primero por orden); el resto son duplicados
    const byName = new Map<string, string>()
    const dups = new Set<string>()
    for (const l of lanes) {
      if (byName.has(l.name)) dups.add(l.id)
      else byName.set(l.name, l.id)
    }

    const events = await db.events.where('projectId').equals(projectId).toArray()
    let order = byName.size
    for (const ev of events) {
      if (!ev.lane) continue
      const existing = laneById.get(ev.lane)
      if (existing) {
        // si apunta a una trama duplicada, remapear a la canónica
        const canon = byName.get(existing.name)
        if (canon && canon !== ev.lane)
          await db.events.update(ev.id, { lane: canon })
      } else {
        // texto libre antiguo -> crear/usar Lane
        const name = ev.lane
        let id = byName.get(name)
        if (!id) {
          id = uid()
          await db.lanes.add({ id, projectId, name, order: order++ })
          byName.set(name, id)
        }
        await db.events.update(ev.id, { lane: id })
      }
    }

    for (const d of dups) await db.lanes.delete(d)
  } finally {
    _migrating.delete(projectId)
  }
}

/** Inserta un evento (con sus datos) en una posición concreta y renumera. */
export async function insertEvent(
  projectId: string,
  data: {
    title?: string
    dateLabel?: string
    description?: string
    color: string
    lane?: string
  },
  position: { mode: 'start' | 'end' | 'after'; afterId?: string },
): Promise<string> {
  const id = uid()
  const ts = now()
  const events = await db.events
    .where('projectId')
    .equals(projectId)
    .sortBy('sortIndex')

  let idx = events.length
  if (position.mode === 'start') idx = 0
  else if (position.mode === 'after' && position.afterId) {
    const i = events.findIndex((e) => e.id === position.afterId)
    idx = i >= 0 ? i + 1 : events.length
  }

  const newEvent: TimelineEvent = {
    id,
    projectId,
    title: data.title?.trim() || 'Evento nuevo',
    description: data.description ?? '',
    dateLabel: data.dateLabel ?? '',
    era: '',
    lane: data.lane?.trim() || undefined,
    sortIndex: idx,
    color: data.color,
    createdAt: ts,
    updatedAt: ts,
  }
  const ordered = [...events]
  ordered.splice(idx, 0, newEvent)

  await db.transaction('rw', db.events, async () => {
    await db.events.add(newEvent)
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].sortIndex !== i) {
        await db.events.update(ordered[i].id, { sortIndex: i })
      }
    }
  })
  await touchProject(projectId)
  return id
}

/* ====== Tablero ====== */

export async function createNode(
  projectId: string,
  x: number,
  y: number,
  color: string,
): Promise<string> {
  const id = uid()
  const ts = now()
  await db.nodes.add({
    id,
    projectId,
    text: '',
    x,
    y,
    w: 200,
    h: 140,
    color,
    createdAt: ts,
    updatedAt: ts,
  })
  await touchProject(projectId)
  return id
}

/* ====== Copia de seguridad (export / import / borrar todo) ====== */

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function dataURLToBlob(dataURL: string): Promise<Blob> {
  return (await fetch(dataURL)).blob()
}

/**
 * Exporta TODOS los datos del usuario a JSON: proyectos, capítulos, wiki,
 * eventos, tablero, vínculos, tramas, posiciones del grafo, racha diaria,
 * YouTube e imágenes de referencia (las imágenes van en base64). NO incluye la
 * música local (`tracks`) por tamaño — el usuario conserva los archivos.
 */
export async function exportAll(): Promise<string> {
  const images = await db.images.toArray()
  const imagesSerialized = await Promise.all(
    images.map(async (img) => ({
      id: img.id,
      entryId: img.entryId,
      projectId: img.projectId,
      addedAt: img.addedAt,
      blob: await blobToDataURL(img.blob),
    })),
  )
  const data = {
    app: 'loreweaver',
    version: 2,
    exportedAt: now(),
    projects: await db.projects.toArray(),
    chapters: await db.chapters.toArray(),
    wiki: await db.wiki.toArray(),
    events: await db.events.toArray(),
    nodes: await db.nodes.toArray(),
    links: await db.links.toArray(),
    lanes: await db.lanes.toArray(),
    layout: await db.layout.toArray(),
    daily: await db.daily.toArray(),
    yt: await db.yt.toArray(),
    versions: await db.versions.toArray(),
    images: imagesSerialized,
  }
  return JSON.stringify(data)
}

/**
 * Importa una copia (formato v1 antiguo o v2 completo). Hace bulkPut, así que
 * fusiona/actualiza por id sin borrar lo que no esté en el archivo.
 */
export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json)
  if (data.app !== 'loreweaver' && data.app !== 'cosmia-local') {
    throw new Error('El archivo no es una copia de Loreweaver.')
  }
  // Reconstruir los Blobs de imagen ANTES de la transacción (fetch no puede ir
  // dentro de una transacción de Dexie).
  const images: ImageAsset[] = data.images
    ? await Promise.all(
        data.images.map(async (img: ImageAsset & { blob: string | Blob }) => ({
          id: img.id,
          entryId: img.entryId,
          projectId: img.projectId,
          addedAt: img.addedAt,
          blob:
            typeof img.blob === 'string'
              ? await dataURLToBlob(img.blob)
              : img.blob,
        })),
      )
    : []
  await db.transaction(
    'rw',
    [
      db.projects,
      db.chapters,
      db.wiki,
      db.events,
      db.nodes,
      db.links,
      db.lanes,
      db.layout,
      db.daily,
      db.yt,
      db.versions,
      db.images,
    ],
    async () => {
      if (data.projects) await db.projects.bulkPut(data.projects)
      if (data.chapters) await db.chapters.bulkPut(data.chapters)
      if (data.wiki) await db.wiki.bulkPut(data.wiki)
      if (data.events) await db.events.bulkPut(data.events)
      if (data.nodes) await db.nodes.bulkPut(data.nodes)
      if (data.links) await db.links.bulkPut(data.links)
      if (data.lanes) await db.lanes.bulkPut(data.lanes)
      if (data.layout) await db.layout.bulkPut(data.layout)
      if (data.daily) await db.daily.bulkPut(data.daily)
      if (data.yt) await db.yt.bulkPut(data.yt)
      if (data.versions) await db.versions.bulkPut(data.versions)
      if (images.length) await db.images.bulkPut(images)
    },
  )
}

/** Borra TODOS los datos del usuario (todas las tablas, sin huérfanos). */
export async function wipeAll(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.projects,
      db.chapters,
      db.wiki,
      db.events,
      db.nodes,
      db.links,
      db.lanes,
      db.layout,
      db.daily,
      db.images,
      db.tracks,
      db.yt,
      db.versions,
      db.kv,
    ],
    async () => {
      await Promise.all([
        db.projects.clear(),
        db.chapters.clear(),
        db.wiki.clear(),
        db.events.clear(),
        db.nodes.clear(),
        db.links.clear(),
        db.lanes.clear(),
        db.layout.clear(),
        db.daily.clear(),
        db.images.clear(),
        db.tracks.clear(),
        db.yt.clear(),
        db.versions.clear(),
        db.kv.clear(),
      ])
    },
  )
}
