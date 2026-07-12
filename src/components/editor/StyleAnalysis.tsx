import { useMemo } from 'react'
import { X, Sparkles, Crosshair } from 'lucide-react'
import { analyzeText } from '@/lib/textAnalysis'
import { cn } from '@/lib/utils'

/** Panel de "Estilo": repeticiones y riqueza de vocabulario del capítulo actual. */
export function StyleAnalysis({
  content,
  onClose,
  onLocate,
}: {
  content: string
  onClose: () => void
  /** Salta a esa palabra/frase en el editor y la resalta un momento. */
  onLocate: (query: string, kind: 'word' | 'phrase') => void
}) {
  const r = useMemo(() => analyzeText(content), [content])

  const Section = ({
    title,
    hint,
    children,
    empty,
  }: {
    title: string
    hint?: string
    children: React.ReactNode
    empty: boolean
  }) => (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      {empty ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Nada que destacar aquí. 👍
        </p>
      ) : (
        children
      )}
    </div>
  )

  return (
    <div className="animate-fade-in fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="animate-pop-in relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <div>
              <h2 className="font-serif text-base font-semibold leading-none">
                Estilo del capítulo
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {r.words.toLocaleString('es-ES')} palabras ·{' '}
                {r.unique.toLocaleString('es-ES')} distintas · riqueza{' '}
                {Math.round(r.richness * 100)}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs leading-relaxed text-foreground">
            Las faltas de ortografía las subraya el corrector del navegador
            (línea roja). Aquí revisas lo que un corrector no ve: palabras y
            frases que repites de más, para diversificar el vocabulario.
          </p>

          <Section
            title="Palabras que más repites"
            hint="Nombres de personajes aparte (esos van con @). ¿Puedes variar alguna?"
            empty={r.repeatedWords.length === 0}
          >
            <div className="flex flex-wrap gap-1.5">
              {r.repeatedWords.map((w) => (
                <span
                  key={w.word}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    w.count >= 8
                      ? 'border-danger/40 bg-danger/10 text-danger'
                      : w.count >= 5
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-border text-muted-foreground',
                  )}
                >
                  {w.word} <span className="font-semibold tabular-nums">×{w.count}</span>
                </span>
              ))}
            </div>
          </Section>

          <Section
            title="Frases que se repiten"
            hint="Toca una para saltar a ella y ver resaltadas todas sus apariciones."
            empty={r.repeatedPhrases.length === 0}
          >
            <ul className="space-y-1.5">
              {r.repeatedPhrases.map((p) => (
                <li key={p.phrase}>
                  <button
                    type="button"
                    onClick={() => onLocate(p.phrase, 'phrase')}
                    title={`Ir a «${p.phrase}» en el texto`}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-1.5 text-left text-sm transition hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate italic">
                      «{p.phrase}»
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
                      ×{p.count}
                      <Crosshair
                        size={13}
                        className="text-muted-foreground/60 transition group-hover:text-accent"
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Ecos (misma palabra muy cerca)"
            hint="Toca uno para saltar a él en el texto y verlo resaltado un momento."
            empty={r.closeRepeats.length === 0}
          >
            <ul className="space-y-1.5">
              {r.closeRepeats.map((c) => (
                <li key={c.word}>
                  <button
                    type="button"
                    onClick={() => onLocate(c.word, 'word')}
                    title={`Ir a «${c.word}» en el texto`}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-1.5 text-left text-sm transition hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {c.word}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      a {c.distance} palabras
                      <Crosshair
                        size={13}
                        className="text-muted-foreground/60 transition group-hover:text-accent"
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </aside>
    </div>
  )
}
