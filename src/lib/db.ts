import Dexie, { type Table } from 'dexie'

/* ====== Tipos del dominio ====== */

export type WikiType =
  | 'character'
  | 'location'
  | 'faction'
  | 'item'
  | 'power'
  | 'creature'
  | 'other'

export type ChapterStatus = 'idea' | 'draft' | 'revision' | 'done'

export interface Project {
  id: string
  title: string
  description: string
  genre: string
  coverColor: string
  /** Id de la imagen de portada (en la tabla `images`, con entryId = id del
   *  proyecto). Si no hay, se usa el color `coverColor`. */
  coverImageId?: string
  /** Objetivo total de palabras del proyecto (0 = sin objetivo) */
  wordGoal?: number
  createdAt: number
  updatedAt: number
}

/** Registro de palabras escritas por día (para rachas y estadísticas). */
export interface DailyLog {
  date: string // 'YYYY-MM-DD'
  words: number
}

/** Trama / línea argumental (carril de la timeline visual). */
export interface Lane {
  id: string
  projectId: string
  name: string
  order: number
}

export interface Chapter {
  id: string
  projectId: string
  title: string
  /** Contenido HTML del editor */
  content: string
  synopsis: string
  order: number
  wordCount: number
  status: ChapterStatus
  createdAt: number
  updatedAt: number
}

export interface WikiField {
  id: string
  label: string
  value: string
}

export interface WikiEntry {
  id: string
  projectId: string
  type: WikiType
  name: string
  summary: string
  /** Notas largas en HTML */
  notes: string
  color: string
  fields: WikiField[]
  tags: string[]
  /** Id de la imagen usada como portada/avatar (si hay) */
  coverImageId?: string
  /** Género (opcional) — solo se usa para colorear el árbol genealógico */
  gender?: 'male' | 'female'
  createdAt: number
  updatedAt: number
}

/** Imagen de referencia (archivo guardado como Blob en IndexedDB). */
export interface ImageAsset {
  id: string
  entryId: string
  projectId: string
  blob: Blob
  addedAt: number
}

/** Qué tipo de entidad enlaza un vínculo. */
export type EntityKind = 'wiki' | 'event'

/** Vínculo/relación entre dos entidades (con el motivo). */
export interface Link {
  id: string
  projectId: string
  fromId: string
  toId: string
  fromKind: EntityKind
  toKind: EntityKind
  /** El "por qué" del vínculo, ej: "hermano de", "mató a", "ocurre en" */
  label: string
  /** Categoría: family | spouse | sibling | ally | enemy | romance | mentor | cause | other */
  relType: string
  /**
   * Intensidad/afinidad de la relación, −100 (hostil) a +100 (afín). Opcional,
   * NO indexado. Para la "diplomacy web": grosor y etiqueta de la arista. 0/undef
   * = neutro (sin estilo especial).
   */
  strength?: number
  createdAt: number
  updatedAt: number
}

/** Posición guardada de una entidad en el grafo de relaciones. */
export interface GraphPos {
  id: string // = id de la entidad
  projectId: string
  x: number
  y: number
}

export interface TimelineEvent {
  id: string
  projectId: string
  title: string
  description: string
  /** Fecha "in-world" en texto libre (ej: "Año 312 de la Tercera Era") */
  dateLabel: string
  era: string
  /** Trama / carril al que pertenece (para la vista visual con líneas paralelas) */
  lane?: string
  sortIndex: number
  color: string
  createdAt: number
  updatedAt: number
}

export interface BoardNode {
  id: string
  projectId: string
  text: string
  x: number
  y: number
  w: number
  h: number
  color: string
  createdAt: number
  updatedAt: number
}

/** Pista de música local (el archivo se guarda como Blob en IndexedDB). */
export interface Track {
  id: string
  name: string
  blob: Blob
  addedAt: number
}

/** Vídeo o lista de reproducción de YouTube guardada. */
export interface YtItem {
  id: string
  title: string
  url: string
  kind: 'video' | 'playlist'
  addedAt: number
}

/** Instantánea del contenido de un capítulo (historial tipo Google Docs). */
export interface ChapterVersion {
  id: string
  chapterId: string
  projectId: string
  /** HTML del capítulo en ese momento */
  content: string
  title: string
  wordCount: number
  savedAt: number
  /** Etiqueta opcional (versiones marcadas a mano) */
  label?: string
  /** true = instantánea automática · false = marcada a mano */
  auto: boolean
}

/** Almacén clave-valor para ajustes/objetos varios (p.ej. el handle del
 *  archivo de guardado en disco). El valor puede ser cualquier cosa
 *  clonable estructuralmente (incluido un FileSystemFileHandle). */
export interface KvEntry {
  key: string
  value: unknown
}

/* ====== Definicion de la base de datos ====== */

export class LoreweaverDB extends Dexie {
  projects!: Table<Project, string>
  chapters!: Table<Chapter, string>
  wiki!: Table<WikiEntry, string>
  events!: Table<TimelineEvent, string>
  nodes!: Table<BoardNode, string>
  tracks!: Table<Track, string>
  yt!: Table<YtItem, string>
  daily!: Table<DailyLog, string>
  images!: Table<ImageAsset, string>
  links!: Table<Link, string>
  layout!: Table<GraphPos, string>
  lanes!: Table<Lane, string>
  versions!: Table<ChapterVersion, string>
  kv!: Table<KvEntry, string>

  constructor() {
    super('cosmia-local')
    this.version(1).stores({
      // 'id' es la clave primaria; los demas son indices para consultas rapidas
      projects: 'id, updatedAt',
      chapters: 'id, projectId, order',
      wiki: 'id, projectId, type, name',
      events: 'id, projectId, sortIndex',
      nodes: 'id, projectId',
    })
    // v2: música local + listas de YouTube (audio/inmersión)
    this.version(2).stores({
      projects: 'id, updatedAt',
      chapters: 'id, projectId, order',
      wiki: 'id, projectId, type, name',
      events: 'id, projectId, sortIndex',
      nodes: 'id, projectId',
      tracks: 'id, addedAt',
      yt: 'id, addedAt',
    })
    // v3: registro diario de palabras (rachas / estadísticas)
    this.version(3).stores({
      projects: 'id, updatedAt',
      chapters: 'id, projectId, order',
      wiki: 'id, projectId, type, name',
      events: 'id, projectId, sortIndex',
      nodes: 'id, projectId',
      tracks: 'id, addedAt',
      yt: 'id, addedAt',
      daily: 'date',
    })
    // v4: imágenes de referencia para las fichas de la wiki
    this.version(4).stores({
      projects: 'id, updatedAt',
      chapters: 'id, projectId, order',
      wiki: 'id, projectId, type, name',
      events: 'id, projectId, sortIndex',
      nodes: 'id, projectId',
      tracks: 'id, addedAt',
      yt: 'id, addedAt',
      daily: 'date',
      images: 'id, entryId, projectId',
    })
    // v5: vínculos/relaciones entre entidades + posiciones del grafo
    this.version(5).stores({
      projects: 'id, updatedAt',
      chapters: 'id, projectId, order',
      wiki: 'id, projectId, type, name',
      events: 'id, projectId, sortIndex',
      nodes: 'id, projectId',
      tracks: 'id, addedAt',
      yt: 'id, addedAt',
      daily: 'date',
      images: 'id, entryId, projectId',
      links: 'id, projectId, fromId, toId',
      layout: 'id, projectId',
    })
    // v6: tramas / líneas argumentales (carriles de la timeline)
    this.version(6).stores({
      projects: 'id, updatedAt',
      chapters: 'id, projectId, order',
      wiki: 'id, projectId, type, name',
      events: 'id, projectId, sortIndex',
      nodes: 'id, projectId',
      tracks: 'id, addedAt',
      yt: 'id, addedAt',
      daily: 'date',
      images: 'id, entryId, projectId',
      links: 'id, projectId, fromId, toId',
      layout: 'id, projectId',
      lanes: 'id, projectId, order',
    })
    // v7: historial de versiones de capítulos + almacén clave-valor
    this.version(7).stores({
      projects: 'id, updatedAt',
      chapters: 'id, projectId, order',
      wiki: 'id, projectId, type, name',
      events: 'id, projectId, sortIndex',
      nodes: 'id, projectId',
      tracks: 'id, addedAt',
      yt: 'id, addedAt',
      daily: 'date',
      images: 'id, entryId, projectId',
      links: 'id, projectId, fromId, toId',
      layout: 'id, projectId',
      lanes: 'id, projectId, order',
      versions: 'id, chapterId, projectId, savedAt',
      kv: 'key',
    })
  }
}

export const db = new LoreweaverDB()
