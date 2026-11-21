import { useEffect, useState } from 'react'
import { resolveHash, syncHash } from './routes.js'

// The current hash route. A non-canonical hash is rewritten in place after mount and on every
// hashchange, so a bad link on load adds no history entry, and a bad hash typed later is
// overwritten in the entry the browser just added. Render itself stays pure.
export const useRoute = () => {
  const [route, setRoute] = useState(() => resolveHash(window.location.hash).route)

  useEffect(() => {
    const sync = () => setRoute(syncHash(window))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return route
}
