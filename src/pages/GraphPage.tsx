import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  ConnectionMode,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnNodeDrag,
  type OnConnectStart,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import {
  Plus,
  Share2,
  Trash2,
  SlidersHorizontal,
  Search,
  Wand2,
  TreePine,
} from 'lucide-react'
import { db, type WikiEntry, type Link, type WikiType } from '@/lib/db'
import {
  createLink,
  updateLink,
  deleteLink,
  deleteWiki,
  saveNodePos,
} from '@/lib/repo'
import { REL_TYPES, relMeta } from '@/lib/constants'
import { toast } from '@/lib/toast'
import { WIKI_TYPES, wikiMeta } from '@/components/wikiMeta'
import { WikiAvatar } from '@/components/wiki/WikiAvatar'
import { WikiDetail } from '@/components/wiki/WikiDetail'
import { FamilyTree } from '@/components/wiki/FamilyTree'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Label, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { useResolvedDark } from '@/lib/theme'
import { cn } from '@/lib/utils'

function EntityNode({ data }: NodeProps) {
  const entry = data.entry as WikiEntry
  const meta = wikiMeta(entry.type)
  return (
    <div
      className="relative flex items-center gap-2 overflow-hidden rounded-xl border-2 bg-card py-2 pl-4 pr-3 shadow-sm"
      style={{ borderColor: entry.color }}
    >
      {/* Franja de color por categoría */}
      <span
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ backgroundColor: meta.color }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-card !bg-accent"
      />
      <WikiAvatar
        entry={entry}
        className="h-9 w-9 shrink-0 overflow-hidden rounded-lg text-sm"
      />
      <div className="min-w-0">
        <p className="max-w-[130px] truncate text-sm font-medium">{entry.name}</p>
        <span
          className="mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
            color: meta.color,
          }}
        >
          {meta.icon(10)} {meta.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-card !bg-accent"
      />
    </div>
  )
}

const nodeTypes = { entity: EntityNode }

/** Vínculos de parentesco (van al árbol genealógico). El resto son "sociales". */
const FAMILY_REL_IDS = new Set(['family', 'spouse', 'sibling'])
const SOCIAL_REL_IDS = REL_TYPES.map((r) => r.id).filter(
  (id) => !FAMILY_REL_IDS.has(id),
)

function circlePos(i: number, n: number) {
  const R = 110 + n * 22
  const a = (i / Math.max(1, n)) * Math.PI * 2
  return { x: 360 + Math.cos(a) * R, y: 260 + Math.sin(a) * R }
}

/** Ids del nodo enfocado + sus vecinos directos. */
function neighborIds(focusId: string, links: Link[]): Set<string> {
  const s = new Set<string>([focusId])
  for (const l of links) {
    if (l.fromId === focusId) s.add(l.toId)
    if (l.toId === focusId) s.add(l.fromId)
  }
  return s
}

/** Calcula posiciones automáticas con dagre (layout jerárquico). */
function dagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 70, ranksep: 110 })
  const W = 210
  const H = 60
  nodes.forEach((n) => g.setNode(n.id, { width: W, height: H }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - W / 2, y: p.y - H / 2 } }
  })
}

function LinkModal({
  projectId,
  entries,
  editLink,
  addOpen,
  onClose,
  onSaved,
}: {
  projectId: string
  entries: WikiEntry[]
  editLink: Link | null
  addOpen: boolean
  onClose: () => void
  onSaved?: () => void
}) {
  const open = !!editLink || addOpen
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [label, setLabel] = useState('')
  const [relType, setRelType] = useState('other')
  const [strength, setStrength] = useState(0)

  useEffect(() => {
    if (editLink) {
      setFromId(editLink.fromId)
      setToId(editLink.toId)
      setLabel(editLink.label)
      setRelType(editLink.relType)
      setStrength(editLink.strength ?? 0)
    } else if (addOpen) {
      setFromId(entries[0]?.id ?? '')
      setToId(entries[1]?.id ?? entries[0]?.id ?? '')
      setLabel('')
      setRelType('other')
      setStrength(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLink, addOpen])

  const name = (id: string) => entries.find((e) => e.id === id)?.name ?? '—'

  async function save() {
    const strengthVal = strength === 0 ? undefined : strength
    if (editLink) {
      await updateLink(editLink.id, { label, relType, strength: strengthVal })
    } else if (fromId && toId && fromId !== toId) {
      await createLink(projectId, fromId, toId, {
        label,
        relType,
        strength: strengthVal,
      })
    }
    onSaved?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editLink ? 'Editar relación' : 'Nueva relación'}
      width="max-w-md"
    >
      <div className="space-y-4 px-5 py-5">
        {editLink ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{name(editLink.fromId)}</span>{' '}
            →{' '}
            <span className="font-medium text-foreground">{name(editLink.toId)}</span>
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label>Desde</Label>
              <Select value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
            <span className="mt-6 text-muted-foreground">→</span>
            <div className="flex-1">
              <Label>Hacia</Label>
              <Select value={toId} onChange={(e) => setToId(e.target.value)}>
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div>
          <Label>Motivo del vínculo</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="hermano de, mató a, mentor de…"
            autoFocus
          />
        </div>

        <div>
          <Label>Tipo</Label>
          <div className="flex flex-wrap gap-1.5">
            {REL_TYPES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRelType(r.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
                  relType === r.id
                    ? 'border-transparent text-white'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
                style={
                  relType === r.id ? { backgroundColor: r.color } : undefined
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
                {r.label}
              </button>
            ))}
          </div>
          {relType === 'family' && (
            <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
              «Familia» es dirigida para el árbol genealógico:{' '}
              <span className="font-medium text-foreground">Desde</span> = padre/madre
              → <span className="font-medium text-foreground">Hacia</span> = hijo/a.
              Para parejas usa «Cónyuge»; para hermanos, «Hermano».
            </p>
          )}
        </div>

        <div>
          <Label>Intensidad de la relación</Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={-100}
              max={100}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-accent"
            />
            <span
              className="w-10 text-right text-sm font-semibold tabular-nums"
              style={{
                color:
                  strength > 0
                    ? '#10b981'
                    : strength < 0
                      ? '#f43f5e'
                      : undefined,
              }}
            >
              {strength > 0 ? '+' : ''}
              {strength}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Hostil</span>
            <span>Neutral</span>
            <span>Afín</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-4">
        {editLink ? (
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger/10"
            onClick={async () => {
              await deleteLink(editLink.id)
              onSaved?.() // se borró a propósito; no lo trates como "cancelado"
              onClose()
              toast('Vínculo eliminado')
            }}
          >
            <Trash2 size={16} /> Eliminar
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}

/** Filtros del grafo persistidos por proyecto (para que NO se pierdan al navegar
 *  entre menús). Guardados en localStorage como arrays (los Set no son JSON). */
function loadGraphFilters(projectId: string): { cats: string[]; rels: string[] } {
  try {
    const raw = localStorage.getItem(`lw-graph-filters-${projectId}`)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { cats: [], rels: [] }
}
function saveGraphFilters(projectId: string, cats: string[], rels: string[]) {
  try {
    localStorage.setItem(
      `lw-graph-filters-${projectId}`,
      JSON.stringify({ cats, rels }),
    )
  } catch {
    /* ignore */
  }
}

function GraphInner() {
  const { projectId } = useParams<{ projectId: string }>()
  const isDark = useResolvedDark()
  const rf = useReactFlow()

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
  const layout = useLiveQuery(
    () =>
      projectId ? db.layout.where('projectId').equals(projectId).toArray() : [],
    [projectId],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedWikiId, setSelectedWikiId] = useState<string | null>(null)
  const [editLinkId, setEditLinkId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [hiddenCats, setHiddenCats] = useState<Set<WikiType>>(
    () => new Set(loadGraphFilters(projectId ?? '').cats as WikiType[]),
  )
  const [hiddenRels, setHiddenRels] = useState<Set<string>>(
    () => new Set(loadGraphFilters(projectId ?? '').rels),
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [familyOpen, setFamilyOpen] = useState(false)

  const catsKey = [...hiddenCats].join(',')
  const relsKey = [...hiddenRels].join(',')

  // Persistir los filtros para que sobrevivan al cambiar de menú.
  useEffect(() => {
    if (projectId) saveGraphFilters(projectId, [...hiddenCats], [...hiddenRels])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, catsKey, relsKey])

  function toggleCat(t: WikiType) {
    setHiddenCats((s) => {
      const n = new Set(s)
      if (n.has(t)) n.delete(t)
      else n.add(t)
      return n
    })
  }
  function toggleRel(id: string) {
    setHiddenRels((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // Vista rápida de vínculos: Todas / solo Sociales / solo Familia.
  function setRelView(v: 'all' | 'social' | 'family') {
    if (v === 'all') setHiddenRels(new Set())
    else if (v === 'social') setHiddenRels(new Set(FAMILY_REL_IDS))
    else setHiddenRels(new Set(SOCIAL_REL_IDS))
  }
  const relView: 'all' | 'social' | 'family' | 'custom' =
    hiddenRels.size === 0
      ? 'all'
      : hiddenRels.size === FAMILY_REL_IDS.size &&
          [...hiddenRels].every((r) => FAMILY_REL_IDS.has(r))
        ? 'social'
        : hiddenRels.size === SOCIAL_REL_IDS.length &&
            [...hiddenRels].every((r) => SOCIAL_REL_IDS.includes(r))
          ? 'family'
          : 'custom'

  const layoutMap = useMemo(
    () => new Map((layout ?? []).map((l) => [l.id, { x: l.x, y: l.y }])),
    [layout],
  )

  const entriesSig = (entries ?? [])
    .map((e) => `${e.id}|${e.name}|${e.color}|${e.coverImageId ?? ''}|${e.type}`)
    .join(';')

  const linksSig = (links ?? [])
    .map(
      (l) =>
        `${l.id}|${l.fromId}|${l.toId}|${l.label}|${l.relType}|${l.strength ?? ''}`,
    )
    .join(';')

  const presentTypes = WIKI_TYPES.filter((t) =>
    (entries ?? []).some((e) => e.type === t.type),
  )

  useEffect(() => {
    if (!entries) return
    const neigh = focusId ? neighborIds(focusId, links ?? []) : null
    const q = search.trim().toLowerCase()
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]))
      return entries.map((e, i) => {
        const dim =
          (!!neigh && !neigh.has(e.id)) ||
          (!!q && !e.name.toLowerCase().includes(q))
        return {
          id: e.id,
          type: 'entity',
          position:
            prevPos.get(e.id) ??
            layoutMap.get(e.id) ??
            circlePos(i, entries.length),
          data: { entry: e },
          hidden: hiddenCats.has(e.type),
          style: { opacity: dim ? 0.2 : 1, transition: 'opacity 0.2s' },
        }
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesSig, layoutMap, focusId, linksSig, catsKey, search])

  useEffect(() => {
    const hiddenNodeIds = new Set(
      (entries ?? []).filter((e) => hiddenCats.has(e.type)).map((e) => e.id),
    )
    setEdges(
      (links ?? [])
        .filter((l) => {
          if (hiddenRels.has(l.relType)) return false
          if (hiddenNodeIds.has(l.fromId) || hiddenNodeIds.has(l.toId))
            return false
          return true
        })
        .map((l) => {
          const c = relMeta(l.relType).color
          const dim = focusId
            ? l.fromId !== focusId && l.toId !== focusId
            : false
          // Diplomacy web: grosor y etiqueta por intensidad (−100..+100).
          const s = l.strength ?? 0
          const sLabel = s !== 0 ? `${s > 0 ? '+' : ''}${s}` : ''
          const label = [l.label, sLabel].filter(Boolean).join('  ') || undefined
          return {
            id: l.id,
            source: l.fromId,
            target: l.toId,
            label,
            markerEnd: { type: MarkerType.ArrowClosed, color: c },
            style: {
              stroke: c,
              strokeWidth: 2 + (Math.abs(s) / 100) * 5,
              opacity: dim ? 0.1 : 1,
            },
            labelBgStyle: { fill: isDark ? '#1b1924' : '#ffffff' },
            labelStyle: { fill: isDark ? '#eceaf3' : '#211f1d', fontSize: 11 },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 6,
          }
        }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linksSig, isDark, focusId, relsKey, catsKey, entriesSig])

  // Nodo donde EMPIEZA el arrastre, para fijar la dirección de la flecha
  const connectStart = useRef<string | null>(null)
  // Vínculo recién creado al arrastrar; si se cancela el modal, se borra.
  const justCreatedLink = useRef<string | null>(null)
  const onConnectStart: OnConnectStart = useCallback((_e, params) => {
    connectStart.current = params.nodeId ?? null
  }, [])

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || !projectId || c.source === c.target) return
      // La flecha va del nodo donde empezó el arrastre al nodo donde se soltó.
      const start = connectStart.current
      let from = c.source
      let to = c.target
      if (start && (c.source === start || c.target === start)) {
        from = start
        to = c.source === start ? c.target : c.source
      }
      void createLink(projectId, from, to).then((id) => {
        justCreatedLink.current = id
        setEditLinkId(id)
      })
    },
    [projectId],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      if (projectId)
        void saveNodePos(node.id, projectId, node.position.x, node.position.y)
    },
    [projectId],
  )

  // Al buscar, además de atenuar los no-coincidentes, encuadra los que sí
  // coinciden para que el usuario los vea (antes solo se resaltaban).
  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) return
    const t = window.setTimeout(() => {
      const matches = (entries ?? []).filter(
        (e) => !hiddenCats.has(e.type) && e.name.toLowerCase().includes(q),
      )
      if (matches.length) {
        rf.fitView({
          nodes: matches.map((e) => ({ id: e.id })),
          duration: 500,
          padding: 0.4,
          maxZoom: 1.4,
        })
      }
    }, 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, entriesSig, catsKey])

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => setFocusId((f) => (f === node.id ? null : node.id)),
    [],
  )
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_e, node) => setSelectedWikiId(node.id),
    [],
  )
  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_e, edge) => setEditLinkId(edge.id),
    [],
  )

  function autoLayout() {
    const laid = dagreLayout(nodes, edges, 'TB')
    setNodes(laid)
    if (projectId) {
      for (const n of laid) {
        void saveNodePos(n.id, projectId, n.position.x, n.position.y)
      }
    }
    window.setTimeout(() => rf.fitView({ duration: 400, padding: 0.2 }), 60)
  }

  const selectedEntry = entries?.find((e) => e.id === selectedWikiId) ?? null
  const editLink = editLinkId
    ? (links ?? []).find((l) => l.id === editLinkId) ?? null
    : null

  const empty = entries && entries.length === 0

  return (
    <div className="relative h-full w-full">
      {empty ? (
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            icon={<Share2 size={26} />}
            title="Aún no hay entidades que enlazar"
            description="Crea personajes, lugares y facciones en la Wiki y aquí podrás conectarlos: quién conoce a quién, quién odia a quién y por qué."
          />
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => setFocusId(null)}
          connectionMode={ConnectionMode.Loose}
          colorMode={isDark ? 'dark' : 'light'}
          fitView
          minZoom={0.2}
        >
          <Background gap={22} />
          <Controls showInteractive={false} />
          {/* Elevado para no quedar tapado por el dock de enfoque (abajo-derecha). */}
          <MiniMap pannable zoomable style={{ marginBottom: 84, marginRight: 10 }} />
        </ReactFlow>
      )}

      {/* Cabecera flotante */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="pointer-events-auto rounded-xl border border-border bg-card/90 px-3.5 py-2 shadow-sm backdrop-blur">
          <h1 className="font-serif text-lg font-semibold">Relaciones</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Clic en un nodo = resaltar vecinos · doble clic = abrir ficha · arrastra entre nodos para enlazar
          </p>
        </div>
        {!empty && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nodo…"
                aria-label="Buscar nodo en el grafo"
                className="h-9 w-44 rounded-lg border border-border bg-card pl-8 pr-3 text-sm outline-none focus:border-accent"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setFamilyOpen(true)}
              title="Abrir el árbol genealógico"
            >
              <TreePine size={16} /> Árbol
            </Button>
            <Button variant="outline" onClick={autoLayout} title="Ordenar el grafo automáticamente">
              <Wand2 size={16} /> Ordenar
            </Button>
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              {(
                [
                  ['all', 'Todas'],
                  ['social', 'Sociales'],
                  ['family', 'Familia'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setRelView(id)}
                  title={
                    id === 'social'
                      ? 'Ver solo relaciones sociales (aliados, enemigos, romances, mentores…)'
                      : id === 'family'
                        ? 'Ver solo vínculos de parentesco'
                        : 'Ver todos los vínculos'
                  }
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-sm transition',
                    relView === id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setFiltersOpen((o) => !o)}>
              <SlidersHorizontal size={16} /> Filtros
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={18} /> Relación
            </Button>
          </div>
        )}
      </div>

      {filtersOpen && !empty && (
        <div className="pointer-events-auto absolute right-4 top-20 z-10 w-64 rounded-xl border border-border bg-card p-3 shadow-xl">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Categorías
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {WIKI_TYPES.map((t) => {
              const off = hiddenCats.has(t.type)
              return (
                <button
                  key={t.type}
                  onClick={() => toggleCat(t.type)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition',
                    off
                      ? 'border-border text-muted-foreground opacity-50'
                      : 'border-accent/40 bg-accent/10 text-accent',
                  )}
                >
                  {t.icon(11)} {t.plural}
                </button>
              )
            })}
          </div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Relaciones
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REL_TYPES.map((r) => {
              const off = hiddenRels.has(r.id)
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRel(r.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                    off
                      ? 'border-border text-muted-foreground opacity-50'
                      : 'border-transparent text-white',
                  )}
                  style={off ? undefined : { backgroundColor: r.color }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: off ? r.color : 'rgba(255,255,255,.85)',
                    }}
                  />
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!empty && presentTypes.length > 0 && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card/90 px-3.5 py-2 text-[11px] shadow-sm backdrop-blur">
          {presentTypes.map((t) => (
            <span key={t.type} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              {t.plural}
            </span>
          ))}
        </div>
      )}

      {selectedEntry && (
        <WikiDetail
          key={selectedEntry.id}
          entry={selectedEntry}
          onClose={() => setSelectedWikiId(null)}
          onDelete={() => {
            void deleteWiki(selectedEntry)
            setSelectedWikiId(null)
          }}
        />
      )}

      <LinkModal
        projectId={projectId!}
        entries={entries ?? []}
        editLink={editLink}
        addOpen={addOpen}
        onSaved={() => {
          justCreatedLink.current = null
        }}
        onClose={() => {
          // Si se creó al arrastrar y se cancela sin guardar, borrar el vínculo.
          if (justCreatedLink.current) {
            void deleteLink(justCreatedLink.current)
            justCreatedLink.current = null
          }
          setEditLinkId(null)
          setAddOpen(false)
        }}
      />

      {familyOpen && (
        <FamilyTree
          entries={entries ?? []}
          links={links ?? []}
          initialRootId={focusId}
          onClose={() => setFamilyOpen(false)}
          onOpenEntry={(id) => setSelectedWikiId(id)}
        />
      )}
    </div>
  )
}

export function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  )
}
