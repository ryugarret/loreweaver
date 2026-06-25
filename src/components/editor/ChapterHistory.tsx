import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { diffWords } from 'diff'
import { X, History, BookmarkPlus, RotateCcw, Trash2, Check } from 'lucide-react'
import { db, type Chapter, type ChapterVersion } from '@/lib/db'
import {
  listChapterVersions,
  saveChapterVersion,
  restoreChapterVersion,
  deleteChapterVersion,
} from '@/lib/repo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

/** HTML → texto plano conservando los saltos de párrafo (para el diff legible). */
function stripHtml(html: string): string {
  if (!html) return ''
  const withBreaks = html.replace(/<\/(p|h1|h2|h3|li|blockquote)>/gi, '\n')
  return (
    new DOMParser()
      .parseFromString(withBreaks, 'text/html')
      .body.textContent?.replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim() ?? ''
  )
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChapterHistory({
  chapter,
  onClose,
  onRestored,
}: {
  chapter: Chapter
  onClose: () => void
  onRestored?: (content: string, wordCount: number) => void
}) {
  const current =
    useLiveQuery(() => db.chapters.get(chapter.id), [chapter.id]) ?? chapter
  const versions =
    useLiveQuery(() => listChapterVersions(chapter.id), [chapter.id]) ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<ChapterVersion | null>(null)
  const [restoreV, setRestoreV] = useState<ChapterVersion | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Diff entre la versión seleccionada y el contenido ACTUAL del capítulo.
  const diff = useMemo(
    () =>
      selected ? diffWords(stripHtml(selected.content), stripHtml(current.content)) : [],
    [selected, current.content],
  )
  const addedWords = diff
    .filter((d) => d.added)
    .reduce((n, d) => n + (d.count ?? 0), 0)
  const removedWords = diff
    .filter((d) => d.removed)
    .reduce((n, d) => n + (d.count ?? 0), 0)

  async function saveManual() {
    await saveChapterVersion(current, { auto: false, label: name })
    setName('')
    setNaming(false)
    toast('Versión guardada ✓')
  }

  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="animate-pop-in relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Cabecera */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <History size={18} className="text-accent" />
            <div className="flex-1">
              <h2 className="font-serif text-lg font-semibold">
                Historial de versiones
              </h2>
              <p className="text-xs text-muted-foreground">
                {chapter.title || 'Capítulo'} · {versions.length}{' '}
                {versions.length === 1 ? 'versión' : 'versiones'}
              </p>
            </div>
            {!naming && (
              <Button variant="outline" size="sm" onClick={() => setNaming(true)}>
                <BookmarkPlus size={15} /> Guardar versión
              </Button>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar historial"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
          {naming && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void saveManual()}
                placeholder="Nombre de la versión (opcional)…"
                className="h-9"
              />
              <Button size="sm" onClick={saveManual}>
                Guardar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNaming(false)
                  setName('')
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Lista de versiones (arriba en móvil, a la izquierda en md+) */}
          <div className="max-h-40 w-full shrink-0 overflow-y-auto border-b border-border p-2 md:max-h-none md:w-56 md:border-b-0 md:border-r">
            {versions.length === 0 ? (
              <p className="p-3 text-xs leading-relaxed text-muted-foreground">
                Aún no hay versiones. Se guardan solas mientras escribes, o pulsa
                «Guardar versión» para marcar un punto.
              </p>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    'mb-1 flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition',
                    selected?.id === v.id
                      ? 'bg-accent/12 text-accent'
                      : 'hover:bg-muted',
                  )}
                >
                  <span className="flex w-full items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{v.label || fmt(v.savedAt)}</span>
                    {!v.auto && (
                      <BookmarkPlus size={11} className="shrink-0 opacity-60" />
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {v.label ? fmt(v.savedAt) : v.auto ? 'automática' : 'manual'} ·{' '}
                    {v.wordCount.toLocaleString('es-ES')} pal.
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Diff */}
          <div className="flex min-w-0 flex-1 flex-col">
            {selected ? (
              <>
                <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Cambios desde esta versión hasta{' '}
                    <span className="font-medium text-foreground">ahora</span>
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    +{addedWords}
                  </span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    −{removedWords}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRestoreV(selected)}
                    >
                      <RotateCcw size={14} /> Restaurar
                    </Button>
                    <button
                      onClick={() => setToDelete(selected)}
                      title="Eliminar esta versión"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed">
                  {addedWords === 0 && removedWords === 0 ? (
                    <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <Check size={14} /> Sin cambios respecto al texto actual.
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {diff.map((part, i) => (
                        <span
                          key={i}
                          className={cn(
                            part.added &&
                              'rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                            part.removed &&
                              'rounded bg-rose-500/20 text-rose-700 line-through dark:text-rose-300',
                          )}
                        >
                          {part.value}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Selecciona una versión para ver qué ha cambiado.
              </div>
            )}
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={!!restoreV}
        title="Restaurar esta versión"
        message="El capítulo volverá al contenido de esta versión. Tu texto actual se guarda automáticamente como una versión más, así que podrás deshacerlo."
        confirmLabel="Restaurar"
        onConfirm={() => {
          if (!restoreV) return
          const v = restoreV
          void restoreChapterVersion(v).then(() => {
            onRestored?.(v.content, v.wordCount)
            onClose()
            toast('Versión restaurada')
          })
        }}
        onClose={() => setRestoreV(null)}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar versión"
        message="Se borrará esta instantánea del historial. No afecta al texto actual del capítulo."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          if (toDelete) {
            void deleteChapterVersion(toDelete.id)
            toast('Versión eliminada')
          }
        }}
        onClose={() => setToDelete(null)}
      />
    </div>,
    document.body,
  )
}
