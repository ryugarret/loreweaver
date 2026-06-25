import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams } from 'react-router-dom'
import { Flame, Target, FileText, BookMarked, Clock, Type } from 'lucide-react'
import { db, type DailyLog } from '@/lib/db'
import { setWordGoal } from '@/lib/repo'
import { CHAPTER_STATUS, statusMeta } from '@/lib/constants'
import { useUi } from '@/store/ui'
import { cn } from '@/lib/utils'

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function computeStreak(map: Map<string, number>): number {
  let streak = 0
  const d = new Date()
  if (!((map.get(dayKey(d)) ?? 0) > 0)) d.setDate(d.getDate() - 1)
  while ((map.get(dayKey(d)) ?? 0) > 0) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div
        className={cn(
          'mb-2 flex h-9 w-9 items-center justify-center rounded-lg',
          accent ? 'bg-accent/12 text-accent' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <p className="font-serif text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function StatsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const dailyGoal = useUi((s) => s.dailyGoal)
  const setDailyGoal = useUi((s) => s.setDailyGoal)
  const [goalDraft, setGoalDraft] = useState<number | null>(null)

  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId],
  )
  const chapters = useLiveQuery(
    () =>
      projectId
        ? db.chapters.where('projectId').equals(projectId).sortBy('order')
        : [],
    [projectId],
  )
  const wikiCount = useLiveQuery(
    () => (projectId ? db.wiki.where('projectId').equals(projectId).count() : 0),
    [projectId],
  )
  const eventCount = useLiveQuery(
    () => (projectId ? db.events.where('projectId').equals(projectId).count() : 0),
    [projectId],
  )
  const daily = useLiveQuery(() => db.daily.toArray(), [])

  const chs = chapters ?? []
  const totalWords = chs.reduce((s, c) => s + c.wordCount, 0)
  const maxCh = Math.max(1, ...chs.map((c) => c.wordCount))
  const goal = goalDraft ?? project?.wordGoal ?? 0
  const dailyMap = new Map((daily ?? []).map((d: DailyLog) => [d.date, d.words]))
  const todayWords = dailyMap.get(dayKey(new Date())) ?? 0
  const streak = computeStreak(dailyMap)

  // últimos 14 días
  const last14: { date: string; words: number; label: string }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    last14.push({
      date: dayKey(d),
      words: dailyMap.get(dayKey(d)) ?? 0,
      label: String(d.getDate()),
    })
  }
  const max14 = Math.max(1, ...last14.map((x) => x.words))

  const statusCounts = CHAPTER_STATUS.map((s) => ({
    ...s,
    count: chs.filter((c) => c.status === s.id).length,
  }))

  function saveGoal(v: number) {
    setGoalDraft(v)
    if (projectId) void setWordGoal(projectId, v)
  }

  // Evitar el parpadeo de ceros mientras cargan los datos de IndexedDB.
  if (chapters === undefined || daily === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-7">
        <h1 className="mb-1 font-serif text-2xl font-semibold">Progreso</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Tus números de escritura, en local y en tiempo real.
        </p>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Type size={18} />}
            label="Palabras totales"
            value={totalWords.toLocaleString('es-ES')}
            accent
          />
          <StatCard
            icon={<FileText size={18} />}
            label="Capítulos"
            value={String(chs.length)}
          />
          <StatCard
            icon={<Flame size={18} />}
            label={streak === 1 ? 'día de racha' : 'días de racha'}
            value={String(streak)}
            accent={streak > 0}
          />
          <StatCard
            icon={<Type size={18} />}
            label="Palabras hoy"
            value={todayWords.toLocaleString('es-ES')}
          />
        </div>

        {/* Objetivo del proyecto */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Target size={16} className="text-accent" /> Objetivo del proyecto
            </span>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                step={1000}
                value={goal || ''}
                placeholder="0"
                onChange={(e) => saveGoal(Number(e.target.value) || 0)}
                className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-right tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
              />
              <span className="text-muted-foreground">palabras</span>
            </div>
          </div>
          {goal > 0 ? (
            <>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, (totalWords / goal) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {totalWords.toLocaleString('es-ES')} de {goal.toLocaleString('es-ES')} ·{' '}
                {Math.round((totalWords / goal) * 100)}% ·{' '}
                {Math.max(0, goal - totalWords).toLocaleString('es-ES')} restantes
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Fija un objetivo (p. ej. 80 000 para una novela) y verás tu avance.
            </p>
          )}
        </div>

        {/* Racha diaria + 14 días */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">Hábito diario</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              meta diaria
              <input
                type="number"
                min={0}
                step={50}
                value={dailyGoal || ''}
                onChange={(e) => setDailyGoal(Number(e.target.value) || 0)}
                className="h-7 w-20 rounded-lg border border-input bg-background px-2 text-right tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
              />
            </div>
          </div>
          <div className="flex h-28 items-end gap-1.5">
            {last14.map((d) => {
              const met = dailyGoal > 0 && d.words >= dailyGoal
              const h =
                d.words === 0 ? 3 : Math.max(6, Math.round((d.words / max14) * 92))
              return (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-all',
                      d.words === 0
                        ? 'bg-muted'
                        : met
                          ? 'bg-accent'
                          : 'bg-accent/50',
                    )}
                    style={{ height: `${h}px` }}
                    title={`${d.words} palabras`}
                  />
                  <span className="text-[9px] text-muted-foreground">{d.label}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hoy llevas <strong className="text-foreground">{todayWords}</strong>
            {dailyGoal > 0 && ` de ${dailyGoal}`} palabras. Escribe a diario para
            mantener la racha. 🔥
          </p>
        </div>

        {/* Desglose por estado */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium">Capítulos por estado</h2>
          <div className="space-y-2">
            {statusCounts.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {s.label}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${chs.length ? (s.count / chs.length) * 100 : 0}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs tabular-nums">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Palabras por capítulo */}
        {chs.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium">Palabras por capítulo</h2>
            <div className="space-y-2">
              {chs.map((c, i) => {
                const sm = statusMeta(c.status)
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">
                      {i + 1}. {c.title || 'Sin título'}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(c.wordCount / maxCh) * 100}%`,
                          backgroundColor: sm.color,
                        }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums">
                      {c.wordCount.toLocaleString('es-ES')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Mundo */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<BookMarked size={18} />}
            label="Fichas de wiki"
            value={String(wikiCount ?? 0)}
          />
          <StatCard
            icon={<Clock size={18} />}
            label="Eventos"
            value={String(eventCount ?? 0)}
          />
          <StatCard
            icon={<Type size={18} />}
            label="Media por capítulo"
            value={(chs.length
              ? Math.round(totalWords / chs.length)
              : 0
            ).toLocaleString('es-ES')}
          />
        </div>
      </div>
    </div>
  )
}
