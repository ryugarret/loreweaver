import { useEffect, useState } from 'react'
import { db, type WikiEntry } from '@/lib/db'
import { EntitySummary } from '@/components/wiki/EntitySummary'
import { WikiDetail } from '@/components/wiki/WikiDetail'
import { deleteWiki } from '@/lib/repo'

/**
 * Escucha clics en cualquier @mención (.mention[data-id]) de la app y abre
 * una tarjeta de resumen de la ficha enlazada. Montado una sola vez en App.
 */
export function MentionViewer() {
  const [entry, setEntry] = useState<WikiEntry | null>(null)
  const [detail, setDetail] = useState<WikiEntry | null>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      const el = target?.closest?.('.mention[data-id]') as HTMLElement | null
      if (!el) return
      const id = el.getAttribute('data-id')
      if (!id) return
      void db.wiki.get(id).then((w) => {
        if (w) setEntry(w)
      })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <>
      {entry && (
        <EntitySummary
          entry={entry}
          onClose={() => setEntry(null)}
          onOpenFull={() => {
            setDetail(entry)
            setEntry(null)
          }}
        />
      )}
      {detail && (
        <WikiDetail
          key={detail.id}
          entry={detail}
          onClose={() => setDetail(null)}
          onDelete={() => {
            void deleteWiki(detail)
            setDetail(null)
          }}
        />
      )}
    </>
  )
}
