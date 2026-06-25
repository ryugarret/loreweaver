import { Suspense } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, Outlet, useParams, Link } from 'react-router-dom'
import {
  PenLine,
  BookMarked,
  Share2,
  Clock,
  LayoutDashboard,
  BarChart3,
  ChevronLeft,
  Settings,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
} from 'lucide-react'
import { db } from '@/lib/db'
import { ProjectCover } from '@/components/ProjectCover'
import { useUi } from '@/store/ui'
import { useResolvedDark } from '@/lib/theme'
import { cn } from '@/lib/utils'

const NAV = [
  { to: 'write', label: 'Escribir', icon: PenLine },
  { to: 'wiki', label: 'Wiki', icon: BookMarked },
  { to: 'graph', label: 'Relaciones', icon: Share2 },
  { to: 'timeline', label: 'Línea de tiempo', icon: Clock },
  { to: 'board', label: 'Tablero', icon: LayoutDashboard },
  { to: 'stats', label: 'Progreso', icon: BarChart3 },
  { to: 'guide', label: 'Guía', icon: BookOpen },
]

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId],
  )
  const { sidebarCollapsed, toggleSidebar, setTheme, setSettingsOpen } = useUi()
  const isDark = useResolvedDark()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-card transition-all duration-200',
          sidebarCollapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Cabecera del proyecto */}
        <div className="flex h-16 items-center gap-2 border-b border-border px-3">
          <Link
            to="/"
            title="Volver a proyectos"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={18} />
          </Link>
          {!sidebarCollapsed && (
            <>
              {project && (
                <ProjectCover
                  project={project}
                  scrim={false}
                  className="h-9 w-9 shrink-0 rounded-lg"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-sm font-semibold">
                  {project?.title ?? '…'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {project?.genre || 'Proyecto'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  sidebarCollapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-accent/12 text-accent'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Pie: ajustes */}
        <div
          className={cn(
            'flex items-center gap-1 border-t border-border p-2',
            sidebarCollapsed && 'flex-col',
          )}
        >
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expandir' : 'Contraer'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title="Cambiar tema"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Ajustes"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Settings size={18} />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
