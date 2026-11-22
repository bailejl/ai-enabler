// Codes errors that no component catches. Each handler calls `event.preventDefault()`, because
// otherwise Chromium prints its own uncoded "Uncaught" console error next to the record. A failure
// while reporting is dropped, and an event raised while a report is running is not reported again,
// so a throwing `reportError` cannot loop.

const UNCAUGHT_ERROR = 'APP_UNCAUGHT_ERROR'
const UNHANDLED_REJECTION = 'APP_UNHANDLED_REJECTION'

/**
 * Listens on `target` (a window) for `error` and `unhandledrejection` events and reports each with
 * `reportError(code, error)`.
 */
export const installGlobalHandlers = (target, reportError) => {
  let isReporting = false

  const handle = (code, readReason) => (event) => {
    event.preventDefault()
    if (isReporting) return
    isReporting = true
    try {
      reportError(code, readReason(event))
    } catch {
      // Nothing is left to report with; a second attempt could loop.
    } finally {
      isReporting = false
    }
  }

  target.addEventListener(
    'error',
    handle(UNCAUGHT_ERROR, (event) => event.error),
  )
  target.addEventListener(
    'unhandledrejection',
    handle(UNHANDLED_REJECTION, (event) => event.reason),
  )
}
