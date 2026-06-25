import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  PenLine,
  Maximize2,
  Minimize2,
  PanelLeft,
} from 'lucide-react'
import { db, type Chapter } from '@/lib/db'
import { createChapter, deleteChapter } from '@/lib/repo'
import { ChapterEditor } from '@/components/editor/ChapterEditor'
import { ExportMenu } from '@/components/ExportMenu'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { statusMeta } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function WritePage() {
  const { projectId, chapterId } = useParams<{
    projectId: string
    chapterId?: string
  }>()
  const navigate = useNavigate()
  const [focus, setFocus] = useState(false)
  const [toDelete, setToDelete] = useState<Chapter | null>(null)
  // Cajón de capítulos en móvil (< md). En md+ la lista es fija.
  const [chaptersOpen, setChaptersOpen] = useState(false)

  const chapters = useLiveQuery(
    () =>
      projectId
        ? db.chapters.where('projectId').equals(projectId).sortBy('order')
        : [],
    [projectId],
  )

  const current = chapters?.find((c) => c.id === chapterId)

  // Selección automática del primer capítulo
  useEffect(() => {
    if (!chapters || !projectId) return
    if (chapters.length && !current) {
      navigate(`/p/${projectId}/write/${chapters[0].id}`, { replace: true })
    }
  }, [chapters, current, projectId, navigate])

  async function handleNew() {
    const id = await createChapter(projectId!)
    navigate(`/p/${projectId}/write/${id}`)
  }

  async function move(ch: Chapter, dir: -1 | 1) {
    if (!chapters) return
    const idx = chapters.findIndex((c) => c.id === ch.id)
    const target = idx + dir
    if (target < 0 || target >= chapters.length) return
    const other = chapters[target]
    await db.chapters.update(ch.id, { order: other.order })
    await db.chapters.update(other.id, { order: ch.order })
  }

  const totalWords =
    chapters?.reduce((sum, c) => sum + c.wordCount, 0) ?? 0

  return (
    <div className="relative flex h-full">
      {/* Fondo del cajón de capítulos (solo móvil) */}
      {!focus && chaptersOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setChaptersOpen(false)}
        />
      )}
      {/* Lista de capítulos: fija en md+, cajón deslizante en móvil */}
      {!focus && (
        <div
          className={cn(
            'z-30 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-border bg-card transition-transform duration-200',
            'absolute inset-y-0 left-0 md:static md:max-w-none md:translate-x-0 md:bg-card/40',
            chaptersOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          )}
        >
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <h2 className="font-serif text-base font-semibold">Capítulos</h2>
              <p className="text-xs text-muted-foreground">
                {chapters?.length ?? 0} · {totalWords.toLocaleString('es-ES')} palabras
              </p>
            </div>
            <div className="flex items-center gap-1">
              <ExportMenu projectId={projectId!} />
              <Button size="iconSm" variant="subtle" title="Nuevo capítulo" onClick={handleNew}>
                <Plus size={16} />
              </Button>
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {chapters?.map((ch, i) => {
              const sm = statusMeta(ch.status)
              const active = ch.id === chapterId
              return (
                <div
                  key={ch.id}
                  onClick={() => {
                    navigate(`/p/${projectId}/write/${ch.id}`)
                    setChaptersOpen(false)
                  }}
                  className={cn(
                    'group cursor-pointer rounded-lg border px-3 py-2.5 transition',
                    active
                      ? 'border-accent/40 bg-accent/10'
                      : 'border-transparent hover:bg-muted',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: sm.color }}
                      title={sm.label}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {i + 1}. {ch.title || 'Sin título'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ch.wordCount.toLocaleString('es-ES')} palabras
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <div className="flex flex-col">
                        <button
                          title="Subir"
                          onClick={(e) => {
                            e.stopPropagation()
                            move(ch, -1)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          title="Bajar"
                          onClick={(e) => {
                            e.stopPropagation()
                            move(ch, 1)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        title="Eliminar capítulo"
                        onClick={(e) => {
                          e.stopPropagation()
                          setToDelete(ch)
                        }}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra solo en móvil: abrir capítulos + entrar en enfoque */}
        {!focus && (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 md:hidden">
            <button
              onClick={() => setChaptersOpen(true)}
              aria-label="Ver capítulos"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <PanelLeft size={16} /> Capítulos
            </button>
            <button
              onClick={() => setFocus(true)}
              aria-label="Modo enfoque"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        )}

        <div className="relative flex-1 overflow-y-auto">
          {/* Enfoque: en escritorio siempre visible (entrar/salir); en móvil solo
              para SALIR (entrar se hace desde la barra de arriba). */}
          <button
            onClick={() => setFocus((f) => !f)}
            title={focus ? 'Salir del modo enfoque' : 'Modo enfoque'}
            aria-label={focus ? 'Salir del modo enfoque' : 'Modo enfoque'}
            className={cn(
              'absolute right-4 top-4 z-20 h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground',
              focus ? 'flex' : 'hidden md:flex',
            )}
          >
            {focus ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {current ? (
            <ChapterEditor key={current.id} chapter={current} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState
                icon={<PenLine size={26} />}
                title="Tu manuscrito empieza aquí"
                description="Crea tu primer capítulo y empieza a escribir. Todo se guarda solo en tu ordenador."
                action={
                  <Button onClick={handleNew}>
                    <Plus size={18} /> Crear capítulo
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar capítulo"
        message={`Se borrará "${toDelete?.title || 'Sin título'}" y su historial de versiones. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          if (toDelete) {
            const isCurrent = toDelete.id === chapterId
            void deleteChapter(toDelete)
            if (isCurrent) navigate(`/p/${projectId}/write`, { replace: true })
            toast('Capítulo eliminado')
          }
        }}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
