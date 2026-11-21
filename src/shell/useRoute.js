import { useEffect, useState } from 'react'
import { syncHash } from './routes.js'

// The current hash route. A non-canonical hash is rewritten in place on load and on every
// hashchange, so a bad link never adds a history entry.
export const useRoute = () => {
  const [route, setRoute] = useState(() => syncHash(window))

  useEffect(() => {
    const onHashChange = () => setRoute(syncHash(window))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}
