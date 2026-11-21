import { useEffect, useRef } from 'react'
import { describeImportStatus } from '../flow/importFlow.js'

// Not a live region: the Announcer speaks every outcome, this only keeps it visible. A rejection
// takes focus on its heading, each time one is shown, so the list is read where the user lands.
export default function ImportStatus({ state, onDismiss }) {
  const headingRef = useRef(null)
  const status = describeImportStatus(state)
  const isRejected = status?.isError === true

  useEffect(() => {
    if (isRejected) headingRef.current?.focus()
  }, [isRejected, state])

  if (!status) return null

  if (!isRejected) {
    return (
      <section aria-label="Import status" className="import-status">
        <p className="import-status__text">{status.text}</p>
      </section>
    )
  }

  return (
    <section aria-label="Import status" className="import-status import-status--error">
      <div className="import-status__body">
        <h2 ref={headingRef} tabIndex={-1} className="import-status__heading">
          {status.text}
        </h2>
        <ul className="import-status__list">
          {status.items.map((message, index) => (
            // Messages can repeat, so the position is the identity; the list never reorders.
            <li key={index}>{message}</li>
          ))}
        </ul>
        {status.more && <p className="import-status__more">{status.more}</p>}
      </div>
      <button type="button" className="button" onClick={onDismiss}>
        Dismiss
      </button>
    </section>
  )
}
