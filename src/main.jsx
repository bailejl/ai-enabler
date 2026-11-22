import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { DEV_CRASH_EVENT, crashKind } from './shell/devCrash.js'
import './index.css'

// Dev only: forces a crash of the kind named by the dev crash event's `detail`.
function DevCrashTrigger() {
  const [isRenderCrashing, setIsRenderCrashing] = useState(false)

  useEffect(() => {
    const onCrashEvent = (event) => {
      const kind = crashKind(event.detail)
      if (kind === 'render') setIsRenderCrashing(true)
      if (kind === 'error') {
        setTimeout(() => {
          throw new Error('Forced uncaught error')
        })
      }
      if (kind === 'rejection') Promise.reject('Forced unhandled rejection')
    }
    window.addEventListener(DEV_CRASH_EVENT, onCrashEvent)
    return () => window.removeEventListener(DEV_CRASH_EVENT, onCrashEvent)
  }, [])

  if (isRenderCrashing) throw new Error('Forced render crash')
  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {import.meta.env.DEV && <DevCrashTrigger />}
  </StrictMode>,
)
