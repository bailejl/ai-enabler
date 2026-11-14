import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'

// Clearing first, then setting on the next task, makes a repeated identical message re-announce.
// flushSync paints the clear even outside a React event (e.g. after an awaited file read), where
// React would otherwise batch it with the later set and the unchanged text would not be re-spoken.
export const useAnnouncer = () => {
  const [message, setMessage] = useState('')
  const announce = useCallback((text) => {
    flushSync(() => setMessage(''))
    setTimeout(() => setMessage(text), 0)
  }, [])
  return { message, announce }
}
