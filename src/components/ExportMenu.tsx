import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileText, FileType, FileCode } from 'lucide-react'
import { db, type Project, type Chapter } from '@/lib/db'
import { exportPDF, exportDoc, exportHTML } from '@/lib/export'
import { flushActiveEditor } from '@/lib/editorFlush'
import { toast } from '@/lib/toast'

export function ExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const chapters = useLiveQuery(
    () => db.chapters.where('projectId').equals(projectId).sortBy('order'),
    [projectId],
  )
  const disabled = !project || !chapters || chapters.length === 0

  async function run(fn: (p: Project, c: Chapter[]) => void) {
    if (!project) return
    // Guardar lo último que se esté escribiendo y releer fresco de la BD, para
    // no exportar contenido viejo (el editor autoguarda con 500 ms de retraso).
    await flushActiveEditor()
    const fresh = await db.chapters
      .where('projectId')
      .equals(projectId)
      .sortBy('order')
    if (!fresh.length) return
    fn(project, fresh)
    setOpen(false)
    if (fn === exportPDF) toast('Abriendo el diálogo de impresión…', 'info')
    else toast('Manuscrito exportado ✓')
  }

  const items: {
    label: string
    icon: typeof FileText
    fn: (p: Project, c: Chapter[]) => void
  }[] = [
    { label: 'Exportar a PDF', icon: FileText, fn: exportPDF },
    { label: 'Word (.doc)', icon: FileType, fn: exportDoc },
    { label: 'Página web (.html)', icon: FileCode, fn: exportHTML },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title="Exportar manuscrito"
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <Download size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-pop-in absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
            <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Exportar manuscrito
            </p>
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => void run(it.fn)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground transition hover:bg-muted"
              >
                <it.icon size={15} className="text-muted-foreground" />
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
