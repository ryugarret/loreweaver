import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { makeMentionSuggestion } from './mentionSuggestion'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Minus,
  Undo2,
  Redo2,
  Check,
  Loader2,
  History,
  Sparkles,
  MessageSquare,
  Pilcrow,
  IndentIncrease,
  IndentDecrease,
} from 'lucide-react'
import { db, type Chapter } from '@/lib/db'
import {
  touchProject,
  logWords,
  maybeAutoVersion,
  ensureChapterBaseline,
} from '@/lib/repo'
import { ChapterHistory } from './ChapterHistory'
import { StyleAnalysis } from './StyleAnalysis'
import { LocateHighlight, locateWord, locatePhrase } from './locateHighlight'
import { ManuscriptFormat } from './manuscriptFormat'
import { setActiveEditorFlush } from '@/lib/editorFlush'
import { cn, countWords, now } from '@/lib/utils'
import { CHAPTER_STATUS } from '@/lib/constants'
import { useUi } from '@/store/ui'

/**
 * ¿El párrafo actual MUESTRA sangría de primera línea? Tiene en cuenta el estado
 * explícito ('on'/'off') y, si es por defecto (null), la convención de libro: el
 * primer párrafo va a ras y el resto sangrado. Así el botón "alterna lo que ves".
 */
function paragraphIndented(editor: Editor): boolean {
  const s = editor.getAttributes('paragraph').sangria
  if (s === 'on') return true
  if (s === 'off') return false
  try {
    const { $from } = editor.state.selection
    const myPos = $from.before(1)
    let firstPara = -1
    editor.state.doc.forEach((node, offset) => {
      if (firstPara === -1 && node.type.name === 'paragraph') firstPara = offset
    })
    return myPos !== firstPara
  } catch {
    return true
  }
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-30',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  // Forzamos re-render al cambiar la seleccion para resaltar botones activos
  const [, force] = useState(0)
  useEffect(() => {
    const update = () => force((n) => n + 1)
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  const Divider = () => <div className="mx-1 h-5 w-px bg-border" />

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card p-1 shadow-sm">
      <ToolbarButton
        title="Negrita (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Cursiva (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Tachado"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={16} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        title="Título 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Título 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Título 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={16} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        title="Cita"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Lista"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Lista numerada"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Separador"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={16} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        title="Diálogo — inserta la raya (—)"
        onClick={() => {
          const para = editor.state.selection.$from.parent
          const empty = para.type.name === 'paragraph' && para.content.size === 0
          const chain = editor.chain().focus()
          // Si el párrafo ya tiene texto, empezamos una línea nueva para el diálogo.
          if (empty) chain.insertContent('—').run()
          else chain.splitBlock().insertContent('—').run()
        }}
      >
        <MessageSquare size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Sangría de primera línea (clic para ponerla o quitarla en este párrafo)"
        disabled={!editor.isActive('paragraph')}
        active={editor.isActive('paragraph') && paragraphIndented(editor)}
        onClick={() => {
          const ind = paragraphIndented(editor)
          editor
            .chain()
            .focus()
            .updateAttributes('paragraph', { sangria: ind ? 'off' : 'on' })
            .run()
        }}
      >
        <Pilcrow size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Disminuir sangría del párrafo"
        disabled={
          (editor.getAttributes(
            editor.isActive('heading') ? 'heading' : 'paragraph',
          ).indent || 0) === 0
        }
        onClick={() => {
          const type = editor.isActive('heading') ? 'heading' : 'paragraph'
          const lvl = editor.getAttributes(type).indent || 0
          editor
            .chain()
            .focus()
            .updateAttributes(type, { indent: Math.max(0, lvl - 1) })
            .run()
        }}
      >
        <IndentDecrease size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Aumentar sangría del párrafo (estilo Word)"
        onClick={() => {
          const type = editor.isActive('heading') ? 'heading' : 'paragraph'
          const lvl = editor.getAttributes(type).indent || 0
          editor
            .chain()
            .focus()
            .updateAttributes(type, { indent: Math.min(8, lvl + 1) })
            .run()
        }}
      >
        <IndentIncrease size={16} />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        title="Deshacer (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Rehacer (Ctrl+Y)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={16} />
      </ToolbarButton>
    </div>
  )
}

export function ChapterEditor({ chapter }: { chapter: Chapter }) {
  const editorFont = useUi((s) => s.editorFont)
  const [title, setTitle] = useState(chapter.title)
  const [status, setStatus] = useState(chapter.status)
  const [words, setWords] = useState(chapter.wordCount)
  const [saved, setSaved] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)

  const patchData = useRef<Partial<Chapter>>({})
  const patchTimer = useRef<number | null>(null)
  const lastWords = useRef(chapter.wordCount)

  async function flushPatch() {
    if (Object.keys(patchData.current).length === 0) return
    const data = { ...patchData.current, updatedAt: now() }
    const hadContent = 'content' in patchData.current
    patchData.current = {}
    await db.chapters.update(chapter.id, data)
    await touchProject(chapter.projectId)
    setSaved(true)
    // Instantánea automática del historial (throttled dentro de maybeAutoVersion).
    if (hadContent) {
      const fresh = await db.chapters.get(chapter.id)
      if (fresh) void maybeAutoVersion(fresh)
    }
  }

  function patch(part: Partial<Chapter>, immediate = false) {
    patchData.current = { ...patchData.current, ...part }
    setSaved(false)
    if (patchTimer.current) window.clearTimeout(patchTimer.current)
    if (immediate) void flushPatch()
    else patchTimer.current = window.setTimeout(() => void flushPatch(), 500)
  }

  const editor = useEditor({
    autofocus: 'end',
    extensions: [
      StarterKit,
      ManuscriptFormat,
      LocateHighlight,
      Placeholder.configure({
        placeholder: 'Había una vez… empieza a escribir tu historia aquí.',
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: makeMentionSuggestion(chapter.projectId),
      }),
    ],
    content: chapter.content || '<p></p>',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const wc = countWords(html)
      setWords(wc)
      const delta = wc - lastWords.current
      lastWords.current = wc
      if (delta > 0) void logWords(delta)
      patch({ content: html, wordCount: wc })
    },
    editorProps: {
      attributes: {
        // Corrector ortográfico nativo del navegador (subrayado rojo), en todos
        // los idiomas que tenga el dispositivo. Sin diccionarios que inflen la app.
        spellcheck: 'true',
        class: cn(
          'tiptap min-h-[55vh] max-w-none leading-[1.85]',
          editorFont === 'serif'
            ? 'font-serif text-[1.13rem]'
            : 'font-sans text-[1.02rem]',
        ),
      },
    },
  })

  // Guardar lo pendiente al desmontar (cambio de capítulo)
  useEffect(() => {
    return () => {
      if (patchTimer.current) window.clearTimeout(patchTimer.current)
      void flushPatch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Registrar el flush (para exportar lo último) y guardar lo pendiente si se
  // cierra/oculta la pestaña (no solo al desmontar React).
  useEffect(() => {
    const flush = () => void flushPatch()
    setActiveEditorFlush(flushPatch)
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      setActiveEditorFlush(null)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Línea base del historial: guarda el estado actual la primera vez que se abre
  // el capítulo (idempotente y a prueba de StrictMode, ver repo).
  useEffect(() => {
    void ensureChapterBaseline(chapter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id])

  // Al restaurar una versión del historial: recargar el editor con ese texto
  // (cambio externo explícito; no interfiere con la escritura normal).
  function handleRestored(content: string, wordCount: number) {
    if (!editor) return
    editor.commands.setContent(content || '<p></p>', { emitUpdate: false })
    setWords(wordCount)
    lastWords.current = wordCount
    setSaved(true)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-6">
      {/* Cabecera del capítulo */}
      <div className="flex items-center gap-3 pt-8">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            patch({ title: e.target.value })
          }}
          placeholder="Título del capítulo"
          className="min-w-0 flex-1 bg-transparent font-serif text-3xl font-semibold outline-none placeholder:text-muted-foreground/50"
        />
        <select
          value={status}
          onChange={(e) => {
            const v = e.target.value as Chapter['status']
            setStatus(v)
            patch({ status: v }, true)
          }}
          className="h-8 shrink-0 cursor-pointer rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground outline-none"
        >
          {CHAPTER_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{words.toLocaleString('es-ES')} palabras</span>
        <span className="flex items-center gap-1">
          {saved ? (
            <>
              <Check size={13} /> Guardado
            </>
          ) : (
            <>
              <Loader2 size={13} className="animate-spin" /> Guardando…
            </>
          )}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => {
              void flushPatch()
              setStyleOpen(true)
            }}
            title="Estilo: repeticiones y vocabulario"
            className="flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-muted hover:text-foreground"
          >
            <Sparkles size={13} /> Estilo
          </button>
          <button
            onClick={() => {
              void flushPatch() // que el diff "vs actual" use lo último escrito
              setHistoryOpen(true)
            }}
            title="Historial de versiones"
            className="flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-muted hover:text-foreground"
          >
            <History size={13} /> Historial
          </button>
        </div>
      </div>

      {/* Barra de herramientas (sticky) */}
      <div className="sticky top-0 z-10 -mx-6 mt-4 bg-background/80 px-6 py-2 backdrop-blur">
        {editor && <Toolbar editor={editor} />}
      </div>

      {/* Lienzo de escritura */}
      <div className="flex-1 cursor-text pb-40 pt-6" onClick={() => editor?.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>

      {historyOpen && (
        <ChapterHistory
          chapter={chapter}
          onClose={() => setHistoryOpen(false)}
          onRestored={handleRestored}
        />
      )}

      {styleOpen && editor && (
        <StyleAnalysis
          content={editor.getHTML()}
          onClose={() => setStyleOpen(false)}
          onLocate={(query, kind) => {
            // Cerramos el panel (tapa el texto) y saltamos a la palabra/frase.
            setStyleOpen(false)
            if (kind === 'phrase') locatePhrase(editor, query)
            else locateWord(editor, query)
          }}
        />
      )}
    </div>
  )
}
