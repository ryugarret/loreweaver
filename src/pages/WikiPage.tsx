import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { Plus, Search, BookMarked, GripVertical } from 'lucide-react'
import { db, type WikiType } from '@/lib/db'
import { createWiki, deleteWiki, reorderWiki } from '@/lib/repo'
import { WIKI_TYPES, wikiMeta } from '@/components/wikiMeta'
import { WikiDetail } from '@/components/wiki/WikiDetail'
import { WikiAvatar } from '@/components/wiki/WikiAvatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PALETTE, cn } from '@/lib/utils'

export function WikiPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [filter, setFilter] = useState<'all' | WikiType>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dragOverRef = useRef<string | null>(null)

  const entries = useLiveQuery(
    () =>
      projectId
        ? db.wiki.where('projectId').equals(projectId).toArray()
        : [],
    [projectId],
  )

  const selected = entries?.find((e) => e.id === selectedId) ?? null

  const q = search.trim().toLowerCase()
  const filtered = (entries ?? [])
    .filter((e) => filter === 'all' || e.type === filter)
    .filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const canReorder = filter === 'all' && !q

  // Backfill de `order` (una vez) por orden alfabético, para no reordenar de
  // golpe la wiki existente al estrenar el orden manual.
  useEffect(() => {
    if (!entries || entries.length === 0) return
    if (entries.every((e) => typeof e.order === 'number')) return
    const byName = [...entries].sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    )
    void reorderWiki(byName.map((e) => e.id))
  }, [entries])

  // Orden mostrado durante el arrastre: mueve la ficha arrastrada a la posición
  // de la que está bajo el cursor (efecto "rollo Trello").
  const shown =
    dragId && dragOverId && dragId !== dragOverId
      ? (() => {
          const arr = [...filtered]
          const from = arr.findIndex((e) => e.id === dragId)
          const to = arr.findIndex((e) => e.id === dragOverId)
          if (from < 0 || to < 0) return filtered
          const [m] = arr.splice(from, 1)
          arr.splice(to, 0, m)
          return arr
        })()
      : filtered

  function startReorder(id: string, e: ReactPointerEvent) {
    e.preventDefault()
    setDragId(id)
    setDragOverId(id)
    dragIdRef.current = id
    dragOverRef.current = id
    const base = filtered.map((x) => x.id)
    const onMove = (ev: PointerEvent) => {
      const el = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest('[data-wiki-card]') as HTMLElement | null
      const overId = el?.getAttribute('data-wiki-card') ?? null
      if (overId && overId !== dragOverRef.current) {
        dragOverRef.current = overId
        setDragOverId(overId)
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const from = base.indexOf(dragIdRef.current ?? '')
      const to = base.indexOf(dragOverRef.current ?? '')
      if (from >= 0 && to >= 0 && from !== to) {
        const arr = [...base]
        const [m] = arr.splice(from, 1)
        arr.splice(to, 0, m)
        void reorderWiki(arr)
      }
      setDragId(null)
      setDragOverId(null)
      dragIdRef.current = null
      dragOverRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function countOf(type: WikiType) {
    return entries?.filter((e) => e.type === type).length ?? 0
  }

  async function handleNew(type: WikiType) {
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]
    const id = await createWiki(projectId!, type, color)
    setChooserOpen(false)
    setSelectedId(id)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-7">
        {/* Cabecera */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Wiki</h1>
            <p className="text-sm text-muted-foreground">
              {entries?.length ?? '…'} fichas en tu enciclopedia
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="w-48 pl-9"
              />
            </div>
            <Button onClick={() => setChooserOpen(true)}>
              <Plus size={18} /> Nueva ficha
            </Button>
          </div>
        </div>

        {/* Filtros por tipo */}
        <div className="mb-6 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition',
              filter === 'all'
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            Todos ({entries?.length ?? 0})
          </button>
          {WIKI_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => setFilter(t.type)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
                filter === t.type
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {t.icon(14)} {t.plural} ({countOf(t.type)})
            </button>
          ))}
        </div>

        {/* Cuadrícula */}
        {entries === undefined ? (
          <div className="flex justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BookMarked size={26} />}
            title={search ? 'Sin resultados' : 'Tu wiki está vacía'}
            description={
              search
                ? 'Prueba con otra búsqueda.'
                : 'Crea fichas de tus personajes, lugares, facciones y todo lo que habite tu mundo.'
            }
            action={
              !search && (
                <Button onClick={() => setChooserOpen(true)}>
                  <Plus size={18} /> Crear primera ficha
                </Button>
              )
            }
          />
        ) : (
          <>
            {canReorder && (
              <p className="mb-2 text-xs text-muted-foreground">
                Arrastra por el asa <GripVertical size={12} className="inline" />{' '}
                para reordenar tus fichas.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => {
                const meta = wikiMeta(e.type)
                return (
                  <div
                    key={e.id}
                    data-wiki-card={e.id}
                    className={cn(
                      'group flex items-start gap-1.5 rounded-2xl border border-border bg-card p-4 transition',
                      dragId === e.id
                        ? 'opacity-40'
                        : 'hover:-translate-y-0.5 hover:shadow-md',
                      dragId &&
                        dragOverId === e.id &&
                        dragId !== e.id &&
                        'ring-2 ring-accent/50',
                    )}
                  >
                    {canReorder && (
                      <button
                        onPointerDown={(ev) => startReorder(e.id, ev)}
                        aria-label="Reordenar ficha"
                        title="Arrastra para reordenar"
                        className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/40 transition hover:text-muted-foreground active:cursor-grabbing"
                      >
                        <GripVertical size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedId(e.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <WikiAvatar
                        entry={e}
                        className="h-11 w-11 shrink-0 overflow-hidden rounded-xl text-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.name}</p>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {meta.icon(12)} {meta.label}
                        </span>
                        {e.summary && (
                          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                            {e.summary}
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Detalle (drawer) */}
      {selected && (
        <WikiDetail
          key={selected.id}
          entry={selected}
          onClose={() => setSelectedId(null)}
          onDelete={() => {
            void deleteWiki(selected)
            setSelectedId(null)
          }}
        />
      )}

      {/* Selector de tipo */}
      <Modal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="¿Qué quieres crear?"
      >
        <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-3">
          {WIKI_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => handleNew(t.type)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background px-4 py-5 transition hover:border-accent hover:bg-accent/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                {t.icon(20)}
              </span>
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
