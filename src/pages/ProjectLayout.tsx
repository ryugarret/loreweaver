import { Suspense, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  NavLink,
  Outlet,
  useParams,
  Link,
  useLocation,
} from 'react-router-dom'
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
  Menu,
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
  // Cajón del menú en pantallas pequeñas (< lg). En lg+ el menú es fijo.
  const [mobileNav, setMobileNav] = useState(false)
  const location = useLocation()
  useEffect(() => setMobileNav(false), [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fondo oscuro del cajón (solo móvil/tablet) */}
      {mobileNav && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}

      <aside
        className={cn(
          'z-50 flex shrink-0 flex-col border-r border-border bg-card transition-all duration-200',
          // Móvil/tablet: cajón fijo que entra desde la izquierda.
          'fixed inset-y-0 left-0 w-64 lg:static',
          mobileNav ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Escritorio: ancho según el estado de colapso.
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-60',
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
          {/* Miniatura + título: ocultos solo en escritorio colapsado. */}
          <div
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2',
              sidebarCollapsed && 'lg:hidden',
            )}
          >
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
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              onClick={() => setMobileNav(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  sidebarCollapsed && 'lg:justify-center lg:px-0',
                  isActive
                    ? 'bg-accent/12 text-accent'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className={cn(sidebarCollapsed && 'lg:hidden')}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Pie: ajustes */}
        <div
          className={cn(
            'flex items-center gap-1 border-t border-border p-2',
            sidebarCollapsed && 'lg:flex-col',
          )}
        >
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expandir' : 'Contraer'}
            aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:flex"
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
            aria-label="Cambiar tema"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Ajustes"
            aria-label="Ajustes"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Settings size={18} />
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Barra superior solo en móvil/tablet: abre el menú. */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 lg:hidden">
          <button
            onClick={() => setMobileNav(true)}
            aria-label="Abrir menú"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Menu size={20} />
          </button>
          {project && (
            <ProjectCover
              project={project}
              scrim={false}
              className="h-7 w-7 shrink-0 rounded-md"
            />
          )}
          <span className="truncate font-serif text-sm font-semibold">
            {project?.title ?? '…'}
          </span>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
