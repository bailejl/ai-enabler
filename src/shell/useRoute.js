import { useEffect, useState } from 'react'
import { resolveHash, rewriteTarget } from './routes.js'

// The current hash route. A non-canonical hash is rewritten in place after mount and on every
// hashchange, so a bad link on load adds no history entry, and a bad hash typed later is
// overwritten in the entry the browser just added. Render itself stays pure.
export const useRoute = () => {
  const [route, setRoute] = useState(() => resolveHash(window.location.hash).route)

  useEffect(() => {
    const sync = () => {
      const { hash } = window.location
      const target = rewriteTarget(hash)
      if (target !== null) window.history.replaceState(window.history.state, '', target)
      setRoute(resolveHash(hash).route)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return route
}
