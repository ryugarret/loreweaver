import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Tras un despliegue nuevo, una pestaña vieja puede pedir un chunk con hash
// obsoleto (404) al navegar a una página lazy → recarga una vez para coger los
// assets actuales (clásico en PWAs con code-splitting; evita la "página rota").
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('lw-chunk-reload')) return
  sessionStorage.setItem('lw-chunk-reload', '1')
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
