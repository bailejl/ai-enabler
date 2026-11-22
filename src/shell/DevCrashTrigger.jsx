import { useEffect, useState } from 'react'
import {
  CRASH_KIND,
  DEV_CRASH_EVENT,
  DEV_CRASH_READY_ATTRIBUTE,
  parseCrashKind,
} from './devCrash.js'

// Dev only: forces a crash of the kind named by the dev crash event's `detail`.
export default function DevCrashTrigger() {
  const [isRenderCrashing, setIsRenderCrashing] = useState(false)

  useEffect(() => {
    const onCrashEvent = (event) => {
      const kind = parseCrashKind(event.detail)
      if (kind === CRASH_KIND.render) setIsRenderCrashing(true)
      if (kind === CRASH_KIND.error) {
        setTimeout(() => {
          throw new Error('Forced uncaught error')
        })
      }
      if (kind === CRASH_KIND.rejection) Promise.reject('Forced unhandled rejection')
    }
    window.addEventListener(DEV_CRASH_EVENT, onCrashEvent)
    // e2e tests wait for this before dispatching, so the event cannot arrive before the listener.
    document.documentElement.setAttribute(DEV_CRASH_READY_ATTRIBUTE, '')
    return () => {
      window.removeEventListener(DEV_CRASH_EVENT, onCrashEvent)
      document.documentElement.removeAttribute(DEV_CRASH_READY_ATTRIBUTE)
    }
  }, [])

  if (isRenderCrashing) throw new Error('Forced render crash')
  return null
}
