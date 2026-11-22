// The dev-only crash event. `main.jsx` listens for it only in dev, so e2e tests can force each kind
// of crash on a loaded map. It is dispatched with `new CustomEvent(DEV_CRASH_EVENT, { detail })`.

export const DEV_CRASH_EVENT = 'aie-dev-crash'

const CRASH_KINDS = Object.freeze(['render', 'error', 'rejection'])

/** The crash kind named by an event's `detail`: `render`, `error` or `rejection`, else `null`. */
export const crashKind = (detail) => (CRASH_KINDS.includes(detail) ? detail : null)
