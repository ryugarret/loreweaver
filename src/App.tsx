import { lazy, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useUi, accentColor } from '@/store/ui'
import { applyTheme, applyAccent } from '@/lib/theme'
import { requestPersistentStorage } from '@/lib/storage'
import { initDiskSync } from '@/lib/diskSync'
import { keySound } from '@/lib/keyboard'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { ProjectLayout } from '@/pages/ProjectLayout'

// Páginas pesadas (Tiptap, React Flow…) cargadas bajo demanda → code-splitting.
const WritePage = lazy(() =>
  import('@/pages/WritePage').then((m) => ({ default: m.WritePage })),
)
const WikiPage = lazy(() =>
  import('@/pages/WikiPage').then((m) => ({ default: m.WikiPage })),
)
const TimelinePage = lazy(() =>
  import('@/pages/TimelinePage').then((m) => ({ default: m.TimelinePage })),
)
const BoardPage = lazy(() =>
  import('@/pages/BoardPage').then((m) => ({ default: m.BoardPage })),
)
const GraphPage = lazy(() =>
  import('@/pages/GraphPage').then((m) => ({ default: m.GraphPage })),
)
const StatsPage = lazy(() =>
  import('@/pages/StatsPage').then((m) => ({ default: m.StatsPage })),
)
const GuidePage = lazy(() =>
  import('@/pages/GuidePage').then((m) => ({ default: m.GuidePage })),
)
import { SettingsModal } from '@/components/SettingsModal'
import { FocusDock } from '@/components/FocusDock'
import { MentionViewer } from '@/components/MentionViewer'
import { Toaster } from '@/components/Toaster'

export default function App() {
  const theme = useUi((s) => s.theme)
  const accentId = useUi((s) => s.accentId)
  const keyboardSound = useUi((s) => s.keyboardSound)
  const keyboardVolume = useUi((s) => s.keyboardVolume)
  const keyboardProfile = useUi((s) => s.keyboardProfile)

  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(theme)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  useEffect(() => {
    applyAccent(accentColor(accentId))
  }, [accentId])

  // Pedir almacenamiento persistente + reanudar el guardado en disco real
  useEffect(() => {
    void requestPersistentStorage()
    void initDiskSync()
  }, [])

  // Sincronizar el motor de sonido de teclado con los ajustes
  useEffect(() => {
    keySound.enabled = keyboardSound
    keySound.volume = keyboardVolume
    keySound.profile = keyboardProfile
  }, [keyboardSound, keyboardVolume, keyboardProfile])

  // Reproducir click al pulsar/soltar tecla dentro de campos de texto / editor
  useEffect(() => {
    function isEditable() {
      const el = document.activeElement as HTMLElement | null
      return (
        !!el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      )
    }
    function relevant(e: KeyboardEvent) {
      return (
        e.key.length === 1 ||
        e.key === 'Enter' ||
        e.key === 'Backspace' ||
        e.key === ' '
      )
    }
    const onDown = (e: KeyboardEvent) => {
      if (!keySound.enabled || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if (isEditable() && relevant(e)) keySound.click(e.key === 'Enter' || e.key === ' ')
    }
    const onUp = (e: KeyboardEvent) => {
      if (!keySound.enabled || e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditable() && relevant(e)) keySound.release()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/p/:projectId" element={<ProjectLayout />}>
          <Route index element={<Navigate to="write" replace />} />
          <Route path="write" element={<WritePage />} />
          <Route path="write/:chapterId" element={<WritePage />} />
          <Route path="wiki" element={<WikiPage />} />
          <Route path="graph" element={<GraphPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="guide" element={<GuidePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SettingsModal />
      <FocusDock />
      <MentionViewer />
      <Toaster />
    </HashRouter>
  )
}
