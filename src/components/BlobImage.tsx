import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Muestra un Blob (imagen guardada en IndexedDB) creando una URL temporal. */
export function BlobImage({
  blob,
  className,
  alt,
}: {
  blob: Blob
  className?: string
  alt?: string
}) {
  const [url, setUrl] = useState('')
  const [broken, setBroken] = useState(false)
  // Crear la URL en un efecto (seguro con StrictMode); revocarla al cambiar/desmontar.
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setBroken(false)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  // Mientras se prepara la URL (o si el blob es ilegible) mostramos un hueco
  // del mismo tamaño en vez de desaparecer (evita el parpadeo a "nada").
  if (broken || !url) {
    return <div className={cn('bg-muted', className)} role="img" aria-label={alt} />
  }
  return (
    <img
      src={url}
      className={className}
      alt={alt ?? ''}
      onError={() => setBroken(true)}
    />
  )
}
