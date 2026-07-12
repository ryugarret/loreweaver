import type { ChapterStatus, RelType } from './db'

export const CHAPTER_STATUS: {
  id: ChapterStatus
  label: string
  color: string
}[] = [
  { id: 'idea', label: 'Idea', color: '#a16207' },
  { id: 'draft', label: 'Borrador', color: '#6366f1' },
  { id: 'revision', label: 'Revisión', color: '#f59e0b' },
  { id: 'done', label: 'Terminado', color: '#10b981' },
]

export function statusMeta(s: ChapterStatus) {
  return CHAPTER_STATUS.find((x) => x.id === s) ?? CHAPTER_STATUS[1]
}

/** Tipos de relación de fábrica para el grafo de vínculos. El usuario puede
 *  añadir los suyos por proyecto (Project.relTypes). */
export const REL_TYPES: RelType[] = [
  { id: 'family', label: 'Familia', color: '#10b981' },
  { id: 'spouse', label: 'Cónyuge', color: '#fb7185' },
  { id: 'sibling', label: 'Hermano', color: '#14b8a6' },
  { id: 'ally', label: 'Aliado', color: '#0ea5e9' },
  { id: 'enemy', label: 'Enemigo', color: '#f43f5e' },
  { id: 'romance', label: 'Romance', color: '#ec4899' },
  { id: 'mentor', label: 'Mentor', color: '#f59e0b' },
  { id: 'other', label: 'Otro', color: '#8b5cf6' },
]

export function relMeta(id: string) {
  return REL_TYPES.find((r) => r.id === id) ?? REL_TYPES[REL_TYPES.length - 1]
}
