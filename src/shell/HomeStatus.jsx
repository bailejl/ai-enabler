import { useMemo } from 'react'
import { toRejection } from '../flow/problemsView.js'
import ProblemsPanel from './ProblemsPanel.jsx'

const IMPORT_STATUS_LABEL = 'Import status'

/**
 * The outcome of the last homepage import, with a Dismiss button: the "Imported ..." line, or the
 * rejected file's problems. Not a live region: the Announcer speaks every outcome, this keeps it
 * visible until it is dismissed or the next import replaces it.
 */
export default function HomeStatus({ status, onDismiss }) {
  // A new view per rejection, so the panel's heading takes focus once for each.
  const rejection = useMemo(
    () => (status?.problems ? toRejection('Import', status.problems).view : null),
    [status],
  )
  if (!status) return null
  if (rejection) {
    return (
      <ProblemsPanel
        view={rejection}
        label={IMPORT_STATUS_LABEL}
        onDismiss={onDismiss}
        takesFocus
        className="import-status"
      />
    )
  }
  return (
    <section aria-label={IMPORT_STATUS_LABEL} className="import-status">
      <p className="import-status__text">{status.text}</p>
      <button type="button" className="button" onClick={onDismiss}>
        Dismiss
      </button>
    </section>
  )
}
