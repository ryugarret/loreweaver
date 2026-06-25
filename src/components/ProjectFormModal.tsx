import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Trash2 } from 'lucide-react'
import { db, type Project } from '@/lib/db'
import {
  createProject,
  updateProject,
  setProjectCover,
  removeProjectCover,
} from '@/lib/repo'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Label } from '@/components/ui/Field'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { BlobImage } from '@/components/BlobImage'
import { toast } from '@/lib/toast'
import { PALETTE } from '@/lib/utils'

/** Modal para crear un proyecto nuevo o editar uno existente (título, género,
 *  descripción, color y foto de portada). */
export function ProjectFormModal({
  open,
  project,
  onClose,
  onCreated,
}: {
  open: boolean
  /** null = crear; un proyecto = editar */
  project: Project | null
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const editing = !!project
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [removeCover, setRemoveCover] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  // Portada actual (solo en edición).
  const existingCover = useLiveQuery(async () => {
    if (!project) return undefined
    if (project.coverImageId) {
      const c = await db.images.get(project.coverImageId)
      if (c) return c
    }
    return db.images.where('entryId').equals(project.id).first()
  }, [project?.id, project?.coverImageId])

  // Reiniciar los campos cada vez que se abre (con o sin proyecto).
  useEffect(() => {
    if (!open) return
    setTitle(project?.title ?? '')
    setGenre(project?.genre ?? '')
    setDescription(project?.description ?? '')
    setColor(project?.coverColor ?? PALETTE[0])
    setCoverFile(null)
    setRemoveCover(false)
    setBusy(false)
  }, [open, project])

  // Previsualización local de la foto recién elegida.
  const filePreview = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : null),
    [coverFile],
  )
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview)
    }
  }, [filePreview])

  const hasCover = !!coverFile || (!!existingCover && !removeCover)

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image')) {
      toast('Elige un archivo de imagen (JPG, PNG, WebP…)', 'error')
      return
    }
    setCoverFile(f)
    setRemoveCover(false)
  }

  function clearCover() {
    setCoverFile(null)
    setRemoveCover(true)
  }

  async function save() {
    if (busy) return
    setBusy(true)
    try {
      if (editing && project) {
        await updateProject(project.id, {
          title: title.trim() || 'Proyecto sin título',
          genre,
          description,
          coverColor: color,
        })
        if (coverFile) await setProjectCover(project.id, coverFile)
        else if (removeCover) await removeProjectCover(project.id)
        toast('Proyecto actualizado')
        onClose()
      } else {
        const id = await createProject({
          title,
          description,
          genre,
          coverColor: color,
        })
        if (coverFile) await setProjectCover(id, coverFile)
        onCreated?.(id)
      }
    } catch {
      toast('No se pudo guardar el proyecto', 'error')
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
    >
      <div className="space-y-4 px-5 py-5">
        {/* Foto de portada */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">Portada</Label>
            <div className="flex items-center gap-1.5">
              {hasCover && (
                <Button size="sm" variant="ghost" onClick={clearCover}>
                  <Trash2 size={14} /> Quitar foto
                </Button>
              )}
              <Button
                size="sm"
                variant="subtle"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={14} /> {hasCover ? 'Cambiar' : 'Subir foto'}
              </Button>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <div
            className="relative h-32 overflow-hidden rounded-xl border border-border"
            style={
              hasCover
                ? undefined
                : {
                    background: `linear-gradient(135deg, ${color}, ${color}99)`,
                  }
            }
          >
            {coverFile ? (
              <img
                src={filePreview ?? ''}
                alt="Portada"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : existingCover && !removeCover ? (
              <BlobImage
                blob={existingCover.blob}
                alt="Portada"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_30%,#fff_1px,transparent_1px),radial-gradient(circle_at_70%_60%,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sube una imagen (se guarda en tu equipo) o deja solo el color de abajo.
          </p>
        </div>

        <div>
          <Label>Título</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="El nombre de tu historia"
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>
        <div>
          <Label>Género</Label>
          <Input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Fantasía, ciencia ficción, romance…"
          />
        </div>
        <div>
          <Label>Descripción</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Una frase que resuma tu novela…"
          />
        </div>
        <div>
          <Label>Color de portada</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy
            ? 'Guardando…'
            : editing
              ? 'Guardar cambios'
              : 'Crear proyecto'}
        </Button>
      </div>
    </Modal>
  )
}
