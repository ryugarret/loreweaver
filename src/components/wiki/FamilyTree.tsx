import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  TreePine,
  BookOpen,
  Mars,
  Venus,
  Users,
} from 'lucide-react'
import type { WikiEntry, Link } from '@/lib/db'
import { computeFamilyLayout, familyMemberIds, isPlaceholder } from '@/lib/familyTree'
import { wikiMeta } from '@/components/wikiMeta'
import { WikiAvatar } from './WikiAvatar'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

/* Geometría de la cuadrícula de relatives-tree.
   Las posiciones (left/top) vienen en "medias celdas": cada nodo ocupa 2
   unidades, así que 1 unidad = la mitad de una celda. La tarjeta se centra
   dentro de su celda dejando un hueco (GAP) por el que pasan los conectores. */
const CARD_W = 148
const CARD_H = 104
const GAP_X = 34
const GAP_Y = 62
const CELL_W = CARD_W + GAP_X
const CELL_H = CARD_H + GAP_Y
const UNIT_X = CELL_W / 2
const UNIT_Y = CELL_H / 2
const PAD = 90
const LINE = 2
const MIN_Z = 0.25
const MAX_Z = 1.6

function genderColor(g?: 'male' | 'female') {
  if (g === 'male') return '#38bdf8'
  if (g === 'female') return '#f472b6'
  return 'var(--border)'
}

export function FamilyTree({
  entries,
  links,
  initialRootId,
  onClose,
  onOpenEntry,
}: {
  entries: WikiEntry[]
  links: Link[]
  initialRootId?: string | null
  onClose: () => void
  onOpenEntry: (id: string) => void
}) {
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  const entriesSig = entries
    .map(
      (e) =>
        `${e.id}|${e.gender ?? ''}|${e.name}|${e.color}|${e.coverImageId ?? ''}`,
    )
    .join(';')
  const linksSig = links
    .filter(
      (l) =>
        l.relType === 'family' ||
        l.relType === 'spouse' ||
        l.relType === 'sibling',
    )
    .map((l) => `${l.id}|${l.fromId}|${l.toId}|${l.relType}`)
    .join(';')

  const members = useMemo(() => {
    const ids = familyMemberIds(entries, links)
    return entries
      .filter((e) => ids.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesSig, linksSig])

  const [rootId, setRootId] = useState<string>(initialRootId ?? '')
  const [gen, setGen] = useState<number>(Infinity)
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  // La raíz tiene que ser un miembro válido del árbol.
  useEffect(() => {
    if (!members.length) return
    setRootId((cur) => {
      if (members.some((m) => m.id === cur)) return cur
      if (initialRootId && members.some((m) => m.id === initialRootId))
        return initialRootId
      return members[0].id
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members])

  const layout = useMemo(
    () => (rootId ? computeFamilyLayout(entries, links, rootId, gen) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entriesSig, linksSig, rootId, gen],
  )

  const canvasW = layout ? layout.canvas.width * UNIT_X : 0
  const canvasH = layout ? layout.canvas.height * UNIT_Y : 0
  const stageW = canvasW + 2 * PAD
  const stageH = canvasH + 2 * PAD

  const fit = useCallback(() => {
    const vp = scrollRef.current
    if (!vp || !layout) return
    const z = Math.min(
      (vp.clientWidth - 24) / stageW,
      (vp.clientHeight - 24) / stageH,
      MAX_Z,
    )
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, z))
    setZoom(nz)
    requestAnimationFrame(() => {
      const v = scrollRef.current
      if (!v) return
      v.scrollLeft = Math.max(0, (stageW * nz - v.clientWidth) / 2)
      v.scrollTop = 0
    })
  }, [layout, stageW, stageH])

  // Auto-ajustar al cambiar el tamaño del lienzo (nueva raíz / generaciones).
  useEffect(() => {
    if (layout) fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH])

  // Cerrar con Escape — pero si hay una ficha (u otro modal z-40) abierta
  // encima, deja que ella se cierre primero.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.fixed.inset-0.z-40')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Zoom con Ctrl/⌘ + rueda (listener no pasivo para poder preventDefault).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) =>
        Math.max(MIN_Z, Math.min(MAX_Z, z * (e.deltaY < 0 ? 1.12 : 0.89))),
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Arrastrar para desplazarse (pan) desde CUALQUIER punto, también sobre las
  // tarjetas. Se distingue arrastre de clic con un umbral (`moved`); las tarjetas
  // ignoran el clic si hubo arrastre. Listeners en window para no perder el
  // puntero al salir del contenedor o al moverse rápido.
  const pan = useRef({ down: false, moved: false, x: 0, y: 0, sl: 0, st: 0 })
  const onPanDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const vp = scrollRef.current
    if (!vp) return
    pan.current = {
      down: true,
      moved: false,
      x: e.clientX,
      y: e.clientY,
      sl: vp.scrollLeft,
      st: vp.scrollTop,
    }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pan.current
      const vp = scrollRef.current
      if (!p.down || !vp) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      if (Math.abs(dx) + Math.abs(dy) > 4) p.moved = true
      vp.scrollLeft = p.sl - dx
      vp.scrollTop = p.st - dy
    }
    const up = () => {
      pan.current.down = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const zoomBy = (f: number) =>
    setZoom((z) => Math.max(MIN_Z, Math.min(MAX_Z, z * f)))

  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-30 flex flex-col bg-background">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <div className="mr-auto flex items-center gap-2">
          <TreePine size={20} className="text-accent" />
          <div>
            <h2 className="font-serif text-base font-semibold leading-none">
              Árbol genealógico
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Un clic resalta a la persona · doble clic abre la ficha · arrastra
              para desplazarte
            </p>
          </div>
        </div>

        {members.length > 0 && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={14} /> Centrar en
              <Select
                value={rootId}
                onChange={(e) => setRootId(e.target.value)}
                className="h-9 w-44"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </label>
            <Select
              value={gen === Infinity ? 'all' : String(gen)}
              onChange={(e) =>
                setGen(
                  e.target.value === 'all' ? Infinity : Number(e.target.value),
                )
              }
              className="h-9 w-40"
              title="Generaciones a mostrar desde el centro"
            >
              <option value="all">Todas las generaciones</option>
              <option value="5">5 generaciones</option>
              <option value="4">4 generaciones</option>
              <option value="3">3 generaciones</option>
              <option value="2">2 generaciones</option>
            </Select>
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => zoomBy(0.89)}
                title="Alejar"
                aria-label="Alejar"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ZoomOut size={16} />
              </button>
              <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => zoomBy(1.12)}
                title="Acercar"
                aria-label="Acercar"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={fit}
                title="Ajustar a la vista"
                aria-label="Ajustar a la vista"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </>
        )}

        <Button variant="ghost" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar árbol genealógico">
          <X size={18} />
        </Button>
      </div>

      {/* Lienzo */}
      {members.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<TreePine size={26} />}
            title="Aún no hay relaciones familiares"
            description="En el grafo de Relaciones crea vínculos de tipo «Familia» (arrastra del padre/madre al hijo/a), «Cónyuge» o «Hermano». El árbol se dibujará solo a partir de ellos."
          />
        </div>
      ) : !layout ? (
        rootId ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              icon={<TreePine size={26} />}
              title="No se pudo dibujar el árbol"
              description="Puede que haya relaciones familiares contradictorias (por ejemplo, un ciclo de ascendencia). Revisa los vínculos de tipo Familia en el grafo de Relaciones."
            />
          </div>
        ) : (
          <div className="flex-1" />
        )
      ) : (
        <div
          ref={scrollRef}
          className="relative flex-1 cursor-grab select-none overflow-auto active:cursor-grabbing"
          onPointerDown={onPanDown}
        >
          <div style={{ width: stageW * zoom, height: stageH * zoom }}>
            <div
              style={{
                width: stageW,
                height: stageH,
                transformOrigin: '0 0',
                transform: `scale(${zoom})`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: PAD,
                  top: PAD,
                  width: canvasW,
                  height: canvasH,
                }}
              >
                {/* Conectores (debajo de las tarjetas) */}
                {layout.connectors.map((c, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      left: c[0] * UNIT_X,
                      top: c[1] * UNIT_Y,
                      width: Math.max(LINE, (c[2] - c[0]) * UNIT_X),
                      height: Math.max(LINE, (c[3] - c[1]) * UNIT_Y),
                      background: 'var(--muted-foreground)',
                      opacity: 0.4,
                    }}
                  />
                ))}

                {/* Tarjetas */}
                {layout.nodes.map((n) => {
                  const left = n.left * UNIT_X + GAP_X / 2
                  const top = n.top * UNIT_Y + GAP_Y / 2

                  // Nodo "ascendencia desconocida": padre inventado para poder
                  // unir hermanos que no tienen padres registrados.
                  if (isPlaceholder(n.id)) {
                    return (
                      <div
                        key={n.id}
                        title="Ascendencia desconocida"
                        className="absolute flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground"
                        style={{ left, top, width: CARD_W, height: CARD_H }}
                      >
                        <span className="text-2xl font-serif leading-none">?</span>
                        <span className="px-2 text-center text-[10px] leading-tight">
                          Ascendencia desconocida
                        </span>
                      </div>
                    )
                  }

                  const entry = byId.get(n.id)
                  if (!entry) return null
                  const meta = wikiMeta(entry.type)
                  const isSpotlight = n.id === layout.spotlightId
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (pan.current.moved) return // fue un arrastre, no un clic
                        setRootId(n.id)
                      }}
                      onDoubleClick={() => onOpenEntry(n.id)}
                      title={`${entry.name} · clic para resaltar · doble clic para abrir la ficha`}
                      className={cn(
                        'group absolute flex cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 bg-card px-2 py-2.5 text-center shadow-sm transition hover:shadow-md',
                        isSpotlight &&
                          'ring-2 ring-accent ring-offset-2 ring-offset-background',
                      )}
                      style={{
                        left,
                        top,
                        width: CARD_W,
                        height: CARD_H,
                        borderColor: entry.color,
                      }}
                    >
                      <span
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ background: genderColor(entry.gender) }}
                      />
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenEntry(n.id)
                        }}
                        title="Abrir ficha"
                        className="absolute right-1 top-1 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      >
                        <BookOpen size={13} />
                      </button>
                      <WikiAvatar
                        entry={entry}
                        className="h-9 w-9 shrink-0 overflow-hidden rounded-lg text-xs"
                      />
                      <span className="line-clamp-1 w-full text-xs font-semibold leading-tight">
                        {entry.name}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {entry.gender === 'male' && <Mars size={10} />}
                        {entry.gender === 'female' && <Venus size={10} />}
                        {meta.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border bg-card px-4 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Mars size={12} style={{ color: '#38bdf8' }} /> Masculino
        </span>
        <span className="flex items-center gap-1.5">
          <Venus size={12} style={{ color: '#f472b6' }} /> Femenino
        </span>
        <span>Líneas: padres → hijos · cónyuges en horizontal</span>
      </div>
    </div>,
    document.body,
  )
}
