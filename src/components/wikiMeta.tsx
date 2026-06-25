import type { ReactNode } from 'react'
import {
  Users,
  MapPin,
  Flag,
  Package,
  Sparkles,
  PawPrint,
  Shapes,
} from 'lucide-react'
import type { WikiType } from '@/lib/db'

export interface WikiMeta {
  type: WikiType
  label: string
  plural: string
  color: string
  icon: (size?: number) => ReactNode
}

export const WIKI_TYPES: WikiMeta[] = [
  {
    type: 'character',
    label: 'Personaje',
    plural: 'Personajes',
    color: '#8b5cf6',
    icon: (s = 16) => <Users size={s} />,
  },
  {
    type: 'location',
    label: 'Lugar',
    plural: 'Lugares',
    color: '#0ea5e9',
    icon: (s = 16) => <MapPin size={s} />,
  },
  {
    type: 'faction',
    label: 'Facción',
    plural: 'Facciones',
    color: '#f43f5e',
    icon: (s = 16) => <Flag size={s} />,
  },
  {
    type: 'item',
    label: 'Objeto',
    plural: 'Objetos',
    color: '#f59e0b',
    icon: (s = 16) => <Package size={s} />,
  },
  {
    type: 'power',
    label: 'Poder',
    plural: 'Poderes',
    color: '#d946ef',
    icon: (s = 16) => <Sparkles size={s} />,
  },
  {
    type: 'creature',
    label: 'Criatura',
    plural: 'Criaturas',
    color: '#10b981',
    icon: (s = 16) => <PawPrint size={s} />,
  },
  {
    type: 'other',
    label: 'Otro',
    plural: 'Otros',
    color: '#64748b',
    icon: (s = 16) => <Shapes size={s} />,
  },
]

export function wikiMeta(type: WikiType): WikiMeta {
  return WIKI_TYPES.find((t) => t.type === type) ?? WIKI_TYPES[WIKI_TYPES.length - 1]
}
