import ProblemsPanel from './ProblemsPanel.jsx'

const IMPORT_STATUS_LABEL = 'Import status'

/**
 * An import's outcome: the outcome line, or the rejection in the shared problems panel with its
 * Dismiss button. `status` is what describeImportStatus or describeHomeImportStatus give, kept by
 * the caller until the import state changes, so the panel's heading takes focus once per
 * rejection. `dismissesText` adds Dismiss to the outcome line too. Not a live region: the
 * Announcer speaks every outcome, this only keeps it visible.
 * @param {{ status: object | null, onDismiss: () => void, dismissesText?: boolean }} props
 */
export default function ImportStatus({ status, onDismiss, dismissesText = false }) {
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
