import { useEffect, useState } from 'react'
import { useUi, type ThemeMode } from '@/store/ui'

/** ¿Resuelve este modo a oscuro ahora mismo? */
export function resolvesDark(mode: ThemeMode): boolean {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return mode === 'dark' || (mode === 'system' && systemDark)
}

/** Aplica el modo claro/oscuro al <html> segun la preferencia. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', resolvesDark(mode))
}

/** Cambia el color de acento global. */
export function applyAccent(color: string): void {
  document.documentElement.style.setProperty('--accent', color)
}

/** Hook reactivo: ¿se está mostrando el modo oscuro? (tiene en cuenta "sistema") */
export function useResolvedDark(): boolean {
  const theme = useUi((s) => s.theme)
  const [dark, setDark] = useState(() => resolvesDark(theme))
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(resolvesDark(theme))
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [theme])
  return dark
}
