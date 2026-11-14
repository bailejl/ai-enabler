import { useCallback, useState } from 'react'

// Clearing first, then setting on the next task, makes a repeated identical message re-announce.
export const useAnnouncer = () => {
  const [message, setMessage] = useState('')
  const announce = useCallback((text) => {
    setMessage('')
    setTimeout(() => setMessage(text), 0)
  }, [])
  return { message, announce }
}
