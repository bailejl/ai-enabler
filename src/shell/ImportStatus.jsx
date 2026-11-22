import { useMemo } from 'react'
import { describeImportStatus } from '../flow/importFlow.js'
import ProblemsPanel from './ProblemsPanel.jsx'

const IMPORT_STATUS_LABEL = 'Import status'

// The last outcome line, or the rejection in the shared problems panel. Not a live region: the
// Announcer speaks every outcome, this only keeps it visible.
export default function ImportStatus({ state, onDismiss }) {
  // The view keeps its identity until the import state changes, so the panel's heading takes
  // focus once per rejection and not on every unrelated render.
  const status = useMemo(() => describeImportStatus(state), [state])

  if (!status) return null

  if (!status.isError) {
    return (
      <section aria-label={IMPORT_STATUS_LABEL} className="import-status">
        <p className="import-status__text">{status.text}</p>
      </section>
    )
  }

  return (
    <ProblemsPanel
      view={status.view}
      label={IMPORT_STATUS_LABEL}
      onDismiss={onDismiss}
      takesFocus
      className="import-status"
    />
  )
}
