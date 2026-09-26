import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './auth.tsx'
import './index.css'
import { unlockAudio } from './sound.ts'

// iPad: unlock sounds on first touch, and ask Safari not to evict our local DB
window.addEventListener('pointerdown', unlockAudio, { once: true })
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
