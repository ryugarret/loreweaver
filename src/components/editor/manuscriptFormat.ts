import { Extension } from '@tiptap/core'

/** em que avanza cada nivel de sangría de párrafo entero. */
const BLOCK_STEP = 1.5

/**
 * Formato de manuscrito para párrafos (y nivel de sangría también en títulos):
 *
 * - `sangria` (primera línea, estilo libro): ON por defecto. Se QUITA por párrafo
 *   con la clase `no-sangria`. Es el botón tipo "negrita" (activar/desactivar).
 *   Usar una clase (y no un estilo en línea) evita "hornear" estilos en cada
 *   párrafo: el valor por defecto no renderiza nada y el contenido se mantiene
 *   limpio; el CSS (`.tiptap p` / el manuscrito exportado) pone la sangría.
 * - `indent` (párrafo entero, estilo Word): nivel 0–8 que desplaza el bloque a la
 *   derecha con `margin-left`. Son los botones de aumentar/disminuir sangría. Va
 *   como estilo en línea, así que se conserva al guardar y al exportar.
 */
export const ManuscriptFormat = Extension.create({
  name: 'manuscriptFormat',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          // Sangría de primera línea. Estado triple para poder respetar la
          // convención (1er párrafo a ras) Y dejar forzarla/quitarla por párrafo:
          //   null  = por defecto (lo decide el CSS: a ras el 1º, sangrado el resto)
          //   'on'  = forzar sangría (p. ej. sangrar también el primer párrafo)
          //   'off' = forzar sin sangría
          // Va por CLASE (no estilo en línea) para no "hornear" estilos: el valor
          // por defecto no renderiza nada y el contenido se mantiene limpio.
          sangria: {
            default: null,
            parseHTML: (el) => {
              const cl = (el as HTMLElement).classList
              if (cl.contains('sangria-on')) return 'on'
              if (cl.contains('no-sangria')) return 'off'
              return null
            },
            renderHTML: (attrs) => {
              if (attrs.sangria === 'on') return { class: 'sangria-on' }
              if (attrs.sangria === 'off') return { class: 'no-sangria' }
              return {}
            },
          },
        },
      },
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = (el as HTMLElement).style?.marginLeft
              if (!ml) return 0
              const n = Math.round(parseFloat(ml) / BLOCK_STEP)
              return Number.isFinite(n) ? Math.max(0, Math.min(8, n)) : 0
            },
            renderHTML: (attrs) =>
              attrs.indent
                ? { style: `margin-left: ${attrs.indent * BLOCK_STEP}em` }
                : {},
          },
        },
      },
    ]
  },
})
