import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { createLane, renameLane, deleteLane } from '@/lib/repo'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'

export function LanesModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean
  onClose: () => void
  projectId: string
}) {
  const lanes =
    useLiveQuery(
      () => db.lanes.where('projectId').equals(projectId).sortBy('order'),
      [projectId],
    ) ?? []
  const [newName, setNewName] = useState('')

  async function add() {
    if (!newName.trim()) return
    await createLane(projectId, newName)
    setNewName('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tramas / líneas argumentales"
      width="max-w-md"
    >
      <div className="space-y-3 px-5 py-5">
        <p className="text-xs text-muted-foreground">
          Crea tramas para organizar la timeline visual en carriles paralelos.
          Luego asigna cada evento a una trama.
        </p>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nueva trama (ej: Trama principal)…"
            onKeyDown={(e) => e.key === 'Enter' && add()}
            autoFocus
          />
          <Button onClick={add}>
            <Plus size={16} /> Añadir
          </Button>
        </div>
        {lanes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Aún no hay tramas.
          </p>
        ) : (
          <div className="space-y-1.5">
            {lanes.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5"
              >
                <input
                  defaultValue={l.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== l.name)
                      void renameLane(l.id, e.target.value)
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                />
                <button
                  onClick={() => deleteLane(l)}
                  title="Eliminar trama (los eventos quedan sin trama)"
                  aria-label={`Eliminar trama ${l.name}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
