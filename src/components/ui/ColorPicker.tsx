import { Pipette } from 'lucide-react'
import { PALETTE, cn } from '@/lib/utils'

/**
 * Selector de color: muestra una paleta de colores predefinidos + un botón
 * "personalizado" con selector hexadecimal nativo (rueda de color del sistema,
 * incluye campo hex) para elegir cualquier color.
 */
export function ColorPicker({
  value,
  onChange,
  colors = PALETTE,
  swatchClass = 'h-8 w-8',
  ringOffset = 'ring-offset-card',
}: {
  value: string
  onChange: (color: string) => void
  colors?: string[]
  swatchClass?: string
  ringOffset?: string
}) {
  const isCustom = !colors.includes(value)
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#8b5cf6'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          aria-pressed={value === c}
          title={c}
          className={cn(
            'rounded-full transition',
            swatchClass,
            value === c
              ? `ring-2 ring-foreground ring-offset-2 ${ringOffset}`
              : 'hover:scale-110',
          )}
          style={{ backgroundColor: c }}
        />
      ))}

      <label
        title="Color personalizado (hex)"
        className={cn(
          'relative flex cursor-pointer items-center justify-center rounded-full transition hover:scale-110',
          swatchClass,
          isCustom ? `ring-2 ring-foreground ring-offset-2 ${ringOffset}` : '',
        )}
        style={
          isCustom
            ? { backgroundColor: value }
            : {
                background:
                  'conic-gradient(from 0deg, #f43f5e, #f59e0b, #10b981, #0ea5e9, #8b5cf6, #ec4899, #f43f5e)',
              }
        }
      >
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Color personalizado"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Pipette size={12} className="text-white drop-shadow" />
      </label>
    </div>
  )
}
