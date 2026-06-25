import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KeyProfile } from '@/lib/keyboard'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface AccentPreset {
  id: string
  name: string
  color: string
}

export const ACCENTS: AccentPreset[] = [
  { id: 'violet', name: 'Violeta', color: '#8b5cf6' },
  { id: 'indigo', name: 'Índigo', color: '#6366f1' },
  { id: 'sky', name: 'Cielo', color: '#0ea5e9' },
  { id: 'emerald', name: 'Esmeralda', color: '#10b981' },
  { id: 'amber', name: 'Ámbar', color: '#f59e0b' },
  { id: 'rose', name: 'Rosa', color: '#f43f5e' },
]

export function accentColor(id: string): string {
  // `accentId` puede ser el id de un preset ('violet') o un color hex libre.
  if (id.startsWith('#')) return id
  return ACCENTS.find((a) => a.id === id)?.color ?? ACCENTS[0].color
}

interface UiState {
  theme: ThemeMode
  accentId: string
  sidebarCollapsed: boolean
  settingsOpen: boolean
  /** Tipografia del editor: serif (manuscrito) o sans */
  editorFont: 'serif' | 'sans'
  pomodoroWork: number
  pomodoroBreak: number
  /** Objetivo de palabras al día (para la racha) */
  dailyGoal: number
  /** Sonido de tecleo mecánico al escribir */
  keyboardSound: boolean
  keyboardVolume: number
  keyboardProfile: KeyProfile
  /** Volumen del reproductor de música local */
  musicVolume: number
  setTheme: (t: ThemeMode) => void
  setAccent: (id: string) => void
  toggleSidebar: () => void
  setSidebar: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setEditorFont: (f: 'serif' | 'sans') => void
  setPomodoro: (work: number, brk: number) => void
  setDailyGoal: (v: number) => void
  setKeyboardSound: (v: boolean) => void
  setKeyboardVolume: (v: number) => void
  setKeyboardProfile: (p: KeyProfile) => void
  setMusicVolume: (v: number) => void
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      accentId: 'violet',
      sidebarCollapsed: false,
      settingsOpen: false,
      editorFont: 'serif',
      pomodoroWork: 25,
      pomodoroBreak: 5,
      dailyGoal: 500,
      keyboardSound: false,
      keyboardVolume: 0.5,
      keyboardProfile: 'blue',
      musicVolume: 0.7,
      setTheme: (theme) => set({ theme }),
      setAccent: (accentId) => set({ accentId }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setEditorFont: (editorFont) => set({ editorFont }),
      setPomodoro: (pomodoroWork, pomodoroBreak) =>
        set({ pomodoroWork, pomodoroBreak }),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setKeyboardSound: (keyboardSound) => set({ keyboardSound }),
      setKeyboardVolume: (keyboardVolume) => set({ keyboardVolume }),
      setKeyboardProfile: (keyboardProfile) => set({ keyboardProfile }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
    }),
    {
      name: 'cosmia-ui',
      // Persistir SOLO los ajustes reales, no estados transitorios de UI como
      // `settingsOpen` (si no, Ajustes se reabría solo al recargar).
      partialize: (s) => ({
        theme: s.theme,
        accentId: s.accentId,
        sidebarCollapsed: s.sidebarCollapsed,
        editorFont: s.editorFont,
        pomodoroWork: s.pomodoroWork,
        pomodoroBreak: s.pomodoroBreak,
        dailyGoal: s.dailyGoal,
        keyboardSound: s.keyboardSound,
        keyboardVolume: s.keyboardVolume,
        keyboardProfile: s.keyboardProfile,
        musicVolume: s.musicVolume,
      }),
      // Al rehidratar, los modales siempre empiezan cerrados (aunque algún dato
      // antiguo tuviera settingsOpen guardado).
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<UiState>),
        settingsOpen: false,
      }),
    },
  ),
)
