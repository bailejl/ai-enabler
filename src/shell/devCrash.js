// The dev-only crash event. `main.jsx` listens for it only in dev, so e2e tests can force each kind
// of crash on a loaded map. It is dispatched with `new CustomEvent(DEV_CRASH_EVENT, { detail })`.

export const DEV_CRASH_EVENT = 'aie-dev-crash'

// Set on <html> while the listener is attached.
export const DEV_CRASH_READY_ATTRIBUTE = 'data-dev-crash-ready'

/** The kinds of crash the event can force: the event's `detail` is one of these values. */
export const CRASH_KIND = Object.freeze({
  render: 'render',
  error: 'error',
  rejection: 'rejection',
})

const CRASH_KINDS = Object.values(CRASH_KIND)

/** The crash kind named by an event's `detail`: `render`, `error` or `rejection`, else `null`. */
export const parseCrashKind = (detail) => (CRASH_KINDS.includes(detail) ? detail : null)
