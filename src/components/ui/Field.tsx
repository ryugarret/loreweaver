import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

export function Label({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-sm font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </label>
  )
}

const base =
  'w-full rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground/60 transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/25'

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, 'h-10 px-3 text-sm', className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(base, 'min-h-20 resize-y px-3 py-2 text-sm', className)}
      {...props}
    />
  )
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={cn(base, 'h-10 cursor-pointer px-3 text-sm', className)}
      {...props}
    >
      {children}
    </select>
  )
}
