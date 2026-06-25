import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  ImagePlus,
  Star,
  BookOpen,
  Clock,
  Loader2,
} from 'lucide-react'
import { db, type WikiEntry, type WikiType, type WikiField } from '@/lib/db'
import { saveWiki, addImages, deleteImage, findBacklinks } from '@/lib/repo'
import { Input, Textarea, Label, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { BlobImage } from '@/components/BlobImage'
import { WIKI_TYPES, wikiMeta } from '@/components/wikiMeta'
import { toast } from '@/lib/toast'
import { PALETTE, uid, cn } from '@/lib/utils'

export function WikiDetail({
  entry,
  onClose,
  onDelete,
}: {
  entry: WikiEntry
  onClose: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<WikiEntry>(entry)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const timer = useRef<number | null>(null)
  const [tagInput, setTagInput] = useState(entry.tags.join(', '))
  const imgInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Reordenar atributos arrastrando por el asa (GripVertical).
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)
  const [overFieldId, setOverFieldId] = useState<string | null>(null)
  const images =
    useLiveQuery(
      () => db.images.where('entryId').equals(entry.id).sortBy('addedAt'),
      [entry.id],
    ) ?? []
  const cover = images.find((i) => i.id === draft.coverImageId) ?? images[0]
  const navigate = useNavigate()
  const backlinks = useLiveQuery(
    () => findBacklinks(entry.projectId, entry.id),
    [entry.id, entry.projectId],
  )

  function update(part: Partial<WikiEntry>) {
    setDraft((d) => {
      const next = { ...d, ...part }
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void saveWiki(next), 400)
      return next
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timer.current) window.clearTimeout(timer.current)
      void saveWiki(draftRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addField() {
    const f: WikiField = { id: uid(), label: '', value: '' }
    update({ fields: [...draft.fields, f] })
  }
  function updateField(id: string, part: Partial<WikiField>) {
    update({
      fields: draft.fields.map((f) => (f.id === id ? { ...f, ...part } : f)),
    })
  }
  function removeField(id: string) {
    update({ fields: draft.fields.filter((f) => f.id !== id) })
  }
  function reorderFields(fromId: string, toId: string) {
    if (fromId === toId) return
    const arr = [...draft.fields]
    const from = arr.findIndex((f) => f.id === fromId)
    const to = arr.findIndex((f) => f.id === toId)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    update({ fields: arr })
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    e.target.value = ''
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      await addImages(entry.id, entry.projectId, files)
    } catch {
      toast('No se pudo subir la imagen', 'error')
    } finally {
      setUploading(false)
    }
  }
  async function removeImage(id: string) {
    await deleteImage(id)
    if (draft.coverImageId === id) update({ coverImageId: undefined })
  }

  const meta = wikiMeta(draft.type)

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <aside className="animate-pop-in relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          {cover ? (
            <BlobImage
              blob={cover.blob}
              alt={draft.name}
              className="h-11 w-11 shrink-0 overflow-hidden rounded-xl object-cover"
            />
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-white"
              style={{ backgroundColor: draft.color }}
            >
              {draft.name.trim().charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg font-semibold">
              {draft.name || 'Sin nombre'}
            </p>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {meta.icon(12)} {meta.label}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ficha"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <Label>Nombre</Label>
            <Input
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={draft.type}
                onChange={(e) =>
                  update({ type: e.target.value as WikiType })
                }
              >
                {WIKI_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <div className="pt-1.5">
                <ColorPicker
                  value={draft.color}
                  onChange={(c) => update({ color: c })}
                  colors={PALETTE.slice(0, 8)}
                  swatchClass="h-6 w-6"
                />
              </div>
            </div>
          </div>

          {(draft.type === 'character' || draft.type === 'creature') && (
            <div>
              <Label>Género</Label>
              <Select
                value={draft.gender ?? ''}
                onChange={(e) =>
                  update({
                    gender:
                      e.target.value === ''
                        ? undefined
                        : (e.target.value as 'male' | 'female'),
                  })
                }
              >
                <option value="">Sin especificar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Solo se usa para colorear el árbol genealógico.
              </p>
            </div>
          )}

          {/* Imágenes de referencia */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="mb-0">Imágenes de referencia</Label>
              <Button
                size="sm"
                variant="subtle"
                disabled={uploading}
                onClick={() => imgInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Subiendo…
                  </>
                ) : (
                  <>
                    <ImagePlus size={14} /> Subir
                  </>
                )}
              </Button>
            </div>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onUpload}
            />
            {images.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sube retratos, mapas o moodboards (JPG, PNG, WebP). Se guardan en
                tu equipo.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => {
                  const isCover = cover?.id === img.id
                  return (
                    <div
                      key={img.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                    >
                      <BlobImage
                        blob={img.blob}
                        className="h-full w-full object-cover"
                      />
                      {isCover && (
                        <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium text-accent-foreground">
                          Portada
                        </span>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/45 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => update({ coverImageId: img.id })}
                          title="Usar de portada"
                          className="rounded-md bg-white/90 p-1.5 text-black transition hover:bg-white"
                        >
                          <Star
                            size={14}
                            className={isCover ? 'fill-current' : ''}
                          />
                        </button>
                        <button
                          onClick={() => removeImage(img.id)}
                          title="Eliminar imagen"
                          className="rounded-md bg-white/90 p-1.5 text-danger transition hover:bg-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <Label>Resumen</Label>
            <Textarea
              value={draft.summary}
              onChange={(e) => update({ summary: e.target.value })}
              placeholder="Una descripción breve…"
            />
          </div>

          {/* Campos personalizados */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="mb-0">Atributos</Label>
              <Button size="sm" variant="subtle" onClick={addField}>
                <Plus size={14} /> Añadir
              </Button>
            </div>
            <div className="space-y-2">
              {draft.fields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Añade atributos como “Edad”, “Origen”, “Lealtad”…
                </p>
              )}
              {draft.fields.map((f) => (
                <div
                  key={f.id}
                  onDragOver={(e) => {
                    if (dragFieldId) {
                      e.preventDefault()
                      if (overFieldId !== f.id) setOverFieldId(f.id)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragFieldId) reorderFields(dragFieldId, f.id)
                    setDragFieldId(null)
                    setOverFieldId(null)
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg transition',
                    dragFieldId === f.id && 'opacity-40',
                    overFieldId === f.id &&
                      dragFieldId &&
                      dragFieldId !== f.id &&
                      'ring-2 ring-accent/50',
                  )}
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragFieldId(f.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', f.id)
                    }}
                    onDragEnd={() => {
                      setDragFieldId(null)
                      setOverFieldId(null)
                    }}
                    title="Arrastra para reordenar"
                    aria-label="Reordenar atributo"
                    className="shrink-0 cursor-grab text-muted-foreground/40 transition hover:text-muted-foreground active:cursor-grabbing"
                  >
                    <GripVertical size={14} />
                  </span>
                  <Input
                    value={f.label}
                    onChange={(e) => updateField(f.id, { label: e.target.value })}
                    placeholder="Atributo"
                    className="h-9 w-28 shrink-0"
                  />
                  <Input
                    value={f.value}
                    onChange={(e) => updateField(f.id, { value: e.target.value })}
                    placeholder="Valor"
                    className="h-9 flex-1"
                  />
                  <button
                    onClick={() => removeField(f.id)}
                    aria-label="Eliminar atributo"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Etiquetas</Label>
            <Input
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value)
                update({
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }}
              placeholder="protagonista, mago, capítulo 1…"
            />
            {draft.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Historia, trasfondo, ideas sueltas…"
              className="min-h-32"
            />
          </div>

          {/* Backlinks: dónde se @menciona esta ficha */}
          {!!(backlinks?.chapters.length || backlinks?.events.length) && (
            <div>
              <Label>Aparece en</Label>
              <div className="space-y-1.5">
                {backlinks!.chapters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      navigate(`/p/${entry.projectId}/write/${c.id}`)
                      onClose()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-muted"
                  >
                    <BookOpen
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
                {backlinks!.events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => {
                      navigate(`/p/${entry.projectId}/timeline`)
                      onClose()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-muted"
                  >
                    <Clock size={14} className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{ev.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      evento
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="border-t border-border px-5 py-3">
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={16} /> Eliminar ficha
          </Button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        title={`Eliminar "${draft.name || 'Sin nombre'}"`}
        message="Se borrará esta ficha, sus imágenes y todas sus relaciones (incluidas las del árbol genealógico). No se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          onDelete()
          toast('Ficha eliminada')
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>,
    document.body,
  )
}
