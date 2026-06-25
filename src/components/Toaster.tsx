import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, Info, X } from 'lucide-react'
import {
  subscribeToasts,
  getToasts,
  dismissToast,
  type ToastKind,
} from '@/lib/toast'
import { cn } from '@/lib/utils'

const ring: Record<ToastKind, string> = {
  ok: 'border-emerald-500/40',
  error: 'border-danger/50',
  info: 'border-accent/40',
}

function icon(kind: ToastKind) {
  if (kind === 'error') return <X size={15} className="shrink-0 text-danger" />
  if (kind === 'info') return <Info size={15} className="shrink-0 text-accent" />
  return <Check size={15} className="shrink-0 text-emerald-500" />
}

export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts)
  if (!items.length) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          title="Descartar"
          className={cn(
            'animate-pop-in pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-left text-sm font-medium text-foreground shadow-xl',
            ring[t.kind],
          )}
        >
          {icon(t.kind)}
          <span>{t.text}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
