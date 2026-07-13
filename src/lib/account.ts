/**
 * Cuenta + "cofre" E2E: registro/login con Supabase y gestión de la clave de
 * cifrado (DEK). El servidor solo guarda el llavero cifrado; la contraseña sirve
 * para autenticar (Supabase guarda su hash) y, EN LOCAL, para derivar la clave que
 * abre el cofre — esa clave nunca se envía.
 *
 * La DEK se guarda también en IndexedDB de este dispositivo: los datos locales ya
 * están en claro (la app es local-first), así que no reduce la privacidad frente al
 * servidor y evita re-pedir la contraseña en cada recarga. El E2E protege lo que
 * viaja a Supabase, no el propio dispositivo del usuario.
 */
import { supabase } from './supabase'
import { db } from './db'
import { now } from './utils'
import {
  createKeyring,
  unlockWithPassphrase,
  unlockWithRecoveryKey,
  rewrapWithNewPassphrase,
  type Keyring,
} from './crypto'

const DEK_KV_KEY = 'sync.dek'
/** Bandera ligera en localStorage: hay cuenta en este dispositivo. La lee el
 *  arranque para cargar el módulo de sync SOLO si hace falta (bundle liviano). */
const ACCOUNT_FLAG = 'lw-account'

/** Clave de datos de la sesión (en memoria). null = cofre cerrado. */
let dek: CryptoKey | null = null

export function isUnlocked(): boolean {
  return dek !== null
}

/** La DEK actual (para cifrar/descifrar en el motor de sync). */
export function currentDEK(): CryptoKey | null {
  return dek
}

async function setDEK(key: CryptoKey | null): Promise<void> {
  dek = key
  if (key) {
    await db.kv.put({ key: DEK_KV_KEY, value: key })
    localStorage.setItem(ACCOUNT_FLAG, '1')
  } else {
    await db.kv.delete(DEK_KV_KEY)
    localStorage.removeItem(ACCOUNT_FLAG)
  }
}

/** Al arrancar la app: recupera la DEK guardada en este dispositivo (si la hay). */
export async function restoreDEK(): Promise<boolean> {
  const row = await db.kv.get(DEK_KV_KEY)
  if (row?.value) {
    dek = row.value as CryptoKey
    return true
  }
  return false
}

/* ---------- llavero en el servidor (solo cifrado) ---------- */

async function saveKeyring(userId: string, keyring: Keyring): Promise<void> {
  const { error } = await supabase
    .from('keyring')
    .upsert({ user_id: userId, data: keyring, updated_at: now() })
  if (error) throw error
}

async function loadKeyring(userId: string): Promise<Keyring | null> {
  const { data, error } = await supabase
    .from('keyring')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.data as Keyring) ?? null
}

/* ---------- registro / login ---------- */

/**
 * Crea o abre el cofre del usuario (necesita sesión iniciada, por RLS). Si aún no
 * existe, lo crea y devuelve la clave de recuperación (para mostrarla una vez); si
 * ya existe, lo abre con la contraseña y devuelve null.
 */
async function ensureKeyring(userId: string, password: string): Promise<string | null> {
  const existing = await loadKeyring(userId)
  if (existing) {
    await setDEK(await unlockWithPassphrase(existing, password))
    return null
  }
  const { keyring, dek: newDek, recoveryKey } = await createKeyring(password)
  await saveKeyring(userId, keyring)
  await setDEK(newDek)
  return recoveryKey
}

export type SignUpResult =
  | { status: 'ready'; recoveryKey: string }
  | { status: 'confirm-email' }

/**
 * Registra la cuenta. Si el proyecto exige confirmar el email, devuelve
 * 'confirm-email' y el cofre se creará en el primer inicio de sesión (tras
 * confirmar). Si no, crea el cofre ya y devuelve la clave de recuperación.
 */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  if (!data.session || !data.user) return { status: 'confirm-email' }
  const recoveryKey = await ensureKeyring(data.user.id, password)
  return { status: 'ready', recoveryKey: recoveryKey ?? '' }
}

/**
 * Inicia sesión y abre el cofre. En el PRIMER inicio de sesión (cuenta con email ya
 * confirmado pero sin cofre) lo crea y devuelve la clave de recuperación.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ recoveryKey: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return { recoveryKey: await ensureKeyring(data.user.id, password) }
}

/**
 * Reabre el cofre con la contraseña cuando ya hay sesión pero no hay DEK en este
 * dispositivo (p. ej. otro navegador, o tras limpiar datos locales).
 */
export async function unlock(password: string): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('No hay sesión iniciada.')
  const keyring = await loadKeyring(userId)
  if (!keyring) throw new Error('Esta cuenta no tiene un cofre de cifrado.')
  await setDEK(await unlockWithPassphrase(keyring, password))
}

/** Cierra sesión y el cofre (borra la DEK y el estado de sync de este dispositivo). */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  await setDEK(null)
  await db.kv.delete('sync.state') // bookkeeping por-dispositivo; se rehace al entrar
}

/**
 * Olvidó la contraseña: tras resetearla por email e iniciar sesión con la nueva,
 * desbloquea el cofre con la clave de recuperación y lo re-envuelve con la nueva
 * contraseña (los datos no se recifran).
 */
export async function recoverWithKey(
  recoveryKey: string,
  newPassword: string,
): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Inicia sesión con la contraseña nueva primero.')
  const keyring = await loadKeyring(userId)
  if (!keyring) throw new Error('Esta cuenta no tiene un cofre de cifrado.')
  const recoveredDek = await unlockWithRecoveryKey(keyring, recoveryKey)
  await saveKeyring(userId, await rewrapWithNewPassphrase(keyring, recoveredDek, newPassword))
  await setDEK(recoveredDek)
}
