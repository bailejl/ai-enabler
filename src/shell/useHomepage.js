import { useCallback, useEffect, useRef, useState } from 'react'
import { HOME_EVENT, INITIAL_HOME_STATE, reduceHome } from '../flow/homeFlow.js'
import { STORE_STATUS, useStore } from './StoreProvider.jsx'

/**
 * Wires the homepage reducer to the library: loads the list once the store is ready and again
 * after the sort changes. A list that comes back after a newer one was asked for is dropped. Each
 * load runs once per sort, even under StrictMode's second effect run, so a failure reports once.
 */
export const useHomepage = () => {
  const { status, library } = useStore()
  const [state, setState] = useState(INITIAL_HOME_STATE)
  const latestState = useRef(state)
  const dispatch = useCallback((event) => {
    latestState.current = reduceHome(latestState.current, event)
    setState(latestState.current)
  }, [])
  const loadedSort = useRef(null)
  const latestRequest = useRef(0)
  const { sort } = state
  useEffect(() => {
    if (status !== STORE_STATUS.ready || loadedSort.current === sort) return
    loadedSort.current = sort
    latestRequest.current += 1
    const request = latestRequest.current
    library.list({ sort }).then((listed) => {
      if (request !== latestRequest.current) return
      dispatch({
        type: HOME_EVENT.listLoaded,
        projects: listed.ok ? listed.projects : [],
        problems: listed.problems,
      })
    })
  }, [status, library, sort, dispatch])
  const setSort = useCallback(
    (next) => dispatch({ type: HOME_EVENT.sortChanged, sort: next }),
    [dispatch],
  )
  return { state, setSort }
}
