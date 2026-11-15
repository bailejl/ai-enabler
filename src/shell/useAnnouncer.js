import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

// Clearing first, then setting on the next task, makes a repeated identical message re-announce.
// flushSync paints the clear even outside a React event (e.g. after an awaited file read), where
// React would otherwise batch it with the later set and the unchanged text would not be re-spoken.
export const useAnnouncer = () => {
  const [message, setMessage] = useState('')
  const pendingTimer = useRef(null)
  useEffect(() => () => clearTimeout(pendingTimer.current), [])
  const announce = useCallback((text) => {
    flushSync(() => setMessage(''))
    clearTimeout(pendingTimer.current)
    pendingTimer.current = setTimeout(() => setMessage(text), 0)
  }, [])
  return { message, announce }
}
