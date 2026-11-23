import { useMemo } from 'react'
import ProblemsPanel from './ProblemsPanel.jsx'

const IMPORT_STATUS_LABEL = 'Import status'

/**
 * An import's outcome: the outcome line, or the rejection in the shared problems panel with its
 * Dismiss button. `describe` (describeImportStatus or describeHomeImportStatus, a stable module
 * function) turns `state` into what shows; the result keeps its identity until `state` changes,
 * so the panel's heading takes focus once per rejection. `dismissesText` adds Dismiss to the
 * outcome line too. Not a live region: the Announcer speaks every outcome, this only keeps it
 * visible.
 * @param {{ state: object | null, describe: (state: object | null) => object | null,
 *   onDismiss: () => void, dismissesText?: boolean }} props
 */
export default function ImportStatus({ state, describe, onDismiss, dismissesText = false }) {
  const status = useMemo(() => describe(state), [describe, state])
  if (!status) return null

  if (status.isError) {
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

  return (
    <section aria-label={IMPORT_STATUS_LABEL} className="import-status">
      <p className="import-status__text">{status.text}</p>
      {dismissesText && (
        <button type="button" className="button" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </section>
  )
}
