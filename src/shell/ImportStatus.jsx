import { describeImportStatus } from '../flow/importFlow.js'

// Not a live region: the Announcer speaks every outcome, this only keeps it visible.
export default function ImportStatus({ state, onDismiss }) {
  const status = describeImportStatus(state)
  if (!status) return null

  return (
    <section
      aria-label="Import status"
      className={status.isError ? 'import-status import-status--error' : 'import-status'}
    >
      <p className="import-status__text">{status.text}</p>
      {status.isError && (
        <button type="button" className="import-status__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </section>
  )
}
