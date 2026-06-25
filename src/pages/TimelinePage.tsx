import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Link2,
  Check,
  Zap,
  Search,
} from 'lucide-react'
import {
  db,
  type TimelineEvent,
  type WikiEntry,
  type Link,
  type Lane,
} from '@/lib/db'
import {
  insertEvent,
  createLink,
  deleteLink,
  deleteEvent,
  deleteWiki,
  migrateLegacyLanes,
} from '@/lib/repo'
import { LanesModal } from '@/components/timeline/LanesModal'
import { WikiAvatar } from '@/components/wiki/WikiAvatar'
import { MentionTextEditor } from '@/components/editor/MentionTextEditor'
import { TimelineVisual } from '@/components/timeline/TimelineVisual'
import { TimelineChrono } from '@/components/timeline/TimelineChrono'
import { WikiDetail } from '@/components/wiki/WikiDetail'
import { EntitySummary } from '@/components/wiki/EntitySummary'
import { wikiMeta } from '@/components/wikiMeta'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Label } from '@/components/ui/Field'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { PALETTE, now, cn } from '@/lib/utils'

function ConnectModal({
  open,
  onClose,
  event,
  entries,
  links,
  projectId,
}: {
  open: boolean
  onClose: () => void
  event: TimelineEvent
  entries: WikiEntry[]
  links: Link[]
  projectId: string
}) {
  const [q, setQ] = useState('')
  const connected = new Set(
    links
      .filter((l) => l.fromId === event.id && l.relType === 'involves')
      .map((l) => l.toId),
  )
  const filtered = entries.filter((e) =>
    e.name.toLowerCase().includes(q.trim().toLowerCase()),
  )

  async function toggle(entityId: string) {
    const existing = links.find(
      (l) =>
        l.fromId === event.id && l.toId === entityId && l.relType === 'involves',
    )
    if (existing) await deleteLink(existing.id)
    else
      await createLink(projectId, event.id, entityId, {
        fromKind: 'event',
        toKind: 'wiki',
        relType: 'involves',
      })
  }

  return (
    <Modal open={open} onClose={onClose} title="Conectar con la wiki" width="max-w-md">
      <div className="flex max-h-[60vh] flex-col p-4">
        <div className="relative mb-2">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ficha…"
            className="pl-8"
          />
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {entries.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              Crea fichas en la Wiki (personajes, lugares…) para conectarlas a
              este evento.
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((e) => {
                const on = connected.has(e.id)
                const meta = wikiMeta(e.type)
                return (
                  <button
                    key={e.id}
                    onClick={() => toggle(e.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition',
                      on
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    <WikiAvatar
                      entry={e}
                      className="h-8 w-8 shrink-0 overflow-hidden rounded-lg text-xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {e.name}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {meta.icon(11)} {meta.label}
                      </span>
                    </span>
                    {on && <Check size={16} className="shrink-0 text-accent" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function EventCard({
  event,
  index,
  total,
  entries,
  links,
  allEvents,
  lanes,
  projectId,
  onMove,
  onDelete,
  onEntityClick,
  onInsertAfter,
}: {
  event: TimelineEvent
  index: number
  total: number
  entries: WikiEntry[]
  links: Link[]
  allEvents: TimelineEvent[]
  lanes: Lane[]
  projectId: string
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onEntityClick: (entry: WikiEntry) => void
  onInsertAfter: () => void
}) {
  const [title, setTitle] = useState(event.title)
  const [dateLabel, setDateLabel] = useState(event.dateLabel)
  const [color, setColor] = useState(event.color)
  const [connectOpen, setConnectOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const pending = useRef<Partial<TimelineEvent>>({})

  function save(part: Partial<TimelineEvent>) {
    // Acumular para no perder un campo si se editan dos en <350 ms.
    pending.current = { ...pending.current, ...part }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const data = { ...pending.current, updatedAt: now() }
      pending.current = {}
      void db.events.update(event.id, data)
    }, 350)
  }

  const connectedEntities = links
    .filter((l) => l.fromId === event.id && l.relType === 'involves')
    .map((l) => entries.find((e) => e.id === l.toId))
    .filter((e): e is WikiEntry => !!e)

  const causeLink = links.find(
    (l) => l.toId === event.id && l.relType === 'cause',
  )
  const causeId = causeLink?.fromId ?? ''

  async function setCause(newId: string) {
    if (causeLink) await deleteLink(causeLink.id)
    if (newId)
      await createLink(projectId, newId, event.id, {
        fromKind: 'event',
        toKind: 'event',
        relType: 'cause',
        label: 'causa de',
      })
  }

  return (
    <div className="relative pl-12">
      <div className="absolute left-[18px] top-0 h-full w-px bg-border" />
      <div
        className="absolute left-3 top-5 h-3.5 w-3.5 rounded-full border-2 border-background"
        style={{ backgroundColor: color }}
      />

      <div className="mb-3 rounded-2xl border border-border bg-card p-4 transition hover:shadow-sm">
        <div className="flex items-start gap-2">
          <input
            value={dateLabel}
            onChange={(e) => {
              setDateLabel(e.target.value)
              save({ dateLabel: e.target.value })
            }}
            placeholder="Fecha / era…"
            className="w-36 shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30"
          />
          <select
            value={event.lane ?? ''}
            onChange={(e) =>
              void db.events.update(event.id, {
                lane: e.target.value || undefined,
                updatedAt: now(),
              })
            }
            title="Trama / carril (para la vista visual)"
            aria-label="Trama del evento"
            className="w-32 shrink-0 cursor-pointer rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Sin trama</option>
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              disabled={index === 0}
              onClick={() => onMove(-1)}
              aria-label="Mover evento antes"
              title="Mover antes"
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-25"
            >
              <ChevronUp size={15} />
            </button>
            <button
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              aria-label="Mover evento después"
              title="Mover después"
              className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-25"
            >
              <ChevronDown size={15} />
            </button>
            <button
              onClick={onInsertAfter}
              title="Insertar evento debajo"
              aria-label="Insertar evento debajo"
              className="rounded p-1 text-muted-foreground hover:text-accent"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={onDelete}
              aria-label="Eliminar evento"
              title="Eliminar evento"
              className="rounded p-1 text-muted-foreground hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value })
          }}
          placeholder="Título del evento"
          className="mt-2 w-full bg-transparent font-serif text-lg font-semibold outline-none placeholder:text-muted-foreground/50"
        />

        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
          <MentionTextEditor
            value={event.description}
            projectId={projectId}
            placeholder="¿Qué ocurre? Escribe @ para mencionar personajes o lugares…"
            onChange={(html) => save({ description: html })}
          />
        </div>

        {/* Causa (evento → evento) */}
        {allEvents.length > 1 && (
          <div className="mt-2 flex items-center gap-2">
            <Zap size={13} className="shrink-0 text-amber-500" />
            <span className="text-xs text-muted-foreground">Ocurre porque…</span>
            <select
              value={causeId}
              onChange={(e) => void setCause(e.target.value)}
              className="h-7 max-w-[55%] cursor-pointer rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none"
            >
              <option value="">— sin causa —</option>
              {allEvents
                .filter((ev) => ev.id !== event.id)
                .map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title || 'Sin título'}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Entidades conectadas */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {connectedEntities.map((e) => (
            <button
              key={e.id}
              title={`Ver ${e.name}`}
              onClick={() => onEntityClick(e)}
              className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2.5 text-xs transition hover:bg-accent/15 hover:text-accent"
            >
              <WikiAvatar
                entry={e}
                className="h-5 w-5 shrink-0 overflow-hidden rounded-full text-[9px]"
              />
              <span className="max-w-[90px] truncate">{e.name}</span>
            </button>
          ))}
          <button
            onClick={() => setConnectOpen(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-accent hover:text-accent"
          >
            <Link2 size={13} /> Conectar
          </button>

          <div className="ml-auto">
            <ColorPicker
              value={color}
              onChange={(c) => {
                setColor(c)
                save({ color: c })
              }}
              colors={PALETTE.slice(0, 6)}
              swatchClass="h-4 w-4"
            />
          </div>
        </div>
      </div>

      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        event={event}
        entries={entries}
        links={links}
        projectId={projectId}
      />
    </div>
  )
}

export function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [toDelete, setToDelete] = useState<TimelineEvent | null>(null)
  const [summaryEntry, setSummaryEntry] = useState<WikiEntry | null>(null)
  const [detailEntry, setDetailEntry] = useState<WikiEntry | null>(null)
  const [posOpen, setPosOpen] = useState(false)
  const [posMode, setPosMode] = useState<'start' | 'end' | 'after'>('end')
  const [posAfterId, setPosAfterId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState('#8b5cf6')
  const [newLane, setNewLane] = useState('')
  const [view, setView] = useState<'list' | 'visual' | 'chrono'>('list')
  const [lanesOpen, setLanesOpen] = useState(false)

  const events = useLiveQuery(
    () =>
      projectId
        ? db.events.where('projectId').equals(projectId).sortBy('sortIndex')
        : [],
    [projectId],
  )
  const lanes =
    useLiveQuery(
      () =>
        projectId
          ? db.lanes.where('projectId').equals(projectId).sortBy('order')
          : [],
      [projectId],
    ) ?? []

  useEffect(() => {
    if (projectId) void migrateLegacyLanes(projectId)
  }, [projectId])
  const entries = useLiveQuery(
    () =>
      projectId ? db.wiki.where('projectId').equals(projectId).toArray() : [],
    [projectId],
  )
  const links = useLiveQuery(
    () =>
      projectId ? db.links.where('projectId').equals(projectId).toArray() : [],
    [projectId],
  )

  const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)]

  function resetForm() {
    setNewTitle('')
    setNewDate('')
    setNewDesc('')
    setNewLane('')
    setNewColor(randomColor())
  }

  function openNew() {
    resetForm()
    setPosMode('end')
    setPosAfterId(events && events[0] ? events[0].id : '')
    setPosOpen(true)
  }

  function openInsertAfter(afterId: string) {
    resetForm()
    setPosMode('after')
    setPosAfterId(afterId)
    setPosOpen(true)
  }

  async function confirmNew() {
    await insertEvent(
      projectId!,
      {
        title: newTitle,
        dateLabel: newDate,
        description: newDesc,
        color: newColor,
        lane: newLane,
      },
      { mode: posMode, afterId: posMode === 'after' ? posAfterId : undefined },
    )
    setPosOpen(false)
  }

  async function move(ev: TimelineEvent, dir: -1 | 1) {
    if (!events) return
    const idx = events.findIndex((e) => e.id === ev.id)
    const target = idx + dir
    if (target < 0 || target >= events.length) return
    const other = events[target]
    await db.events.update(ev.id, { sortIndex: other.sortIndex })
    await db.events.update(other.id, { sortIndex: ev.sortIndex })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3.5">
        <div>
          <h1 className="font-serif text-xl font-semibold">Línea de tiempo</h1>
          <p className="text-xs text-muted-foreground">
            {events?.length ?? '…'} eventos · personajes, lugares y causas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLanesOpen(true)}>
            Tramas
          </Button>
          <div className="flex rounded-lg border border-border p-0.5">
            {(
              [
                ['list', 'Lista'],
                ['visual', 'Visual'],
                ['chrono', 'Cronología'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition',
                  view === id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button onClick={openNew}>
            <Plus size={18} /> Nuevo evento
          </Button>
        </div>
      </div>

      {view === 'visual' ? (
        <div className="flex-1">
          <TimelineVisual projectId={projectId!} />
        </div>
      ) : view === 'chrono' ? (
        <div className="flex-1 overflow-hidden">
          <TimelineChrono projectId={projectId!} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-7">
            {events && events.length === 0 ? (
              <EmptyState
                icon={<Clock size={26} />}
                title="Sin eventos todavía"
                description="Ordena los hitos de tu historia y conéctalos con los personajes y lugares que intervienen."
                action={
                  <Button onClick={openNew}>
                    <Plus size={18} /> Añadir evento
                  </Button>
                }
              />
            ) : (
              <div className="pt-1">
                {events?.map((ev, i) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    index={i}
                    total={events.length}
                    entries={entries ?? []}
                    links={links ?? []}
                    allEvents={events}
                    lanes={lanes}
                    projectId={projectId!}
                    onMove={(dir) => move(ev, dir)}
                    onDelete={() => setToDelete(ev)}
                    onEntityClick={(entry) => setSummaryEntry(entry)}
                    onInsertAfter={() => openInsertAfter(ev.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {summaryEntry && (
        <EntitySummary
          entry={summaryEntry}
          onClose={() => setSummaryEntry(null)}
          onOpenFull={() => {
            setDetailEntry(summaryEntry)
            setSummaryEntry(null)
          }}
        />
      )}

      {detailEntry && (
        <WikiDetail
          key={detailEntry.id}
          entry={detailEntry}
          onClose={() => setDetailEntry(null)}
          onDelete={() => {
            void deleteWiki(detailEntry)
            setDetailEntry(null)
          }}
        />
      )}

      <Modal
        open={posOpen}
        onClose={() => setPosOpen(false)}
        title="Nuevo evento — ¿dónde?"
        width="max-w-sm"
      >
        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-5">
          <div>
            <Label>Título</Label>
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="¿Qué ocurre?"
            />
          </div>
          <div>
            <Label>Fecha / era</Label>
            <Input
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              placeholder='Ej: "Año 312 de la Tercera Era"'
            />
          </div>
          <div>
            <Label>Trama / carril</Label>
            <div className="flex gap-2">
              <select
                value={newLane}
                onChange={(e) => setNewLane(e.target.value)}
                className="h-10 flex-1 cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              >
                <option value="">Sin trama</option>
                {lanes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => setLanesOpen(true)}>
                Gestionar
              </Button>
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Consecuencias, personajes implicados…"
            />
          </div>
          <div>
            <Label>Color</Label>
            <ColorPicker
              value={newColor}
              onChange={setNewColor}
              colors={PALETTE.slice(0, 6)}
            />
          </div>
          <div>
            <Label>Posición</Label>
            <div className="space-y-2">
              {(
                [
                  { id: 'start', label: 'Al principio' },
                  { id: 'end', label: 'Al final' },
                  { id: 'after', label: 'Después de un evento concreto' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPosMode(opt.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition',
                    posMode === opt.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'h-3.5 w-3.5 rounded-full border-2',
                      posMode === opt.id
                        ? 'border-accent bg-accent'
                        : 'border-border',
                    )}
                  />
                  {opt.label}
                </button>
              ))}
              {posMode === 'after' && (
                <select
                  value={posAfterId}
                  onChange={(e) => setPosAfterId(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
                >
                  {(events ?? []).map((ev, i) => (
                    <option key={ev.id} value={ev.id}>
                      {i + 1}. {ev.title || 'Sin título'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="ghost" onClick={() => setPosOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmNew}>Crear evento</Button>
        </div>
      </Modal>

      {projectId && (
        <LanesModal
          open={lanesOpen}
          onClose={() => setLanesOpen(false)}
          projectId={projectId}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar evento"
        message={`Se borrará "${toDelete?.title}" y sus conexiones.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          if (toDelete) {
            void deleteEvent(toDelete)
            toast('Evento eliminado')
          }
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
