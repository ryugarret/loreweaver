import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Cloud,
  RefreshCw,
  Check,
  Copy,
  ShieldCheck,
  LogOut,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { signUp, signIn, signOut, unlock, isUnlocked } from '@/lib/account'
import { sync, subscribeSync, getSyncStatus, type SyncStatus } from '@/lib/sync'
import { cn } from '@/lib/utils'

const inputCls =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/25'

function friendly(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.'
  if (/already|registered|exists/i.test(msg))
    return 'Ya hay una cuenta con ese email. Inicia sesión.'
  if (/Password should be at least/i.test(msg))
    return 'La contraseña es demasiado corta (mínimo 6).'
  if (/email/i.test(msg) && /invalid/i.test(msg)) return 'Ese email no es válido.'
  if (/cofre|descifr|decrypt|operation-specific/i.test(msg))
    return 'Contraseña incorrecta para el cifrado.'
  return msg
}

function syncLine(s: SyncStatus): string {
  if (s.state === 'syncing') return 'Sincronizando…'
  if (s.state === 'error') return `Error al sincronizar: ${s.error ?? ''}`
  if (s.lastSyncAt)
    return `Sincronizado · ${new Date(s.lastSyncAt).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  return 'Listo para sincronizar'
}

export function AccountSection() {
  const [session, setSession] = useState<Session | null>(null)
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [unlockPass, setUnlockPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState(false)
  const st = useSyncExternalStore(subscribeSync, getSyncStatus)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) setUnlocked(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(friendly(String((e as Error)?.message ?? e)))
    } finally {
      setBusy(false)
    }
  }

  const doSignUp = () =>
    run(async () => {
      const r = await signUp(email.trim(), password)
      if (r.status === 'confirm-email') {
        setConfirmEmail(true)
        return
      }
      if (r.recoveryKey) setRecoveryKey(r.recoveryKey)
      setUnlocked(true)
      void sync()
    })

  const doSignIn = () =>
    run(async () => {
      const r = await signIn(email.trim(), password)
      if (r.recoveryKey) setRecoveryKey(r.recoveryKey)
      setUnlocked(true)
      void sync()
    })

  const doUnlock = () =>
    run(async () => {
      await unlock(unlockPass)
      setUnlockPass('')
      setUnlocked(true)
      void sync()
    })

  const doSignOut = () =>
    run(async () => {
      await signOut()
      setUnlocked(false)
    })

  async function copyKey() {
    if (!recoveryKey) return
    try {
      await navigator.clipboard.writeText(recoveryKey)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard bloqueado: el usuario puede seleccionar y copiar a mano */
    }
  }

  const tab = (active: boolean) =>
    cn(
      'rounded-lg border py-2 text-sm transition',
      active
        ? 'border-accent bg-accent/10 text-accent'
        : 'border-border text-muted-foreground hover:bg-muted',
    )

  // 1) Mostrar la clave de recuperación una sola vez
  if (recoveryKey) {
    return (
      <div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <ShieldCheck size={15} /> Guarda tu clave de recuperación
          </div>
          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
            Es la <b>única</b> forma de recuperar tus historias si olvidas la
            contraseña. Guárdala en un lugar seguro; no se volverá a mostrar.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-lg bg-background px-3 py-2 font-mono text-xs">
              {recoveryKey}
            </code>
            <Button variant="outline" size="sm" onClick={copyKey}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
        </div>
        <Button className="mt-3 w-full" onClick={() => setRecoveryKey(null)}>
          La he guardado
        </Button>
      </div>
    )
  }

  // 2) Sin sesión
  if (!session) {
    if (confirmEmail) {
      return (
        <div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Te enviamos un correo a <b className="text-foreground">{email}</b>.
            Confírmalo y después inicia sesión aquí para activar el cifrado.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              setConfirmEmail(false)
              setMode('signin')
            }}
          >
            Ya lo he confirmado — iniciar sesión
          </Button>
        </div>
      )
    }
    return (
      <div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Opcional. Crea una cuenta para sincronizar tus historias entre
          dispositivos. Todo viaja <b>cifrado de extremo a extremo</b>: ni el
          servidor puede leer lo que escribes. Sin cuenta, la app sigue funcionando
          100% en local.
        </p>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <button onClick={() => setMode('signup')} className={tab(mode === 'signup')}>
            Crear cuenta
          </button>
          <button onClick={() => setMode('signin')} className={tab(mode === 'signin')}>
            Entrar
          </button>
        </div>
        <div className="space-y-2">
          <input
            className={inputCls}
            type="email"
            placeholder="tu@email.com"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={inputCls}
            type="password"
            placeholder="Contraseña"
            value={password}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email && password)
                mode === 'signup' ? doSignUp() : doSignIn()
            }}
          />
        </div>
        {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
        <Button
          className="mt-3 w-full"
          disabled={busy || !email || !password}
          onClick={mode === 'signup' ? doSignUp : doSignIn}
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {mode === 'signup' ? 'Crear cuenta y sincronizar' : 'Iniciar sesión'}
        </Button>
      </div>
    )
  }

  // 3) Con sesión pero cofre cerrado (hay que desbloquear con la contraseña)
  if (!unlocked) {
    return (
      <div>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          Sesión iniciada como <b className="text-foreground">{session.user.email}</b>
          . Introduce tu contraseña para abrir el cifrado en este dispositivo.
        </p>
        <input
          className={inputCls}
          type="password"
          placeholder="Contraseña"
          value={unlockPass}
          autoComplete="current-password"
          onChange={(e) => setUnlockPass(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && unlockPass) doUnlock()
          }}
        />
        {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" disabled={busy || !unlockPass} onClick={doUnlock}>
            {busy && <Loader2 size={15} className="animate-spin" />} Desbloquear
          </Button>
          <Button variant="ghost" onClick={doSignOut}>
            <LogOut size={15} /> Salir
          </Button>
        </div>
      </div>
    )
  }

  // 4) Con sesión y cofre abierto
  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-border bg-background/40 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
          <Cloud size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{session.user.email}</div>
          <div className="truncate text-xs text-muted-foreground">{syncLine(st)}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={st.state === 'syncing'}
          onClick={() => void sync()}
        >
          <RefreshCw size={14} className={cn(st.state === 'syncing' && 'animate-spin')} />
          Sincronizar ahora
        </Button>
        <Button variant="ghost" size="sm" onClick={doSignOut}>
          <LogOut size={14} /> Cerrar sesión
        </Button>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-accent" />
        Cifrado de extremo a extremo: el servidor solo guarda texto ilegible. (Las
        imágenes y la música aún no se sincronizan.)
      </p>
    </div>
  )
}
