export const MAX_RECORDS_PER_WINDOW = 5
export const RATE_WINDOW_MS = 60_000

const isInWindow = (now) => (time) => now - time < RATE_WINDOW_MS

// Drops times that left the window, and drops codes that have no times and no suppressed count
// left, so the state map does not keep codes that have aged out. A code with a suppressed count
// stays, so the count reaches the next emitted record.
const prune = (state, now) =>
  Object.fromEntries(
    Object.entries(state)
      .map(([code, entry]) => [code, { ...entry, times: entry.times.filter(isInWindow(now)) }])
      .filter(([, entry]) => entry.times.length > 0 || entry.suppressed > 0),
  )

const freezeState = (state) =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(state).map(([code, entry]) => [
        code,
        Object.freeze({ times: Object.freeze(entry.times), suppressed: entry.suppressed }),
      ]),
    ),
  )

/**
 * Decides whether a record of `code` at `now` (ms) is emitted. `state` is a frozen map of
 * code -> { times, suppressed }, where `times` holds only the times of emitted records. At most
 * MAX_RECORDS_PER_WINDOW records per code are emitted while `now - time < RATE_WINDOW_MS`. A
 * record that is not emitted adds to `suppressed`; the next emitted record of that code returns
 * the count as `suppressed` and resets it.
 * Pure: returns a new frozen state and never changes the one it is given.
 */
export const admit = (state, code, now) => {
  const live = prune(state, now)
  const { times = [], suppressed = 0 } = live[code] ?? {}
  if (times.length >= MAX_RECORDS_PER_WINDOW) {
    return {
      state: freezeState({ ...live, [code]: { times, suppressed: suppressed + 1 } }),
      emit: false,
      suppressed: 0,
    }
  }
  return {
    state: freezeState({ ...live, [code]: { times: [...times, now], suppressed: 0 } }),
    emit: true,
    suppressed,
  }
}
