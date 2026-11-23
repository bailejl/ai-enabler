import { useCallback, useEffect, useRef, useState } from 'react'
import { addRouteGuard } from './useRoute.js'

/**
 * Asks before the open project's page is left inside the app while `shouldAsk()` is true: by a
 * link that calls `guardLink` (the header's home link) or by a hash change such as the browser's
 * Back. A hash change is held through the router's route guard, so the page stays, and the
 * address is put back while the question is open. `leave` then goes where the user was going; `stay`
 * keeps the page.
 * @param {{ shouldAsk: () => boolean }} options
 * @returns {{ pendingTarget: string | null, guardLink: (event: Event) => void, leave: () => void,
 *   stay: () => void }}
 */
export const useLeaveGuard = ({ shouldAsk }) => {
  const [pendingTarget, setPendingTarget] = useState(null)
  // Set just before `leave` moves on, so its own hash change goes through.
  const isLeaving = useRef(false)

  useEffect(
    () =>
      addRouteGuard((event) => {
        if (isLeaving.current || !shouldAsk()) return false
        window.history.replaceState(window.history.state, '', event.oldURL)
        setPendingTarget(new URL(event.newURL).hash || '#/')
        return true
      }),
    [shouldAsk],
  )

  const guardLink = useCallback(
    (event) => {
      if (!shouldAsk()) return
      event.preventDefault()
      setPendingTarget(new URL(event.currentTarget.href).hash || '#/')
    },
    [shouldAsk],
  )
  const leave = useCallback(() => {
    isLeaving.current = true
    setPendingTarget(null)
    window.location.hash = pendingTarget
  }, [pendingTarget])
  const stay = useCallback(() => setPendingTarget(null), [])

  return { pendingTarget, guardLink, leave, stay }
}
