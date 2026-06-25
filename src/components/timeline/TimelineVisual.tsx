import { useEffect, useRef, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnConnectStart,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Clock, Trash2, Check, Zap, Search } from 'lucide-react'
import { db, type TimelineEvent, type WikiEntry } from '@/lib/db'
import { createLink, deleteLink, deleteEvent, saveNodePos } from '@/lib/repo'
import { WikiAvatar } from '@/components/wiki/WikiAvatar'
import { wikiMeta } from '@/components/wikiMeta'
import { useResolvedDark } from '@/lib/theme'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { MentionTextEditor } from '@/components/editor/MentionTextEditor'
import { PALETTE, now, cn } from '@/lib/utils'

interface EventNodeData {
  event: TimelineEvent
  index: number
  entities: WikiEntry[]
}

function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function EventNode({ data }: NodeProps) {
  const d = data as unknown as EventNodeData
  const ev = d.event
  const desc = plain(ev.description)
  return (
    <div
      className="relative w-60 cursor-pointer rounded-xl border-2 bg-card p-3 shadow-sm transition hover:shadow-md"
      style={{ borderColor: ev.color }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-card !bg-amber-400"
      />
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {d.index + 1}
        </span>
        {ev.dateLabel && (
          <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {ev.dateLabel}
          </span>
        )}
      </div>
      <p className="font-serif text-sm font-semibold leading-tight">
        {ev.title || 'Sin título'}
      </p>
      {desc && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {desc}
        </p>
      )}
      {d.entities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {d.entities.slice(0, 6).map((e) => (
            <WikiAvatar
              key={e.id}
              entry={e}
              className="h-6 w-6 overflow-hidden rounded-full text-[8px] ring-2 ring-card"
            />
          ))}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-card !bg-amber-400"
      />
    </div>
  )
}

function LaneLabel({ data }: NodeProps) {
  const name = (data as { name?: string }).name || 'General'
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
      {name}
    </div>
  )
}

const nodeTypes = { event: EventNode, lane: LaneLabel }

function EventEditModal({
  event,
  projectId,
  entries,
  links,
  allEvents,
  lanes,
  onRelane,
  onClose,
  onDeleted,
}: {
  event: TimelineEvent
  projectId: string
  entries: WikiEntry[]
  links: import('@/lib/db').Link[]
  allEvents: TimelineEvent[]
  lanes: { id: string; name: string }[]
  onRelane: (eventId: string, newLane: string) => void
  onClose: () => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.dateLabel)
  const [lane, setLane] = useState(event.lane ?? '')
  const [color, setColor] = useState(event.color)
  const [q, setQ] = useState('')
  const timer = useRef<number | null>(null)
  const pending = useRef<Partial<TimelineEvent>>({})

  function patch(part: Partial<TimelineEvent>, immediate = false) {
    if (immediate) {
      void db.events.update(event.id, { ...part, updatedAt: now() })
      return
    }
    // Acumular para no perder un campo si se editan dos en <350 ms.
    pending.current = { ...pending.current, ...part }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const data = { ...pending.current, updatedAt: now() }
      pending.current = {}
      void db.events.update(event.id, data)
    }, 350)
  }

  const connected = new Set(
    links
      .filter((l) => l.fromId === event.id && l.relType === 'involves')
      .map((l) => l.toId),
  )
  async function toggleEntity(id: string) {
    const existing = links.find(
      (l) => l.fromId === event.id && l.toId === id && l.relType === 'involves',
    )
    if (existing) await deleteLink(existing.id)
    else
      await createLink(projectId, event.id, id, {
        fromKind: 'event',
        toKind: 'wiki',
        relType: 'involves',
      })
  }

  const causeLink = links.find(
    (l) => l.toId === event.id && l.relType === 'cause',
  )
  async function setCause(newId: string) {
    if (causeLink) await deleteLink(causeLink.id)
    if (newId)
      await createLink(projectId, newId, event.id, {
        fromKind: 'event',
        toKind: 'event',
        relType: 'cause',
        label: 'porque',
      })
  }

  return (
    <Modal open onClose={onClose} title="Editar evento" width="max-w-lg">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
        <div>
          <Label>Título</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              patch({ title: e.target.value })
            }}
            placeholder="Título del evento"
          />
        </div>
        <div>
          <Label>Fecha / era</Label>
          <Input
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              patch({ dateLabel: e.target.value })
            }}
            placeholder='Ej: "Año 312 de la Tercera Era"'
          />
        </div>
        <div>
          <Label>Trama / carril</Label>
          <select
            value={lane}
            onChange={(e) => {
              setLane(e.target.value)
              patch({ lane: e.target.value || undefined }, true)
              // Mover el evento a la fila de la nueva trama en la vista.
              onRelane(event.id, e.target.value)
            }}
            className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">Sin trama</option>
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Descripción</Label>
          <div className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <MentionTextEditor
              value={event.description}
              projectId={projectId}
              placeholder="¿Qué ocurre? Escribe @ para mencionar…"
              onChange={(html) => patch({ description: html }, true)}
            />
          </div>
        </div>
        <div>
          <Label>Color</Label>
          <ColorPicker
            value={color}
            onChange={(c) => {
              setColor(c)
              patch({ color: c }, true)
            }}
            colors={PALETTE.slice(0, 6)}
          />
        </div>

        {allEvents.length > 1 && (
          <div>
            <Label>Causa (ocurre porque…)</Label>
            <select
              defaultValue={causeLink?.fromId ?? ''}
              onChange={(e) => void setCause(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
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

        <div>
          <Label>Personajes y lugares conectados</Label>
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Crea fichas en la Wiki para conectarlas.
            </p>
          ) : (
            <>
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
              <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto">
                {entries
                  .filter((e) =>
                    e.name.toLowerCase().includes(q.trim().toLowerCase()),
                  )
                  .map((e) => {
                const on = connected.has(e.id)
                const meta = wikiMeta(e.type)
                return (
                  <button
                    key={e.id}
                    onClick={() => toggleEntity(e.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition',
                      on
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    <WikiAvatar
                      entry={e}
                      className="h-7 w-7 shrink-0 overflow-hidden rounded-lg text-xs"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {e.name}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {meta.icon(10)}
                    </span>
                    {on && <Check size={15} className="shrink-0 text-accent" />}
                  </button>
                    )
                  })}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <Button
          variant="ghost"
          className="text-danger hover:bg-danger/10"
          onClick={async () => {
            await deleteEvent(event)
            onDeleted()
          }}
        >
          <Trash2 size={16} /> Eliminar
        </Button>
        <Button onClick={onClose}>Listo</Button>
      </div>
    </Modal>
  )
}

export function TimelineVisual({ projectId }: { projectId: string }) {
  const isDark = useResolvedDark()
  const events = useLiveQuery(
    () => db.events.where('projectId').equals(projectId).sortBy('sortIndex'),
    [projectId],
  )
  const links = useLiveQuery(
    () => db.links.where('projectId').equals(projectId).toArray(),
    [projectId],
  )
  const entries = useLiveQuery(
    () => db.wiki.where('projectId').equals(projectId).toArray(),
    [projectId],
  )
  const layout = useLiveQuery(
    () => db.layout.where('projectId').equals(projectId).toArray(),
    [projectId],
  )
  const laneRows =
    useLiveQuery(
      () => db.lanes.where('projectId').equals(projectId).sortBy('order'),
      [projectId],
    ) ?? []

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [editId, setEditId] = useState<string | null>(null)
  const rf = useRef<ReactFlowInstance<Node, Edge> | null>(null)

  const layoutMap = new Map((layout ?? []).map((l) => [l.id, { x: l.x, y: l.y }]))

  const LANE_H = 220
  const laneOrder: { id: string; name: string }[] = [
    { id: '', name: 'Sin trama' },
    ...laneRows.map((l) => ({ id: l.id, name: l.name })),
  ]
  const laneIndexOf = (laneId: string | undefined) => {
    const i = laneOrder.findIndex((l) => l.id === (laneId || ''))
    return i < 0 ? 0 : i
  }

  const sig =
    (events ?? [])
      .map((e) => `${e.id}|${e.title}|${e.dateLabel}|${e.color}|${e.lane ?? ''}`)
      .join(';') +
    '::' +
    (links ?? [])
      .filter((l) => l.relType === 'involves' || l.relType === 'cause')
      .map((l) => `${l.id}|${l.fromId}|${l.toId}|${l.relType}`)
      .join(';')

  // Construir nodos (posiciones: guardadas > previas > por orden cronológico)
  useEffect(() => {
    if (!events) return
    const ents = entries ?? []
    const lks = links ?? []
    const entById = new Map(ents.map((e) => [e.id, e]))
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]))
      const eventNodes: Node[] = events.map((ev, i) => {
        const connected = lks
          .filter((l) => l.fromId === ev.id && l.relType === 'involves')
          .map((l) => entById.get(l.toId))
          .filter((e): e is WikiEntry => !!e)
        const laneY = laneIndexOf(ev.lane) * LANE_H
        return {
          id: ev.id,
          type: 'event',
          position:
            prevPos.get(ev.id) ??
            layoutMap.get(ev.id) ?? { x: i * 300, y: laneY },
          data: { event: ev, index: i, entities: connected },
        }
      })
      const laneNodes: Node[] =
        laneRows.length > 0
          ? laneOrder.map((l, li) => ({
              id: 'lane-' + (l.id || 'none'),
              type: 'lane',
              position: { x: -210, y: li * LANE_H + 40 },
              data: { name: l.name },
              draggable: false,
              selectable: false,
              deletable: false,
            }))
          : []
      return [...laneNodes, ...eventNodes]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, layout, laneRows])

  // Construir aristas causa→efecto
  useEffect(() => {
    const eventIds = new Set((events ?? []).map((e) => e.id))
    setEdges(
      (links ?? [])
        .filter(
          (l) =>
            l.relType === 'cause' &&
            eventIds.has(l.fromId) &&
            eventIds.has(l.toId),
        )
        .map((l) => ({
          id: l.id,
          source: l.fromId,
          target: l.toId,
          label: 'porque',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
          style: { stroke: '#f59e0b', strokeWidth: 2 },
          labelBgStyle: { fill: isDark ? '#1b1924' : '#ffffff' },
          labelStyle: { fill: '#f59e0b', fontSize: 10, fontWeight: 600 },
          labelBgPadding: [5, 2] as [number, number],
          labelBgBorderRadius: 5,
        })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, isDark])

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      if (node.type !== 'event') return
      const ev = (events ?? []).find((e) => e.id === node.id)
      // Si hay tramas, soltar en otra fila reasigna la trama de verdad (y la fija)
      if (laneRows.length > 0 && ev) {
        const li = Math.max(
          0,
          Math.min(laneOrder.length - 1, Math.round(node.position.y / LANE_H)),
        )
        const newLaneId = laneOrder[li].id
        const snappedY = li * LANE_H
        if ((ev.lane || '') !== newLaneId) {
          void db.events.update(node.id, {
            lane: newLaneId || undefined,
            updatedAt: now(),
          })
        }
        setNodes((ns) =>
          ns.map((n) =>
            n.id === node.id
              ? { ...n, position: { x: node.position.x, y: snappedY } }
              : n,
          ),
        )
        void saveNodePos(node.id, projectId, node.position.x, snappedY)
        return
      }
      void saveNodePos(node.id, projectId, node.position.x, node.position.y)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, sig, laneRows],
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => setEditId(node.id),
    [],
  )

  // Arrastrar de un evento a otro = crear causa→efecto (origen → destino)
  const connectStart = useRef<string | null>(null)
  const onConnectStart: OnConnectStart = useCallback((_e, params) => {
    connectStart.current = params.nodeId ?? null
  }, [])
  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return
      const start = connectStart.current
      let from = c.source
      let to = c.target
      if (start && (c.source === start || c.target === start)) {
        from = start
        to = c.source === start ? c.target : c.source
      }
      void createLink(projectId, from, to, {
        fromKind: 'event',
        toKind: 'event',
        relType: 'cause',
        label: 'porque',
      })
    },
    [projectId],
  )

  // Cambiar la trama desde el desplegable mueve el evento a la fila correcta
  // (conservando su X cronológica) y lo persiste, para que se vea al instante.
  function relane(eventId: string, newLane: string) {
    if (laneRows.length === 0) return
    const y = laneIndexOf(newLane) * LANE_H
    const cur = nodes.find((n) => n.id === eventId)
    const x = cur?.position.x ?? layoutMap.get(eventId)?.x ?? 0
    setNodes((ns) =>
      ns.map((n) => (n.id === eventId ? { ...n, position: { x, y } } : n)),
    )
    void saveNodePos(eventId, projectId, x, y)
  }

  function arrangeByLanes() {
    if (!events) return
    const updated = events.map((ev, i) => ({
      id: ev.id,
      x: i * 300,
      y: laneIndexOf(ev.lane) * LANE_H,
    }))
    setNodes((ns) =>
      ns.map((n) => {
        const u = updated.find((x) => x.id === n.id)
        return u ? { ...n, position: { x: u.x, y: u.y } } : n
      }),
    )
    for (const u of updated) void saveNodePos(u.id, projectId, u.x, u.y)
    // Reencuadrar para que los eventos reorganizados queden a la vista (si no,
    // tras hacer zoom/pan podían quedar fuera de pantalla = "desaparecen").
    window.setTimeout(() => rf.current?.fitView({ duration: 400, padding: 0.2 }), 80)
  }

  const editEvent = (events ?? []).find((e) => e.id === editId) ?? null

  if (events && events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={<Clock size={26} />}
          title="Sin eventos para la vista visual"
          description="Crea eventos en la vista de lista y aquí los verás en el tiempo, con sus conexiones causa→efecto."
        />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(inst) => {
          rf.current = inst
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        colorMode={isDark ? 'dark' : 'light'}
        fitView
        minZoom={0.2}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        {/* Elevado para no quedar tapado por el dock de enfoque (abajo-derecha). */}
        <MiniMap pannable zoomable style={{ marginBottom: 84, marginRight: 10 }} />
      </ReactFlow>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <Zap size={13} className="text-amber-500" />
        Clic = editar · arrastra para mover · une dos eventos para causa→efecto
      </div>

      <div className="absolute right-4 top-4 z-10">
        <Button variant="outline" size="sm" onClick={arrangeByLanes}>
          Ordenar por tramas
        </Button>
      </div>

      {editEvent && (
        <EventEditModal
          event={editEvent}
          projectId={projectId}
          entries={entries ?? []}
          links={links ?? []}
          allEvents={events ?? []}
          lanes={laneRows}
          onRelane={relane}
          onClose={() => setEditId(null)}
          onDeleted={() => setEditId(null)}
        />
      )}
    </div>
  )
}
