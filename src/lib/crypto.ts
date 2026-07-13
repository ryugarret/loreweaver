/**
 * Cifrado extremo-a-extremo (E2E) para la sincronización.
 *
 * Modelo (estándar, tipo Bitwarden/Proton):
 *  - DEK (Data Encryption Key): clave AES-GCM 256 aleatoria con la que se cifran
 *    de verdad los datos. Nunca sale del dispositivo en claro.
 *  - KEK (Key Encryption Key): clave derivada de la FRASE del usuario (PBKDF2).
 *    Solo sirve para "envolver" (cifrar) la DEK.
 *  - Se guarda la DEK envuelta dos veces: con la frase y con una CLAVE DE
 *    RECUPERACIÓN (por si se olvida la frase). El servidor solo ve esos paquetes
 *    cifrados + una sal; jamás la frase, la clave de recuperación ni la DEK.
 *
 * Cambiar la frase re-envuelve la MISMA DEK (no hay que recifrar los datos).
 * Todo con WebCrypto nativo (sin dependencias). Requiere contexto seguro
 * (HTTPS o localhost); GitHub Pages y el dev server lo cumplen.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

/** Iteraciones de PBKDF2. Ajustable; equilibra seguridad y rapidez en móvil. */
const PBKDF2_ITERATIONS = 250_000
const SALT_BYTES = 16
const IV_BYTES = 12

/** Bytes respaldados por ArrayBuffer: lo que exige WebCrypto (nada de SharedArrayBuffer). */
type Bytes = Uint8Array<ArrayBuffer>

/** Paquete cifrado (IV + texto cifrado, ambos en base64). */
export interface Cipher {
  iv: string
  ct: string
}

/**
 * "Llavero" que viaja al servidor: la DEK envuelta con la frase y con la clave
 * de recuperación, más las sales. No contiene ningún secreto en claro.
 */
export interface Keyring {
  v: 1
  iterations: number
  salt: string
  wrappedByPass: Cipher
  recoverySalt: string
  wrappedByRecovery: Cipher
}

/* ---------- utilidades base64 / aleatoriedad ---------- */

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromB64(b64: string): Bytes {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

function randomBytes(n: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** Copia a un buffer propio (ArrayBuffer) lo que TextEncoder deja como genérico. */
function utf8(text: string): Bytes {
  return new Uint8Array(enc.encode(text))
}

/** ¿Hay WebCrypto disponible? (contexto seguro). */
export function cryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    (typeof isSecureContext === 'undefined' || isSecureContext)
  )
}

/* ---------- primitivas AES-GCM ---------- */

async function encryptBytes(data: Bytes, key: CryptoKey): Promise<Cipher> {
  const iv = randomBytes(IV_BYTES)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) }
}

async function decryptBytes(cipher: Cipher, key: CryptoKey): Promise<Bytes> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(cipher.iv) },
    key,
    fromB64(cipher.ct),
  )
  return new Uint8Array(pt)
}

/* ---------- derivación de clave y envoltura de la DEK ---------- */

/** KEK derivada de un secreto (frase o clave de recuperación) con PBKDF2. */
async function deriveKEK(
  secret: string,
  salt: Bytes,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', utf8(secret), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** DEK nueva y aleatoria (extraíble para poder envolverla). */
async function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

async function wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<Cipher> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek))
  return encryptBytes(raw, kek)
}

async function unwrapDEK(wrapped: Cipher, kek: CryptoKey): Promise<CryptoKey> {
  const raw = await decryptBytes(wrapped, kek)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

/* ---------- clave de recuperación (legible por humanos) ---------- */

/** 20 bytes → 8 grupos de 5 hex, ej: "9F3A1-2C4D5-…". */
function formatRecoveryKey(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  hex = hex.toUpperCase()
  const groups: string[] = []
  for (let i = 0; i < hex.length; i += 5) groups.push(hex.slice(i, i + 5))
  return groups.join('-')
}

/** Normaliza lo que teclee el usuario (quita guiones/espacios, mayúsculas). */
function normalizeRecoveryKey(key: string): string {
  return key.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

/* ---------- API pública ---------- */

/**
 * Crea un cofre nuevo: genera la DEK, la envuelve con la frase y con una clave
 * de recuperación recién generada. Devuelve el llavero (para guardar/sincronizar),
 * la DEK ya lista para usar en esta sesión, y la clave de recuperación (mostrarla
 * UNA sola vez: si se pierde junto con la frase, los datos son irrecuperables).
 */
export async function createKeyring(
  passphrase: string,
): Promise<{ keyring: Keyring; dek: CryptoKey; recoveryKey: string }> {
  const dek = await generateDEK()

  const salt = randomBytes(SALT_BYTES)
  const wrappedByPass = await wrapDEK(dek, await deriveKEK(passphrase, salt))

  const recoveryKey = formatRecoveryKey(randomBytes(20))
  const recoverySalt = randomBytes(SALT_BYTES)
  const wrappedByRecovery = await wrapDEK(
    dek,
    await deriveKEK(normalizeRecoveryKey(recoveryKey), recoverySalt),
  )

  return {
    keyring: {
      v: 1,
      iterations: PBKDF2_ITERATIONS,
      salt: toB64(salt),
      wrappedByPass,
      recoverySalt: toB64(recoverySalt),
      wrappedByRecovery,
    },
    dek,
    recoveryKey,
  }
}

/** Abre el cofre con la frase. Lanza si es incorrecta (falla la autenticación GCM). */
export async function unlockWithPassphrase(
  keyring: Keyring,
  passphrase: string,
): Promise<CryptoKey> {
  const kek = await deriveKEK(passphrase, fromB64(keyring.salt), keyring.iterations)
  return unwrapDEK(keyring.wrappedByPass, kek)
}

/** Abre el cofre con la clave de recuperación (cuando se olvida la frase). */
export async function unlockWithRecoveryKey(
  keyring: Keyring,
  recoveryKey: string,
): Promise<CryptoKey> {
  const kek = await deriveKEK(
    normalizeRecoveryKey(recoveryKey),
    fromB64(keyring.recoverySalt),
    keyring.iterations,
  )
  return unwrapDEK(keyring.wrappedByRecovery, kek)
}

/** Cambia la frase: re-envuelve la MISMA DEK (no recifra los datos). */
export async function rewrapWithNewPassphrase(
  keyring: Keyring,
  dek: CryptoKey,
  newPassphrase: string,
): Promise<Keyring> {
  const salt = randomBytes(SALT_BYTES)
  const wrappedByPass = await wrapDEK(dek, await deriveKEK(newPassphrase, salt))
  return { ...keyring, salt: toB64(salt), wrappedByPass }
}

/* ---------- cifrar / descifrar datos con la DEK ---------- */

export async function encryptString(text: string, dek: CryptoKey): Promise<Cipher> {
  return encryptBytes(utf8(text), dek)
}

export async function decryptString(cipher: Cipher, dek: CryptoKey): Promise<string> {
  return dec.decode(await decryptBytes(cipher, dek))
}

export async function encryptJSON(value: unknown, dek: CryptoKey): Promise<Cipher> {
  return encryptString(JSON.stringify(value), dek)
}

export async function decryptJSON<T>(cipher: Cipher, dek: CryptoKey): Promise<T> {
  return JSON.parse(await decryptString(cipher, dek)) as T
}

/* ---------- blobs binarios (imágenes) para Storage ---------- */

/** Cifra un Blob → Blob binario (iv[12] ++ ciphertext). Sin base64 = mínimo tamaño. */
export async function encryptBlob(blob: Blob, dek: CryptoKey): Promise<Blob> {
  const iv = randomBytes(IV_BYTES)
  const data = new Uint8Array(await blob.arrayBuffer())
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, data)
  return new Blob([iv, ct])
}

/** Descifra un Blob producido por encryptBlob. */
export async function decryptBlob(blob: Blob, dek: CryptoKey): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.slice(0, IV_BYTES) },
    dek,
    buf.slice(IV_BYTES),
  )
  return new Blob([pt])
}

/** SHA-256 en hex de un Blob (clave de dedupe y ruta en Storage). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}
