import { type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project } from '@/lib/db'
import { BlobImage } from '@/components/BlobImage'
import { cn } from '@/lib/utils'

/**
 * Fondo de portada de un proyecto: la foto si la tiene, si no un degradado con
 * el color del proyecto. `children` se superpone (insignia de género, etc.).
 */
export function ProjectCover({
  project,
  className,
  children,
  scrim = true,
}: {
  project: Project
  className?: string
  children?: ReactNode
  /** Velo oscuro inferior para legibilidad. Desactívalo en miniaturas sin texto. */
  scrim?: boolean
}) {
  const cover = useLiveQuery(async () => {
    if (project.coverImageId) {
      const c = await db.images.get(project.coverImageId)
      if (c) return c
    }
    return db.images.where('entryId').equals(project.id).first()
  }, [project.id, project.coverImageId])

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={
        cover
          ? undefined
          : {
              background: `linear-gradient(135deg, ${project.coverColor}, ${project.coverColor}99)`,
            }
      }
    >
      {cover ? (
        <BlobImage
          blob={cover.blob}
          alt={project.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_30%,#fff_1px,transparent_1px),radial-gradient(circle_at_70%_60%,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
      )}
      {/* Velo inferior para que el texto/insignia blancos se lean sobre cualquier foto. */}
      {scrim && (
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/45 to-transparent" />
      )}
      {children}
    </div>
  )
}
