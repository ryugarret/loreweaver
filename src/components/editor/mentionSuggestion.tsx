import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { db, type WikiEntry } from '@/lib/db'
import { WikiAvatar } from '@/components/wiki/WikiAvatar'
import { wikiMeta } from '@/components/wikiMeta'
import { cn } from '@/lib/utils'

interface ListRef {
  onKeyDown: (p: { event: KeyboardEvent }) => boolean
}
interface ListProps {
  items: WikiEntry[]
  command: (item: { id: string; label: string }) => void
}

const MentionList = forwardRef<ListRef, ListProps>((props, ref) => {
  const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [props.items])

  function pick(i: number) {
    const item = props.items[i]
    if (item) props.command({ id: item.id, label: item.name })
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!props.items.length) return false
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        pick(selected)
        return true
      }
      return false
    },
  }))

  if (!props.items.length) {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-xl">
        Sin fichas. Crea personajes o lugares en la Wiki.
      </div>
    )
  }

  return (
    <div className="max-h-64 w-64 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">
      {props.items.map((e, i) => {
        const meta = wikiMeta(e.type)
        return (
          <button
            key={e.id}
            onMouseEnter={() => setSelected(i)}
            onClick={() => pick(i)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
              i === selected ? 'bg-accent/12' : 'hover:bg-muted',
            )}
          >
            <WikiAvatar
              entry={e}
              className="h-7 w-7 shrink-0 overflow-hidden rounded-md text-[10px]"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{e.name}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {meta.icon(10)} {meta.label}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
})
MentionList.displayName = 'MentionList'

export function makeMentionSuggestion(
  projectId: string,
): Omit<SuggestionOptions, 'editor'> {
  return {
    items: async ({ query }: { query: string }) => {
      const all = await db.wiki.where('projectId').equals(projectId).toArray()
      const q = query.toLowerCase()
      return all
        .filter((e) => e.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .slice(0, 8)
    },
    render: () => {
      let component: ReactRenderer<ListRef, ListProps> | null = null
      let el: HTMLDivElement | null = null

      function position(clientRect?: (() => DOMRect | null) | null) {
        if (!el || !clientRect) return
        const rect = clientRect()
        if (!rect) return
        el.style.left = `${rect.left}px`
        el.style.top = `${rect.bottom + 6}px`
      }

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionList, {
            props: {
              items: props.items as WikiEntry[],
              command: props.command,
            },
            editor: props.editor,
          })
          el = document.createElement('div')
          el.style.position = 'fixed'
          el.style.zIndex = '60'
          el.appendChild(component.element)
          document.body.appendChild(el)
          position(props.clientRect)
        },
        onUpdate: (props: SuggestionProps) => {
          component?.updateProps({
            items: props.items as WikiEntry[],
            command: props.command,
          })
          position(props.clientRect)
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            el?.remove()
            el = null
            return true
          }
          return component?.ref?.onKeyDown({ event: props.event }) ?? false
        },
        onExit: () => {
          el?.remove()
          el = null
          component?.destroy()
          component = null
        },
      }
    },
  }
}
