import { useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, ListVideo, Video, Play, Wifi, Maximize2 } from 'lucide-react'
import { db, type YtItem } from '@/lib/db'
import { uid, now, cn } from '@/lib/utils'

function parseYouTube(
  url: string,
): { kind: 'video' | 'playlist'; embed: string } | null {
  const list = url.match(/[?&]list=([A-Za-z0-9_-]+)/)
  const id = url.match(
    /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/,
  )
  if (list)
    return {
      kind: 'playlist',
      embed: `https://www.youtube.com/embed/videoseries?list=${list[1]}`,
    }
  if (id)
    return { kind: 'video', embed: `https://www.youtube.com/embed/${id[1]}` }
  return null
}

export function YouTubePanel({ visible }: { visible: boolean }) {
  const items = useLiveQuery(() => db.yt.orderBy('addedAt').toArray(), [])
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const parsed = parseYouTube(url.trim())
    if (!parsed) {
      setError('Pega un enlace de vídeo o lista de YouTube válido.')
      return
    }
    await db.yt.add({
      id: uid(),
      title:
        title.trim() ||
        (parsed.kind === 'playlist' ? 'Lista de YouTube' : 'Vídeo de YouTube'),
      url: url.trim(),
      kind: parsed.kind,
      addedAt: now(),
    })
    setUrl('')
    setTitle('')
    setError(null)
  }

  function play(it: YtItem) {
    const parsed = parseYouTube(it.url)
    if (!parsed) return
    const sep = parsed.embed.includes('?') ? '&' : '?'
    setActiveEmbed(`${parsed.embed}${sep}autoplay=1`)
  }

  const list = items ?? []

  return (
    <div className={cn('flex flex-col', !visible && 'hidden')}>
      {activeEmbed && (
        <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            ref={iframeRef}
            src={activeEmbed}
            title="YouTube"
            className="h-full w-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
          <button
            onClick={() => iframeRef.current?.requestFullscreen?.()}
            title="Pantalla completa"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      )}

      <form onSubmit={add} className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Pega un enlace de YouTube…"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
        />
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre (opcional)"
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
          />
          <button
            type="submit"
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            <Plus size={15} /> Añadir
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </form>

      <div className="mt-3 max-h-40 overflow-y-auto">
        {list.length === 0 ? (
          <div className="px-2 py-5 text-center text-xs text-muted-foreground">
            <Video size={22} className="mx-auto mb-2 opacity-50" />
            Guarda tus vídeos o listas favoritas para escribir.
          </div>
        ) : (
          list.map((it) => (
            <div
              key={it.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted"
            >
              <button
                onClick={() => play(it)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-hover:bg-accent group-hover:text-accent-foreground"
              >
                <Play size={13} />
              </button>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
                {it.kind === 'playlist' ? (
                  <ListVideo size={13} className="shrink-0 text-muted-foreground" />
                ) : (
                  <Video size={13} className="shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{it.title}</span>
              </span>
              <button
                onClick={() => db.yt.delete(it.id)}
                aria-label="Eliminar vídeo"
                title="Eliminar"
                className="shrink-0 text-muted-foreground transition hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
        <Wifi size={11} /> YouTube necesita conexión a internet.
      </p>
    </div>
  )
}
