import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { createProjectLibrary, observeLibrary } from '../flow/projectLibrary.js'
import { createProjectStore } from '../flow/projectStore.js'
import {
  INITIAL_STORE_STATUS,
  STORE_STATUS_EVENT,
  reduceStoreStatus,
  toStoreStatusEvent,
  trackStoredWrites,
} from '../flow/storeStatus.js'
import { report } from './diagnostics.js'
import { openStoreAdapter, requestDurableStorage } from './storeAdapter.js'

export const STORE_STATUS = Object.freeze({ opening: 'opening', ready: 'ready' })

const OPENING = Object.freeze({ status: STORE_STATUS.opening, library: null, persistent: true })

const StoreContext = createContext({
  ...OPENING,
  storeStatus: INITIAL_STORE_STATUS,
  saveProject: async () => ({ ok: true, problems: [] }),
})

// The library the app uses: each failed call reports its problems once, where the call is made,
// and the first save that works asks for durable storage, once.
const reportingLibrary = (library) =>
  observeLibrary(library, {
    onProblems: (problems) => problems.forEach(report),
    onFirstSave: () => requestDurableStorage(),
  })

// Opened once per page, so React StrictMode's second mount neither opens the database again nor
// reports STORE_UNAVAILABLE twice.
const ready = { promise: null }
const openStoreOnce = () => {
  ready.promise ??= openStoreAdapter().then(({ adapter, persistent, problems }) => {
    problems.forEach(report)
    return {
      status: STORE_STATUS.ready,
      library: reportingLibrary(createProjectLibrary(createProjectStore(adapter))),
      persistent,
    }
  })
  return ready.promise
}

/**
 * The browser project store for the app: `{ status, library, persistent, storeStatus,
 * saveProject }`. `saveProject(memoryProject)` saves through the library and keeps
 * `storeStatus` (see storeStatus.js); it resolves to the save's result and never rejects.
 */
export function StoreProvider({ children }) {
  const [store, setStore] = useState(OPENING)
  const [storeStatus, dispatchStoreStatus] = useReducer(reduceStoreStatus, INITIAL_STORE_STATUS)
  useEffect(() => {
    const live = { current: true }
    openStoreOnce().then((opened) => {
      if (live.current) setStore(opened)
    })
    return () => {
      live.current = false
    }
  }, [])
  // Every write that works clears that project's failed save, whichever page made it.
  const library = useMemo(
    () =>
      store.library &&
      trackStoredWrites(store.library, (id) =>
        dispatchStoreStatus({ type: STORE_STATUS_EVENT.saveSucceeded, id }),
      ),
    [store.library],
  )
  const saveProject = useCallback(
    async (memoryProject) => {
      const saved = await library.save(memoryProject)
      dispatchStoreStatus(toStoreStatusEvent(memoryProject.project.id, saved))
      return saved
    },
    [library],
  )
  const value = useMemo(
    () => ({ ...store, library, storeStatus, saveProject }),
    [store, library, storeStatus, saveProject],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
