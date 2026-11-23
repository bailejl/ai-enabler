import { useEffect, useRef, useState } from 'react'
import { toOpenOutcome } from '../flow/projectLibrary.js'
import { STORE_STATUS, useStore } from './StoreProvider.jsx'

export const OPENING = Object.freeze({ type: 'opening' })

/**
 * The project at link `id`: `OPENING` until the store is ready and the project is read, then an
 * outcome from toOpenOutcome. The caller keys its component by `id`, so `id` never changes here.
 * The open runs once per mount, even under StrictMode's second effect run, so a problem is
 * reported once.
 */
export const useStoredProject = (id) => {
  const { status, library } = useStore()
  const [outcome, setOutcome] = useState(OPENING)
  const started = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    if (status === STORE_STATUS.ready && !started.current) {
      started.current = true
      library.open(id).then((opened) => {
        if (mounted.current) setOutcome(toOpenOutcome(opened))
      })
    }
    return () => {
      mounted.current = false
    }
  }, [status, library, id])
  return outcome
}
