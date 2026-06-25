import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Mention from '@tiptap/extension-mention'
import { makeMentionSuggestion } from './mentionSuggestion'
import { cn } from '@/lib/utils'

/**
 * Editor de texto pequeño (una sola línea/párrafo) con @menciones de la wiki.
 * Guarda HTML. Para descripciones de evento y campos cortos.
 */
export function MentionTextEditor({
  value,
  onChange,
  projectId,
  placeholder,
  className,
}: {
  value: string
  onChange: (html: string) => void
  projectId: string
  placeholder?: string
  className?: string
}) {
  const timer = useRef<number | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        suggestion: makeMentionSuggestion(projectId),
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => onChange(html), 350)
    },
    editorProps: {
      attributes: { class: cn('mention-input', className) },
    },
  })

  return <EditorContent editor={editor} />
}
