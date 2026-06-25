import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'ghost' | 'outline' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'iconSm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground hover:opacity-90 shadow-sm',
  ghost: 'text-foreground hover:bg-muted',
  outline: 'border border-border text-foreground hover:bg-muted',
  subtle: 'bg-muted text-foreground hover:brightness-95 dark:hover:brightness-110',
  danger: 'bg-danger text-white hover:opacity-90',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 rounded-lg px-3 text-sm gap-1.5',
  md: 'h-10 rounded-lg px-4 text-sm gap-2',
  lg: 'h-12 rounded-xl px-6 text-base gap-2',
  icon: 'h-9 w-9 rounded-lg',
  iconSm: 'h-7 w-7 rounded-md',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        'cursor-pointer active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
