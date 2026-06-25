import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Identificador unico. */
export const uid = (): string => crypto.randomUUID()

/** Marca de tiempo actual. */
export const now = (): number => Date.now()

/** Cuenta palabras a partir de HTML del editor. */
export function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
  const matches = text.trim().match(/\S+/g)
  return matches ? matches.length : 0
}

/** Formatea una marca de tiempo a fecha legible en español. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "hace 3 minutos", "hace 2 días"… */
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `hace ${d} d`
  return formatDate(ts)
}

/** Paleta de colores para portadas, fichas y notas. */
export const PALETTE: string[] = [
  '#8b5cf6',
  '#6366f1',
  '#0ea5e9',
  '#06b6d4',
  '#10b981',
  '#84cc16',
  '#f59e0b',
  '#f97316',
  '#f43f5e',
  '#ec4899',
  '#64748b',
  '#a16207',
]

/** Color "estable" a partir de un texto (para avatares por inicial). */
export function colorFromString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
