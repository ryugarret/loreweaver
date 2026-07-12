/**
 * Análisis de estilo (100% local, sin diccionarios): detecta palabras muy
 * repetidas, frases que se repiten y "ecos" (misma palabra demasiado cerca),
 * para ayudar a diversificar el vocabulario. Ignora palabras vacías (ES + EN)
 * y las @menciones (nombres de fichas, que es normal que se repitan).
 */

// Palabras vacías / funcionales más comunes en español e inglés. No pretenden
// ser exhaustivas: filtran el ruido de artículos, preposiciones, pronombres…
const STOPWORDS = new Set(
  (
    'de la que el en y a los del se las por un para con no una su al lo como mas ' +
    'pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me ' +
    'hasta hay donde quien desde todo nos durante todos uno les ni contra otros ' +
    'ese eso ante ellos esto mi antes algunos que unos yo otro otras otra el tanto ' +
    'esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo ' +
    'nosotros mis tu te ti tus ellas os esos esas estoy estas esta estamos estan ' +
    'ser es son era fue ha han habia tiene tienen tenia hacia tras segun cada toda ' +
    'todas asi aqui alli ahi entonces luego despues ahora bien mal cual sino aunque ' +
    'the of and a to in is you that it he was for on are as with his they i at be ' +
    'this have from or one had by but not what all were we when your can said there ' +
    'an which she do how their if will up other about out many then them these so ' +
    'some her would make like him into time has look more go see no way could my ' +
    'than first been who its now did get come over new just where much before too ' +
    'any same our well such because here why went off again around still should very ' +
    'his its her their'
  ).split(/\s+/),
)

export interface RepeatedWord {
  word: string
  count: number
}
export interface RepeatedPhrase {
  phrase: string
  count: number
}
export interface CloseRepeat {
  word: string
  /** distancia (en palabras) entre las dos apariciones más cercanas */
  distance: number
}

export interface StyleReport {
  words: number
  unique: number
  /** riqueza léxica 0..1 (palabras distintas / total) */
  richness: number
  repeatedWords: RepeatedWord[]
  repeatedPhrases: RepeatedPhrase[]
  closeRepeats: CloseRepeat[]
}

/** Texto plano de un capítulo, quitando las @menciones (nombres de fichas). */
function extractText(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('.mention').forEach((el) => el.replaceWith(' '))
  return doc.body.textContent ?? ''
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}]+/gu) ?? []
}

const MIN_LEN = 4 // ignora palabras cortas para las "muy repetidas"
const CLOSE_WINDOW = 40 // palabras: dos apariciones más cerca = "eco"

export function analyzeText(html: string): StyleReport {
  const tokens = tokenize(extractText(html))
  const words = tokens.length
  const unique = new Set(tokens).size

  // Palabras de contenido (sin vacías ni cortas) → frecuencia.
  const freq = new Map<string, number>()
  const positions = new Map<string, number[]>()
  tokens.forEach((t, i) => {
    if (t.length < MIN_LEN || STOPWORDS.has(t)) return
    freq.set(t, (freq.get(t) ?? 0) + 1)
    const arr = positions.get(t)
    if (arr) arr.push(i)
    else positions.set(t, [i])
  })

  const repeatedWords: RepeatedWord[] = [...freq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }))

  // Frases repetidas: n-gramas de 4 y 3 palabras que aparecen ≥ 2 veces,
  // quitando las que son subcadena de una más larga ya listada.
  const phraseCounts = new Map<string, number>()
  for (let n = 4; n >= 3; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const g = tokens.slice(i, i + n).join(' ')
      phraseCounts.set(g, (phraseCounts.get(g) ?? 0) + 1)
    }
  }
  const sorted = [...phraseCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort(
      (a, b) =>
        b[0].split(' ').length * b[1] - a[0].split(' ').length * a[1],
    )
  const kept: RepeatedPhrase[] = []
  for (const [phrase, count] of sorted) {
    if (!kept.some((k) => k.phrase.includes(phrase))) {
      kept.push({ phrase, count })
    }
    if (kept.length >= 12) break
  }
  const repeatedPhrases = kept

  // "Ecos": misma palabra de contenido dos veces muy cerca.
  const closeRepeats: CloseRepeat[] = []
  for (const [word, pos] of positions) {
    let best = Infinity
    for (let i = 1; i < pos.length; i++) best = Math.min(best, pos[i] - pos[i - 1])
    if (best <= CLOSE_WINDOW) closeRepeats.push({ word, distance: best })
  }
  closeRepeats.sort((a, b) => a.distance - b.distance)

  return {
    words,
    unique,
    richness: words ? unique / words : 0,
    repeatedWords,
    repeatedPhrases,
    closeRepeats: closeRepeats.slice(0, 15),
  }
}
