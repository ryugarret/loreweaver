import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
  width?: string
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  width = 'max-w-lg',
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // onClose puede cambiar de identidad cada render; lo leemos por ref para que el
  // efecto NO se re-ejecute en cada tecla (si no, robaría el foco al escribir).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const close = () => onCloseRef.current()
    const prevFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'

    const focusables = () => {
      const d = dialogRef.current
      if (!d) return [] as HTMLElement[]
      return [...d.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      )
    }

    // Foco inicial dentro del diálogo (accesibilidad de teclado).
    const raf = requestAnimationFrame(() => {
      const f = focusables()
      ;(f[0] ?? dialogRef.current)?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key === 'Tab') {
        const d = dialogRef.current
        const f = focusables()
        if (!d) return
        if (!f.length) {
          e.preventDefault()
          return
        }
        const first = f[0]
        const last = f[f.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !d.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !d.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      // Devolver el foco a quien abrió el diálogo.
      prevFocus?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'animate-pop-in relative z-10 max-h-[90vh] w-full overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none',
          width,
          className,
        )}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
