import { lazy, Suspense } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useUi } from '@/store/ui'

// Carga diferida: arrastra Supabase (~200 KB); solo se baja al abrir el modal.
const AccountSection = lazy(() =>
  import('@/components/settings/AccountSection').then((m) => ({
    default: m.AccountSection,
  })),
)

/** Modal de "Cuenta y sincronización", accesible desde la cabecera de inicio. */
export function AccountModal() {
  const accountOpen = useUi((s) => s.accountOpen)
  const setAccountOpen = useUi((s) => s.setAccountOpen)
  return (
    <Modal
      open={accountOpen}
      onClose={() => setAccountOpen(false)}
      title="Cuenta y sincronización"
    >
      <div className="p-5">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
        >
          <AccountSection />
        </Suspense>
      </div>
    </Modal>
  )
}
