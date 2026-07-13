import {
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type ChangeEvent,
} from 'react'
import {
  Download,
  Upload,
  Trash2,
  Monitor,
  Moon,
  Sun,
  Check,
  HardDrive,
  Link2,
  RefreshCw,
  Cloud,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useUi, ACCENTS, accentColor, type ThemeMode } from '@/store/ui'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { importAll, wipeAll } from '@/lib/repo'
import { saveBackup, openBackup, linkedFileName } from '@/lib/fileBackup'
import {
  subscribeDisk,
  getDiskStatus,
  linkBackupFile,
  reconnectBackupFile,
  unlinkBackupFile,
  saveToDiskNow,
} from '@/lib/diskSync'
import { cn } from '@/lib/utils'

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Monitor },
]

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="border-t border-border px-5 py-4 first:border-t-0">
      <Label>{title}</Label>
      {children}
    </div>
  )
}

export function SettingsModal() {
  const {
    settingsOpen,
    setSettingsOpen,
    setAccountOpen,
    theme,
    setTheme,
    accentId,
    setAccent,
    editorFont,
    setEditorFont,
    pomodoroWork,
    pomodoroBreak,
    setPomodoro,
  } = useUi()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const msgTimer = useRef<number | null>(null)
  const [linked, setLinked] = useState<string | null>(linkedFileName())
  const [wiping, setWiping] = useState(false)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const disk = useSyncExternalStore(subscribeDisk, getDiskStatus)

  function notify(text: string, error = false) {
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    setMsg({ text, error })
    msgTimer.current = window.setTimeout(() => setMsg(null), 4500)
  }

  async function handleExport() {
    const r = await saveBackup()
    setLinked(linkedFileName())
    if (r === 'saved') notify(`Guardado en ${linkedFileName()} ✓`)
    else if (r === 'downloaded') notify('Copia de seguridad descargada ✓')
  }

  async function handleOpen() {
    try {
      const r = await openBackup()
      if (r.status === 'opened') setPendingImport(r.text)
      else if (r.status === 'unsupported') fileRef.current?.click()
    } catch {
      notify('No se pudo abrir el archivo', true)
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    e.target.value = ''
    setPendingImport(text)
  }

  async function doImport() {
    if (!pendingImport) return
    try {
      await importAll(pendingImport)
      setLinked(linkedFileName())
      notify('Datos importados correctamente ✓')
    } catch {
      notify('El archivo no es una copia válida de Loreweaver', true)
    }
  }

  return (
    <>
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Ajustes"
      >
        <div className="pb-2">
          <Section title="Tema">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm transition',
                    theme === id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Color de acento">
            <ColorPicker
              value={accentColor(accentId)}
              onChange={(c) => setAccent(c)}
              colors={ACCENTS.map((a) => a.color)}
              swatchClass="h-9 w-9"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Elige uno de los predefinidos o pulsa la rueda para cualquier color.
            </p>
          </Section>

          <Section title="Tipografía del editor">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditorFont('serif')}
                className={cn(
                  'rounded-xl border py-3 font-serif text-base transition',
                  editorFont === 'serif'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                Serif (manuscrito)
              </button>
              <button
                onClick={() => setEditorFont('sans')}
                className={cn(
                  'rounded-xl border py-3 font-sans text-base transition',
                  editorFont === 'sans'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                Sans (moderno)
              </button>
            </div>
          </Section>

          <Section title="Pomodoro (minutos)">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">
                  Concentración
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={pomodoroWork}
                  onChange={(e) =>
                    setPomodoro(Number(e.target.value) || 25, pomodoroBreak)
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">
                  Descanso
                </span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={pomodoroBreak}
                  onChange={(e) =>
                    setPomodoro(pomodoroWork, Number(e.target.value) || 5)
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25"
                />
              </div>
            </div>
          </Section>

          <Section title="Cuenta y sincronización (opcional)">
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Sincroniza tus historias entre dispositivos con cifrado de extremo a
              extremo. También desde el botón «Sincronizar» de la pantalla de inicio.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSettingsOpen(false)
                setAccountOpen(true)
              }}
            >
              <Cloud size={15} /> Abrir cuenta y sincronización
            </Button>
          </Section>

          <Section title="Tus datos (copia de seguridad)">
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Todo se guarda solo en este navegador. La copia incluye proyectos,
              capítulos, fichas, relaciones, árbol genealógico, tramas, imágenes de
              referencia y tu racha. (La música local no se incluye; vuelve a
              añadirla.) Expórtala para no perder nada o pasarla a otro ordenador.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download size={15} /> Guardar copia
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpen}>
                <Upload size={15} /> Abrir copia
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImport}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger/10"
                onClick={() => setWiping(true)}
              >
                <Trash2 size={15} /> Borrar todo
              </Button>
            </div>
            {linked && (
              <p className="mt-2 text-xs text-muted-foreground">
                Vinculado a <span className="font-medium">{linked}</span> ·
                «Guardar copia» actualiza ese archivo.
              </p>
            )}
            {msg && (
              <p
                className={cn(
                  'mt-3 text-xs font-medium',
                  msg.error ? 'text-danger' : 'text-accent',
                )}
              >
                {msg.text}
              </p>
            )}

            {/* Guardado en disco real (auto) */}
            <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <HardDrive size={14} /> Guardado en disco real
              </div>
              {!disk.supported ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tu navegador no permite guardar en un archivo del disco
                  automáticamente. Usa Chrome o Edge para esto, o las copias
                  manuales de arriba.
                </p>
              ) : disk.state === 'off' ? (
                <>
                  <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                    Vincula un archivo <code>.json</code> y la app lo mantendrá al
                    día sola en cada cambio: tus datos viven en el disco, no solo en
                    el navegador.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void linkBackupFile()}
                  >
                    <Link2 size={14} /> Vincular archivo de guardado
                  </Button>
                </>
              ) : disk.state === 'paused' ? (
                <>
                  <p className="mb-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                    El guardado automático en «{disk.fileName}» se pausó al recargar
                    la página. Pulsa Reanudar para seguir guardando en ese archivo.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void reconnectBackupFile()}
                    >
                      <RefreshCw size={14} /> Reanudar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void unlinkBackupFile()}
                    >
                      Desvincular
                    </Button>
                  </div>
                </>
              ) : disk.state === 'denied' ? (
                <>
                  <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                    No se ha podido activar el guardado automático en este archivo
                    (el navegador denegó el permiso). Usa «Guardar copia» de arriba, o
                    vincula otro archivo.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void linkBackupFile()}
                    >
                      <Link2 size={14} /> Vincular otro archivo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void unlinkBackupFile()}
                    >
                      Desvincular
                    </Button>
                  </div>
                </>
              ) : disk.state === 'error' ? (
                <>
                  <p className="mb-2 text-xs leading-relaxed text-danger">
                    No se pudo guardar la última vez en «{disk.fileName}» (¿se movió o
                    borró el archivo, o está lleno el disco?).
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void saveToDiskNow()}
                    >
                      <RefreshCw size={14} /> Reintentar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void unlinkBackupFile()}
                    >
                      Desvincular
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check size={13} />
                    {disk.state === 'saving'
                      ? `Guardando en «${disk.fileName}»…`
                      : `Guardando en «${disk.fileName}» automáticamente`}
                    {disk.lastSavedAt && disk.state === 'active'
                      ? ` · ${new Date(disk.lastSavedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void saveToDiskNow()}
                    >
                      Guardar ahora
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void unlinkBackupFile()}
                    >
                      Desvincular
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Section>
        </div>
      </Modal>

      <ConfirmDialog
        open={wiping}
        title="Borrar todos los datos"
        message="Se eliminará TODO de este navegador: proyectos, capítulos, fichas, relaciones, árbol, tramas, imágenes, música y racha. Asegúrate de haber exportado una copia. No se puede deshacer."
        confirmLabel="Borrar todo"
        danger
        onConfirm={() => {
          void (async () => {
            // Desvincular el disco ANTES de borrar para que el auto-guardado no
            // sobrescriba el archivo del disco con datos vacíos.
            await unlinkBackupFile()
            await wipeAll()
            setLinked(null)
            notify('Todos los datos han sido borrados')
          })()
        }}
        onClose={() => setWiping(false)}
      />

      <ConfirmDialog
        open={!!pendingImport}
        title="Importar copia"
        message="Se fusionará esta copia con tus datos actuales: lo que coincida (mismo id) se sobrescribe y lo que no, se conserva. Si quieres, haz antes una «Guardar copia»."
        confirmLabel="Importar"
        onConfirm={() => void doImport()}
        onClose={() => setPendingImport(null)}
      />
    </>
  )
}
