export const RATE_LIMIT = 5
export const RATE_WINDOW_MS = 60_000

const isInWindow = (now) => (time) => now - time < RATE_WINDOW_MS

// Drops times that left the window, and drops codes that have no times and no dropped count
// left, so the state map does not keep codes that have aged out. A code with a dropped count
// stays, so the count reaches the next emitted record.
const prune = (state, now) =>
  Object.fromEntries(
    Object.entries(state)
      .map(([code, entry]) => [code, { ...entry, times: entry.times.filter(isInWindow(now)) }])
      .filter(([, entry]) => entry.times.length > 0 || entry.dropped > 0),
  )

const freezeState = (state) =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(state).map(([code, entry]) => [
        code,
        Object.freeze({ times: Object.freeze(entry.times), dropped: entry.dropped }),
      ]),
    ),
  )

/**
 * Decides whether a record of `code` at `now` (ms) is emitted. `state` is a frozen map of
 * code -> { times, dropped }, where `times` holds only the times of emitted records. At most
 * RATE_LIMIT records per code are emitted while `now - time < RATE_WINDOW_MS`. A dropped record
 * adds to `dropped`; the next emitted record of that code returns it as `suppressed` and resets it.
 * Pure: returns a new frozen state and never changes the one it is given.
 */
export const admit = (state, code, now) => {
  const live = prune(state, now)
  const { times = [], dropped = 0 } = live[code] ?? {}
  if (times.length >= RATE_LIMIT) {
    return {
      state: freezeState({ ...live, [code]: { times, dropped: dropped + 1 } }),
      emit: false,
      suppressed: 0,
    }
  }
  return {
    state: freezeState({ ...live, [code]: { times: [...times, now], dropped: 0 } }),
    emit: true,
    suppressed: dropped,
  }
}
