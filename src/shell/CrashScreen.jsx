import { useEffect, useRef } from 'react'
import { tokens, toCssCustomProperties } from './tokens.js'

const CRASH_CODE = 'APP_RENDER_FAILED'
const EXPLANATION =
  "The app hit an error and can't continue. Reload to start again; your unsaved map will be lost. If this keeps happening, report the code below."

// The App shell's theme variables are gone with the shell, so this screen sets its own. Inline,
// because no stylesheet rule may depend on the crashed shell.
const styles = {
  page: {
    ...toCssCustomProperties(tokens),
    boxSizing: 'border-box',
    minHeight: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    background: 'var(--page-background)',
    color: 'var(--card-text)',
    fontFamily: 'system-ui, sans-serif',
  },
  panel: {
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '32rem',
    padding: '1.5rem',
    border: '1px solid var(--card-border)',
    background: 'var(--card-background)',
    overflowWrap: 'anywhere',
  },
  button: {
    padding: '0.5rem 1rem',
    border: 'none',
    background: 'var(--header-background)',
    color: 'var(--header-text)',
    font: 'inherit',
    cursor: 'pointer',
  },
}

function CrashScreen() {
  const headingRef = useRef(null)

  useEffect(() => {
    headingRef.current.focus()
  }, [])

  return (
    <main style={styles.page}>
      <div style={styles.panel}>
        <h1 ref={headingRef} tabIndex={-1}>
          Something went wrong
        </h1>
        <p>{EXPLANATION}</p>
        <p>
          Error code: <code>{CRASH_CODE}</code>
        </p>
        <button type="button" style={styles.button} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </main>
  )
}

export default CrashScreen
