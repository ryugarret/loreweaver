import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WikiEntry } from '@/lib/db'
import { BlobImage } from '@/components/BlobImage'
import { cn } from '@/lib/utils'

/** Avatar de una ficha: imagen de portada si la tiene, si no la inicial. */
export function WikiAvatar({
  entry,
  className,
}: {
  entry: WikiEntry
  className?: string
}) {
  const cover = useLiveQuery(async () => {
    if (entry.coverImageId) {
      const c = await db.images.get(entry.coverImageId)
      if (c) return c
    }
    return db.images.where('entryId').equals(entry.id).first()
  }, [entry.id, entry.coverImageId])

  if (cover) {
    return (
      <BlobImage
        blob={cover.blob}
        alt={entry.name}
        className={cn('object-cover', className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center font-semibold text-white',
        className,
      )}
      style={{ backgroundColor: entry.color }}
    >
      {entry.name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}
