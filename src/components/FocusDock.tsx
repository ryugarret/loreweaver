import { useEffect, useState } from 'react'
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  X,
  Volume2,
  VolumeX,
  Waves,
  Music,
  Video,
  Keyboard,
} from 'lucide-react'
import { useUi } from '@/store/ui'
import { audio, SOUNDSCAPES, type Soundscape } from '@/lib/audio'
import { keySound, KEY_PROFILES } from '@/lib/keyboard'
import { MusicPlayer } from '@/components/MusicPlayer'
import { YouTubePanel } from '@/components/YouTubePanel'
import { cn } from '@/lib/utils'

type Tab = 'timer' | 'sound' | 'music' | 'youtube'

const TABS: { id: Tab; label: string; icon: typeof Timer }[] = [
  { id: 'timer', label: 'Enfoque', icon: Timer },
  { id: 'sound', label: 'Ambiente', icon: Waves },
  { id: 'music', label: 'Música', icon: Music },
  { id: 'youtube', label: 'YouTube', icon: Video },
]

function chime() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0.0001
    o.connect(g).connect(ctx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7)
    o.stop(ctx.currentTime + 0.75)
    window.setTimeout(() => void ctx.close(), 900)
  } catch {
    /* ignore */
  }
}

/** Notificación del sistema (si el usuario dio permiso); si no, no hace nada. */
function notify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, silent: true })
    }
  } catch {
    /* ignore */
  }
}

function fmt(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function FocusDock() {
  const work = useUi((s) => s.pomodoroWork)
  const brk = useUi((s) => s.pomodoroBreak)
  const keyboardSound = useUi((s) => s.keyboardSound)
  const keyboardVolume = useUi((s) => s.keyboardVolume)
  const keyboardProfile = useUi((s) => s.keyboardProfile)
  const setKeyboardSound = useUi((s) => s.setKeyboardSound)
  const setKeyboardVolume = useUi((s) => s.setKeyboardVolume)
  const setKeyboardProfile = useUi((s) => s.setKeyboardProfile)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('timer')

  const [phase, setPhase] = useState<'work' | 'break'>('work')
  const [secs, setSecs] = useState(work * 60)
  const [running, setRunning] = useState(false)
  /** Sesiones de concentración completadas (tomates). */
  const [rounds, setRounds] = useState(0)

  const [scape, setScape] = useState<Soundscape | null>(null)
  const [volume, setVolume] = useState(0.5)

  useEffect(() => {
    if (!running) setSecs((phase === 'work' ? work : brk) * 60)
  }, [work, brk, phase, running])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          const next = phase === 'work' ? 'break' : 'work'
          setPhase(next)
          chime()
          if (phase === 'work') {
            setRounds((r) => r + 1)
            notify('¡Sesión completada! 🍅', `Toca un descanso de ${brk} min.`)
          } else {
            notify('Descanso terminado', `De vuelta a concentrarse ${work} min.`)
          }
          return (next === 'work' ? work : brk) * 60
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, phase, work, brk])

  function toggleTimer() {
    setRunning((r) => {
      const next = !r
      // Al arrancar por primera vez, pedir permiso para avisar al terminar.
      if (next && 'Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
      return next
    })
  }

  function reset() {
    setRunning(false)
    setPhase('work')
    setSecs(work * 60)
    setRounds(0)
  }

  function toggleScape(id: Soundscape) {
    if (scape === id) {
      audio.stop()
      setScape(null)
    } else {
      audio.play(id)
      setScape(id)
    }
  }

  const totalForPhase = (phase === 'work' ? work : brk) * 60
  const progress = 1 - secs / Math.max(1, totalForPhase)
  const R = 52
  const C = 2 * Math.PI * R

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      <div
        className={cn(
          'w-[min(380px,calc(100vw-2.5rem))] origin-bottom-right overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-3 scale-95 opacity-0',
        )}
      >
        {/* Pestañas */}
        <div className="flex border-b border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
                tab === id
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ENFOQUE (Pomodoro) */}
          <div className={cn('flex flex-col items-center', tab !== 'timer' && 'hidden')}>
            <span
              className={cn(
                'mb-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                phase === 'work'
                  ? 'bg-accent/12 text-accent'
                  : 'bg-emerald-500/15 text-emerald-500',
              )}
            >
              {phase === 'work' ? 'Concentración' : 'Descanso'}
            </span>
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
                <circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  stroke="var(--accent)"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - progress)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-serif text-3xl font-semibold tabular-nums">
                {fmt(secs)}
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={toggleTimer}
                aria-label={running ? 'Pausar temporizador' : 'Iniciar temporizador'}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:opacity-90"
              >
                {running ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={reset}
                aria-label="Reiniciar temporizador"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground"
              >
                <RotateCcw size={17} />
              </button>
            </div>
            {/* Tomates completados hoy en esta sesión */}
            <div className="mt-3 flex min-h-[18px] items-center gap-1" aria-live="polite">
              {rounds === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Sin sesiones completadas aún
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span aria-hidden>
                    {'🍅'.repeat(Math.min(rounds, 8))}
                    {rounds > 8 ? '…' : ''}
                  </span>
                  {rounds} {rounds === 1 ? 'sesión' : 'sesiones'}
                </span>
              )}
            </div>
          </div>

          {/* AMBIENTE (sonidos + teclado) */}
          <div className={cn(tab !== 'sound' && 'hidden')}>
            <div className="grid grid-cols-2 gap-2">
              {SOUNDSCAPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleScape(s.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border py-3 text-sm transition',
                    scape === s.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span className="text-xl">{s.emoji}</span>
                  {s.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {volume === 0 ? (
                <VolumeX size={16} className="text-muted-foreground" />
              ) : (
                <Volume2 size={16} className="text-muted-foreground" />
              )}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volumen del sonido ambiente"
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                  audio.setVolume(v)
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-accent"
              />
            </div>

            {/* Teclado mecánico */}
            <div className="mt-4 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Keyboard size={15} /> Teclado mecánico
                </span>
                <button
                  role="switch"
                  aria-checked={keyboardSound}
                  aria-label="Sonido de teclado mecánico"
                  onClick={() => {
                    const v = !keyboardSound
                    setKeyboardSound(v)
                    keySound.enabled = v
                    if (v) keySound.click(true)
                  }}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition',
                    keyboardSound ? 'bg-accent' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                      keyboardSound ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
              {keyboardSound && (
                <>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {KEY_PROFILES.map((kp) => (
                      <button
                        key={kp.id}
                        onClick={() => {
                          setKeyboardProfile(kp.id)
                          keySound.profile = kp.id
                          keySound.click(true)
                        }}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[11px] transition',
                          keyboardProfile === kp.id
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        <span className="text-sm">{kp.emoji}</span>
                        {kp.name}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={keyboardVolume}
                    aria-label="Volumen del teclado mecánico"
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setKeyboardVolume(v)
                      keySound.volume = v
                      keySound.click()
                    }}
                    className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-accent"
                  />
                </>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Suena al teclear en el editor. Prueba los 4 tipos de switch. 🌧️⌨️
              </p>
            </div>
          </div>

          {/* MÚSICA + YOUTUBE (siempre montados para no cortar la reproducción) */}
          <MusicPlayer visible={tab === 'music'} />
          <YouTubePanel visible={tab === 'youtube'} />
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        title="Enfoque, ambiente y música"
        aria-label={open ? 'Cerrar panel de enfoque' : 'Abrir panel de enfoque'}
        aria-expanded={open}
        className={cn(
          'pointer-events-auto flex items-center justify-center rounded-full shadow-lg transition hover:scale-105',
          running || scape
            ? 'bg-accent text-accent-foreground'
            : 'border border-border bg-card text-foreground',
        )}
        style={{ height: 52, width: 52 }}
      >
        {open ? <X size={20} /> : <Timer size={20} />}
      </button>
    </div>
  )
}
