/**
 * Compresión de imágenes en el cliente (sin librerías). Para que ocupen lo
 * mínimo —en el disco y, sobre todo, en la nube (Supabase Free = 1 GB)— sin
 * perder calidad visible: redimensiona a un lado máximo y reencoda a WebP,
 * quedándose con el resultado más pequeño (o con el original si no mejora).
 *
 * GIF y SVG se conservan tal cual (animación / vector). Si el navegador no puede
 * decodificar o reencodar, se guarda el original: nunca empeora ni rompe la subida.
 */

/** Lado máximo (px). 1600 se ve nítido incluso a 2× en pantallas retina. */
const MAX_EDGE = 1600
/** Calidad WebP (0–1). 0.82 = sin pérdida apreciable a tamaño de visualización. */
const QUALITY = 0.82
const KEEP_AS_IS = /^image\/(gif|svg\+xml)$/

/** Blob "plano" (no un File): Safari/iOS a veces clona mal un File en IndexedDB. */
function plainBlob(b: Blob): Blob {
  return b.slice(0, b.size, b.type)
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  q: number,
): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), type, q))
}

export async function compressImage(file: Blob): Promise<Blob> {
  if (!file.type.startsWith('image/') || KEEP_AS_IS.test(file.type)) {
    return plainBlob(file)
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return plainBlob(file) // formato no decodificable → guardar original
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return plainBlob(file)
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  // WebP (mejor ratio) y, de reserva, el mismo formato ya redimensionado (por si
  // el navegador no encoda WebP). Nos quedamos con el más pequeño que mejore.
  const [webp, same] = await Promise.all([
    encode(canvas, 'image/webp', QUALITY),
    encode(canvas, file.type, QUALITY),
  ])
  const best = [webp, same]
    .filter((b): b is Blob => !!b && b.size < file.size)
    .sort((a, b) => a.size - b.size)[0]

  return best ?? plainBlob(file)
}
