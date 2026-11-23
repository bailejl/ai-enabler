import { useEffect } from 'react'
import { showsStoreNotice } from '../flow/storeStatus.js'
import { useStore } from './StoreProvider.jsx'

export const STORE_NOTICE_TEXT = 'Not saved in this browser. Export to keep your work.'

// While the notice shows, closing or reloading the tab asks first: the work exists only here.
const askBeforeUnload = (event) => {
  event.preventDefault()
  // Older browsers ask only when a return value is set.
  event.returnValue = ''
}

/**
 * The lasting "Not saved in this browser" notice, on every page, while the browser keeps no
 * projects or the open project's last save failed (see `showsStoreNotice`).
 * @param {{ openId?: string | null, className?: string }} props openId is the open project's id.
 */
export default function StoreNotice({ openId = null, className = '' }) {
  const store = useStore()
  const isShown = store.status === 'ready' && showsStoreNotice(store, openId)
  useEffect(() => {
    if (!isShown) return undefined
    window.addEventListener('beforeunload', askBeforeUnload)
    return () => window.removeEventListener('beforeunload', askBeforeUnload)
  }, [isShown])
  if (!isShown) return null
  return (
    <p role="status" className={`store-notice ${className}`.trim()}>
      {STORE_NOTICE_TEXT}
    </p>
  )
}
