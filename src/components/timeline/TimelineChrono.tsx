import { useLiveQuery } from 'dexie-react-hooks'
import { Clock } from 'lucide-react'
import { db } from '@/lib/db'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

/** HTML → texto plano (una línea) para el resumen del evento. */
function stripHtml(html: string): string {
  if (!html) return ''
  return (
    new DOMParser()
      .parseFromString(html, 'text/html')
      .body.textContent?.replace(/\s+/g, ' ')
      .trim() ?? ''
  )
}

/**
 * Vista de cronología lineal (componente propio, sin dependencias externas para
 * NO contaminar el CSS global). Timeline alterno vertical: una línea central con
 * puntos por evento y tarjetas a izquierda/derecha. El orden es el cronológico
 * del proyecto (sortIndex); la "fecha" es el texto libre del evento. Solo lectura.
 */
export function TimelineChrono({ projectId }: { projectId: string }) {
  const events = useLiveQuery(
    () => db.events.where('projectId').equals(projectId).sortBy('sortIndex'),
    [projectId],
  )

  if (!events) return null
  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={<Clock size={26} />}
          title="Sin eventos todavía"
          description="Añade eventos y aquí los verás como una cronología lineal."
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="relative mx-auto max-w-3xl px-6 py-10">
        {/* Línea central */}
        <div className="absolute bottom-10 left-1/2 top-10 w-px -translate-x-1/2 bg-border" />

        {events.map((e, i) => {
          const leftSide = i % 2 === 0
          const text = stripHtml(e.description)
          const card = (
            <div
              className="w-full max-w-sm rounded-2xl border-2 bg-card p-4 text-left shadow-sm"
              style={{ borderColor: e.color }}
            >
              <span
                className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--accent) 14%, transparent)',
                  color: 'var(--accent)',
                }}
              >
                {e.dateLabel || e.era || '—'}
              </span>
              <h3 className="font-serif text-base font-semibold leading-tight">
                {e.title || 'Sin título'}
              </h3>
              {text && (
                <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              )}
            </div>
          )

          return (
            <div key={e.id} className="relative mb-6 flex items-center">
              {/* Mitad izquierda */}
              <div className={cn('flex w-1/2 justify-end pr-7', !leftSide && 'invisible')}>
                {leftSide && card}
              </div>
              {/* Punto central */}
              <span
                className="absolute left-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-background shadow"
                style={{ backgroundColor: e.color }}
              />
              {/* Mitad derecha */}
              <div className={cn('flex w-1/2 justify-start pl-7', leftSide && 'invisible')}>
                {!leftSide && card}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
