import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import DevCrashTrigger from './shell/DevCrashTrigger.jsx'
import ErrorBoundary from './shell/ErrorBoundary.jsx'
import { APP_RENDER_FAILED, APP_UNCAUGHT_ERROR } from './shell/crashCodes.js'
import { reportError } from './shell/diagnostics.js'
import { installGlobalHandlers } from './shell/globalHandlers.js'
import './index.css'

installGlobalHandlers(window, reportError)

// React writes no console output of its own: the boundary reports a caught render error;
// onUncaughtError reports one that escapes it, and onRecoverableError one React recovered from.
createRoot(document.getElementById('root'), {
  onCaughtError: () => {},
  onUncaughtError: (error) => reportError(APP_RENDER_FAILED, error),
  onRecoverableError: (error) => reportError(APP_UNCAUGHT_ERROR, error),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      {import.meta.env.DEV && <DevCrashTrigger />}
    </ErrorBoundary>
  </StrictMode>,
)
