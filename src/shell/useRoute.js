import { useEffect, useState } from 'react'
import { resolveHash, rewriteTarget } from './routes.js'

// Hash changes a page may hold before the route follows them (see useLeaveGuard). A guard gets
// the hashchange event and returns true to keep the current route.
const routeGuards = new Set()

/** Adds a route guard; returns the function that removes it. */
export const addRouteGuard = (guard) => {
  routeGuards.add(guard)
  return () => routeGuards.delete(guard)
}

// Runs the guards in turn until one holds the change; true when one did.
const runRouteGuards = (event) => [...routeGuards].some((guard) => guard(event))

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
    const follow = (event) => {
      if (!runRouteGuards(event)) sync()
    }
    sync()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])

  return route
}
