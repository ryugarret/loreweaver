import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Trash2,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  Music,
} from 'lucide-react'
import { db, type Track } from '@/lib/db'
import { uid, now, cn } from '@/lib/utils'
import { useUi } from '@/store/ui'

type RepeatMode = 'off' | 'all' | 'one'

function fmt(s: number): string {
  if (!isFinite(s) || s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function MusicPlayer({ visible }: { visible: boolean }) {
  const tracks = useLiveQuery(() => db.tracks.orderBy('addedAt').toArray(), [])
  const musicVolume = useUi((s) => s.musicVolume)
  const setMusicVolume = useUi((s) => s.setMusicVolume)

  const audioRef = useRef<HTMLAudioElement>(null)
  const urlRef = useRef<string | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [shuffle, setShuffle] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const list = tracks ?? []
  const currentIndex = list.findIndex((t) => t.id === currentId)
  const current = list[currentIndex] ?? null

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume
  }, [musicVolume])

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  function playId(id: string) {
    const audio = audioRef.current
    if (!audio) return
    if (id === currentId) {
      togglePlay()
      return
    }
    const track = list.find((t) => t.id === id)
    if (!track) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(track.blob)
    urlRef.current = url
    audio.src = url
    audio.volume = musicVolume
    setCurrentId(id)
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {})
  }

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (!current) {
      if (list.length) playId(list[0].id)
      return
    }
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => {})
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  function step(dir: 1 | -1) {
    if (!list.length) return
    if (shuffle) {
      playId(list[Math.floor(Math.random() * list.length)].id)
      return
    }
    let idx = currentIndex < 0 ? 0 : currentIndex + dir
    if (idx < 0) idx = list.length - 1
    if (idx >= list.length) idx = 0
    playId(list[idx].id)
  }

  function onEnded() {
    if (repeat === 'one') {
      const a = audioRef.current
      if (a) {
        a.currentTime = 0
        void a.play()
      }
      return
    }
    if (currentIndex === list.length - 1 && repeat === 'off' && !shuffle) {
      setPlaying(false)
      return
    }
    step(1)
  }

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const items: Track[] = []
    let i = 0
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('audio')) continue
      items.push({
        id: uid(),
        name: f.name.replace(/\.[^.]+$/, ''),
        blob: f,
        addedAt: now() + i++,
      })
    }
    if (items.length) await db.tracks.bulkAdd(items)
    e.target.value = ''
  }

  async function remove(id: string) {
    if (id === currentId) {
      audioRef.current?.pause()
      setPlaying(false)
      setCurrentId(null)
    }
    await db.tracks.delete(id)
  }

  function seek(value: number) {
    const a = audioRef.current
    if (a && duration) {
      a.currentTime = value * duration
      setProgress(value)
    }
  }

  return (
    <div className={cn('flex flex-col', !visible && 'hidden')}>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => {
          const a = e.currentTarget
          setProgress(a.duration ? a.currentTime / a.duration : 0)
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={onEnded}
      />

      {/* Lista de pistas */}
      <div className="max-h-44 overflow-y-auto px-1">
        {list.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            <Music size={22} className="mx-auto mb-2 opacity-50" />
            Añade tus canciones (mp3, m4a, wav…). Se guardan en tu equipo.
          </div>
        )}
        {list.map((t) => {
          const active = t.id === currentId
          return (
            <div
              key={t.id}
              className={cn(
                'group flex items-center gap-2 rounded-lg px-2 py-1.5 transition',
                active ? 'bg-accent/12' : 'hover:bg-muted',
              )}
            >
              <button
                onClick={() => playId(t.id)}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground group-hover:text-foreground',
                )}
              >
                {active && playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  active && 'font-medium text-accent',
                )}
              >
                {t.name}
              </span>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        className="mx-1 mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition hover:border-accent hover:text-accent"
      >
        <Plus size={15} /> Añadir canciones
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={addFiles}
      />

      {/* Barra de reproducción */}
      <div className="mt-3 border-t border-border px-1 pt-3">
        <p className="mb-1.5 truncate text-center text-xs font-medium">
          {current ? current.name : 'Nada en reproducción'}
        </p>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-accent"
        />
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{fmt(progress * duration)}</span>
          <span>{fmt(duration)}</span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1">
          <button
            onClick={() => setShuffle((s) => !s)}
            title="Aleatorio"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition',
              shuffle ? 'text-accent' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Shuffle size={15} />
          </button>
          <button
            onClick={() => step(-1)}
            aria-label="Canción anterior"
            title="Anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pausar música' : 'Reproducir música'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:opacity-90"
          >
            {playing ? <Pause size={19} /> : <Play size={19} />}
          </button>
          <button
            onClick={() => step(1)}
            aria-label="Canción siguiente"
            title="Siguiente"
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <SkipForward size={18} />
          </button>
          <button
            onClick={() =>
              setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
            }
            title={`Repetir: ${repeat}`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition',
              repeat !== 'off' ? 'text-accent' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={musicVolume}
          onChange={(e) => setMusicVolume(Number(e.target.value))}
          className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-accent"
        />
      </div>
    </div>
  )
}
