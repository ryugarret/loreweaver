import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, GripHorizontal, Palette } from 'lucide-react'
import { db, type BoardNode } from '@/lib/db'
import { createNode } from '@/lib/repo'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { now } from '@/lib/utils'

const NOTE_COLORS = [
  '#fde68a',
  '#fca5a5',
  '#a7f3d0',
  '#a5b4fc',
  '#f9a8d4',
  '#bae6fd',
  '#ddd6fe',
  '#e2e8f0',
]

function NoteCard({
  node,
  onDelete,
}: {
  node: BoardNode
  onDelete: () => void
}) {
  const [pos, setPos] = useState({ x: node.x, y: node.y })
  const [text, setText] = useState(node.text)
  const [color, setColor] = useState(node.color)
  const [showColors, setShowColors] = useState(false)
  const timer = useRef<number | null>(null)

  function saveText(value: string) {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void db.nodes.update(node.id, { text: value, updatedAt: now() })
    }, 350)
  }

  function startDrag(e: ReactPointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('textarea, button')) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const origX = pos.x
    const origY = pos.y
    const onMove = (ev: PointerEvent) => {
      setPos({
        x: Math.max(0, origX + (ev.clientX - startX)),
        y: Math.max(0, origY + (ev.clientY - startY)),
      })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const nx = Math.max(0, origX + (ev.clientX - startX))
      const ny = Math.max(0, origY + (ev.clientY - startY))
      void db.nodes.update(node.id, { x: nx, y: ny, updatedAt: now() })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      onPointerDown={startDrag}
      className="absolute flex select-none flex-col rounded-xl shadow-lg ring-1 ring-black/5"
      style={{
        left: pos.x,
        top: pos.y,
        width: node.w,
        height: node.h,
        backgroundColor: color,
      }}
    >
      <div className="flex items-center justify-between px-2 py-1 text-black/40">
        <GripHorizontal size={15} className="cursor-grab active:cursor-grabbing" />
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowColors((s) => !s)}
            aria-label="Cambiar color de la nota"
            title="Color"
            className="rounded p-1 hover:bg-black/10 hover:text-black/70"
          >
            <Palette size={14} />
          </button>
          <button
            onClick={onDelete}
            aria-label="Eliminar nota"
            title="Eliminar"
            className="rounded p-1 hover:bg-black/10 hover:text-black/70"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {showColors && (
        <div className="absolute right-1 top-8 z-10 w-44 rounded-lg bg-white/95 p-2 shadow-lg">
          <ColorPicker
            value={color}
            colors={NOTE_COLORS}
            swatchClass="h-5 w-5"
            ringOffset="ring-offset-white"
            onChange={(c) => {
              setColor(c)
              void db.nodes.update(node.id, { color: c, updatedAt: now() })
            }}
          />
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          saveText(e.target.value)
        }}
        placeholder="Escribe una idea…"
        className="flex-1 resize-none bg-transparent px-3 pb-3 text-sm text-black/80 outline-none placeholder:text-black/30"
      />
    </div>
  )
}

export function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const canvasRef = useRef<HTMLDivElement>(null)

  const nodes = useLiveQuery(
    () =>
      projectId
        ? db.nodes.where('projectId').equals(projectId).toArray()
        : [],
    [projectId],
  )

  async function addNoteAt(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]
    const x = Math.max(0, clientX - rect.left - 100)
    const y = Math.max(0, clientY - rect.top - 60)
    await createNode(projectId!, x, y, color)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="font-serif text-xl font-semibold">Tablero</h1>
          <p className="text-xs text-muted-foreground">
            Doble clic en el lienzo para crear una nota · arrástralas para ordenar
          </p>
        </div>
        <Button
          onClick={() => {
            const rect = canvasRef.current?.getBoundingClientRect()
            if (rect) addNoteAt(rect.left + 260, rect.top + 160)
          }}
        >
          <Plus size={18} /> Nueva nota
        </Button>
      </div>

      <div className="relative flex-1 overflow-auto">
        <div
          ref={canvasRef}
          onDoubleClick={(e) => addNoteAt(e.clientX, e.clientY)}
          className="relative h-[2400px] w-[3200px] bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:24px_24px]"
        >
          {nodes?.map((n) => (
            <NoteCard
              key={n.id}
              node={n}
              onDelete={() => db.nodes.delete(n.id)}
            />
          ))}

          {nodes && nodes.length === 0 && (
            <div className="pointer-events-none absolute left-1/2 top-40 -translate-x-1/2 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <GripHorizontal size={26} />
              </div>
              <p className="font-serif text-lg font-semibold">
                Tu lienzo está en blanco
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Haz doble clic en cualquier punto para crear tu primera nota.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
