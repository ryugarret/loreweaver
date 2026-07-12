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
 * Lleva la vista hasta las apariciones más próximas de `word` en el editor y las
 * resalta un par de segundos (para "ubicar" un eco). No modifica el texto.
 */
export function locateWord(editor: Editor, word: string) {
  // Sin escapado: las palabras del análisis son solo letras (\p{L}+).
  const re = new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'giu')
  const ranges: [number, number][] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(node.text))) {
      ranges.push([pos + m.index, pos + m.index + m[0].length])
    }
  })
  if (ranges.length === 0) return

  // Un "eco" son dos apariciones cercanas: elegimos el par más próximo.
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

  // Resalta (decoración) y desplaza la vista hasta la primera aparición.
  editor.view.dispatch(editor.view.state.tr.setMeta(locateKey, pick))
  editor.chain().setTextSelection(pick[0][0]).scrollIntoView().run()

  if (clearTimer) window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => {
    if (editor.isDestroyed) return
    editor.view.dispatch(editor.view.state.tr.setMeta(locateKey, 'clear'))
  }, FLASH_MS)
}
