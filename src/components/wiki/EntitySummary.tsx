import { useLiveQuery } from 'dexie-react-hooks'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
import { db, type WikiEntry } from '@/lib/db'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { BlobImage } from '@/components/BlobImage'
import { wikiMeta } from '@/components/wikiMeta'
import { relMeta } from '@/lib/constants'

/** Tarjeta de resumen (solo lectura) de una ficha, con botón para abrir la completa. */
export function EntitySummary({
  entry,
  onClose,
  onOpenFull,
}: {
  entry: WikiEntry
  onClose: () => void
  onOpenFull: () => void
}) {
  const cover = useLiveQuery(async () => {
    if (entry.coverImageId) {
      const c = await db.images.get(entry.coverImageId)
      if (c) return c
    }
    return db.images.where('entryId').equals(entry.id).first()
  }, [entry.id, entry.coverImageId])

  // Relaciones de esta entidad (para mostrar un vistazo de "con quién se conecta").
  const rels = useLiveQuery(async () => {
    const all = await db.links
      .where('projectId')
      .equals(entry.projectId)
      .toArray()
    const mine = all.filter((l) => l.fromId === entry.id || l.toId === entry.id)
    const otherIds = [
      ...new Set(
        mine.map((l) => (l.fromId === entry.id ? l.toId : l.fromId)),
      ),
    ]
    const others = await db.wiki.bulkGet(otherIds)
    const nameMap = new Map(
      others.filter(Boolean).map((o) => [o!.id, o!.name]),
    )
    return mine.map((l) => {
      const outgoing = l.fromId === entry.id
      const otherId = outgoing ? l.toId : l.fromId
      return {
        id: l.id,
        relType: l.relType,
        label: l.label,
        outgoing,
        otherName: nameMap.get(otherId) ?? '—',
      }
    })
  }, [entry.id, entry.projectId])

  const meta = wikiMeta(entry.type)
  const fields = entry.fields.filter((f) => f.label || f.value).slice(0, 6)
  const shownRels = (rels ?? []).slice(0, 6)

  return (
    <Modal open onClose={onClose} width="max-w-sm">
      <div className="relative">
        <div
          className="h-32 w-full"
          style={
            cover
              ? undefined
              : {
                  background: `linear-gradient(135deg, ${entry.color}, ${entry.color}aa)`,
                }
          }
        >
          {cover && (
            <BlobImage
              blob={cover.blob}
              alt={entry.name}
              className="h-32 w-full object-cover"
            />
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-2 top-2 rounded-md bg-black/40 p-1 text-white transition hover:bg-black/60"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {meta.icon(13)} {meta.label}
        </div>
        <h2 className="mt-0.5 font-serif text-xl font-semibold">{entry.name}</h2>

        {entry.summary && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {entry.summary}
          </p>
        )}

        {fields.length > 0 && (
          <dl className="mt-3 space-y-1.5 rounded-xl bg-muted/60 p-3">
            {fields.map((f) => (
              <div key={f.id} className="flex gap-3 text-sm">
                <dt className="w-24 shrink-0 truncate font-medium text-muted-foreground">
                  {f.label || '—'}
                </dt>
                <dd className="min-w-0 flex-1">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {shownRels.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Relaciones
            </p>
            <ul className="space-y-1">
              {shownRels.map((r) => {
                const rm = relMeta(r.relType)
                return (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: rm.color }}
                    />
                    {r.outgoing ? (
                      <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
                    ) : (
                      <ArrowLeft size={12} className="shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-muted-foreground">
                        {r.label || rm.label}
                      </span>{' '}
                      <span className="font-medium">{r.otherName}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            {(rels?.length ?? 0) > shownRels.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                +{(rels?.length ?? 0) - shownRels.length} más…
              </p>
            )}
          </div>
        )}

        {entry.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <Button variant="outline" className="mt-4 w-full" onClick={onOpenFull}>
          Abrir ficha completa <ArrowRight size={15} />
        </Button>
      </div>
    </Modal>
  )
}
