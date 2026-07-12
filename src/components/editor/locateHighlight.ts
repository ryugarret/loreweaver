import { Extension } from '@tiptap/core'
import {
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Editor } from '@tiptap/react'

const locateKey = new PluginKey<DecorationSet>('locateHighlight')

/**
 * Resaltado TEMPORAL (no se guarda en el texto ni cuenta para deshacer): pinta
 * unos rangos con la clase `.locate-flash` mediante decoraciones de ProseMirror.
 * Se activa/limpia pasando metadatos en una transacción.
 */
export const LocateHighlight = Extension.create({
  name: 'locateHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: locateKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr: Transaction, old: DecorationSet): DecorationSet {
            const meta = tr.getMeta(locateKey) as
              | [number, number][]
              | 'clear'
              | undefined
            if (meta === 'clear') return DecorationSet.empty
            if (meta) {
              return DecorationSet.create(
                tr.doc,
                meta.map(([from, to]) =>
                  Decoration.inline(from, to, { class: 'locate-flash' }),
                ),
              )
            }
            return old.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state: EditorState) {
            return locateKey.getState(state)
          },
        },
      }),
    ]
  },
})

const FLASH_MS = 2200
let clearTimer: number | undefined

/**
 * Rangos [desde, hasta] de todas las apariciones de `query` (una palabra o una
 * frase de varias) en el editor. Recorre párrafo a párrafo (bloque de texto):
 * dentro de cada uno une los nodos de texto en una cadena con su mapa
 * char→posición, así encuentra una frase aunque cruce negritas/cursivas, y
 * nunca la cruza de un párrafo a otro (cada bloque se busca por separado).
 */
function findRanges(editor: Editor, query: string): [number, number][] {
  const words = query.trim().split(/\s+/)
  if (words[0] === '') return []
  // Palabras separadas por "no-letras". Solo letras → no hace falta escapar.
  const re = new RegExp(
    `(?<![\\p{L}])${words.join('[^\\p{L}]+')}(?![\\p{L}])`,
    'giu',
  )

  const ranges: [number, number][] = []
  editor.state.doc.descendants((node, nodePos) => {
    if (!node.isTextblock) return true // seguir bajando hasta los párrafos
    // Contenido inline del bloque: cadena + posición absoluta de cada carácter.
    let text = ''
    const pos: number[] = []
    node.forEach((child, childOffset) => {
      if (child.isText && child.text) {
        for (let k = 0; k < child.text.length; k++) {
          text += child.text[k]
          pos.push(nodePos + 1 + childOffset + k)
        }
      }
    })
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      ranges.push([pos[m.index], pos[m.index + m[0].length - 1] + 1])
    }
    return false // ya procesado; no descender dentro del bloque
  })
  return ranges
}

/** Resalta unos rangos, desplaza la vista al primero y los limpia a los ~2 s. */
function flash(editor: Editor, ranges: [number, number][]) {
  if (ranges.length === 0) return
  editor.view.dispatch(editor.view.state.tr.setMeta(locateKey, ranges))
  editor.chain().setTextSelection(ranges[0][0]).scrollIntoView().run()

  if (clearTimer) window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => {
    if (editor.isDestroyed) return
    editor.view.dispatch(editor.view.state.tr.setMeta(locateKey, 'clear'))
  }, FLASH_MS)
}

/**
 * Lleva la vista al "eco" de `word`: resalta solo el par de apariciones más
 * próximo (una palabra frecuente sale muchas veces; el eco es la pareja cercana).
 */
export function locateEcho(editor: Editor, word: string) {
  const ranges = findRanges(editor, word)
  if (ranges.length === 0) return

  let pick: [number, number][] = [ranges[0]]
  if (ranges.length > 1) {
    let bestGap = Infinity
    let bestIdx = 1
    for (let i = 1; i < ranges.length; i++) {
      const gap = ranges[i][0] - ranges[i - 1][1]
      if (gap < bestGap) {
        bestGap = gap
        bestIdx = i
      }
    }
    pick = [ranges[bestIdx - 1], ranges[bestIdx]]
  }
  flash(editor, pick)
}

/** Resalta TODAS las apariciones de `query` (una palabra o una frase) y salta a la primera. */
export function locateAll(editor: Editor, query: string) {
  flash(editor, findRanges(editor, query))
}
