import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  BookOpen,
  Settings,
  Trash2,
  Pencil,
  Moon,
  Sun,
  Feather,
} from 'lucide-react'
import { db, type Project } from '@/lib/db'
import { deleteProject } from '@/lib/repo'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProjectCover } from '@/components/ProjectCover'
import { ProjectFormModal } from '@/components/ProjectFormModal'
import { timeAgo } from '@/lib/utils'
import { useUi } from '@/store/ui'
import { useResolvedDark } from '@/lib/theme'

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
}) {
  const stats = useLiveQuery(async () => {
    const chapters = await db.chapters
      .where('projectId')
      .equals(project.id)
      .toArray()
    const words = chapters.reduce((sum, c) => sum + c.wordCount, 0)
    const wiki = await db.wiki.where('projectId').equals(project.id).count()
    return { chapters: chapters.length, words, wiki }
  }, [project.id])

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/p/${project.id}/write`} className="block">
        <ProjectCover project={project} className="h-28">
          <div className="absolute bottom-3 left-4 flex items-center gap-2 text-white/90">
            <BookOpen size={18} />
            {project.genre && (
              <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-medium backdrop-blur">
                {project.genre}
              </span>
            )}
          </div>
        </ProjectCover>
        <div className="p-4">
          <h3 className="truncate font-serif text-lg font-semibold">
            {project.title}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            {project.description || 'Sin descripción todavía.'}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{stats?.chapters ?? 0} cap.</span>
            <span>·</span>
            <span>{(stats?.words ?? 0).toLocaleString('es-ES')} palabras</span>
            <span>·</span>
            <span>{stats?.wiki ?? 0} fichas</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70">
            {timeAgo(project.updatedAt)}
          </p>
        </div>
      </Link>
      <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onEdit}
          title="Editar proyecto"
          aria-label="Editar proyecto"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-white backdrop-blur transition hover:bg-black/45"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          title="Eliminar proyecto"
          aria-label="Eliminar proyecto"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-white backdrop-blur transition hover:bg-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const projects = useLiveQuery(
    () => db.projects.orderBy('updatedAt').reverse().toArray(),
    [],
  )
  const { setTheme, setSettingsOpen } = useUi()
  const isDark = useResolvedDark()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [toDelete, setToDelete] = useState<Project | null>(null)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Feather size={18} />
            </div>
            <div>
              <h1 className="font-serif text-lg font-semibold leading-none">
                Loreweaver
              </h1>
              <p className="text-xs text-muted-foreground">Tu estudio de escritura</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              title="Cambiar tema"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Ajustes"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Tus proyectos</h2>
            <p className="text-sm text-muted-foreground">
              {projects === undefined
                ? 'Cargando…'
                : projects.length
                  ? `${projects.length} ${projects.length === 1 ? 'mundo' : 'mundos'} en construcción`
                  : 'Empieza tu primer universo'}
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} /> Nuevo proyecto
          </Button>
        </div>

        {projects && projects.length === 0 && (
          <EmptyState
            icon={<BookOpen size={26} />}
            title="Aún no hay proyectos"
            description="Crea tu primera novela: capítulos, personajes, mapas y línea de tiempo, todo guardado en tu ordenador."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus size={18} /> Crear proyecto
              </Button>
            }
          />
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => setEditing(p)}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </div>
      </main>

      {/* Crear / editar proyecto (mismo modal) */}
      <ProjectFormModal
        open={creating || !!editing}
        project={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onCreated={(id) => {
          setCreating(false)
          navigate(`/p/${id}/write`)
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar proyecto"
        message={`Se borrará "${toDelete?.title}" con todos sus capítulos, fichas y notas. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => toDelete && deleteProject(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
