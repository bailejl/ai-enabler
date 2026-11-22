import { describe, expect, it } from 'vitest'
import { RATE_LIMIT, RATE_WINDOW_MS, admit } from './rateLimit.js'

const SECOND = 1000
const EMPTY = Object.freeze({})

// Feeds each time (ms) for one code through admit, returning every result and the final state.
const run = (code, times, startState = EMPTY) =>
  times.reduce(
    (acc, now) => {
      const result = admit(acc.state, code, now)
      return { state: result.state, results: [...acc.results, result] }
    },
    { state: startState, results: [] },
  )

const secondsToMs = (seconds) => seconds.map((s) => s * SECOND)
const FIRST_FIVE = secondsToMs([0, 1, 2, 3, 4])

describe('admit', () => {
  it('emits the first five records of a code in a minute', () => {
    const { results } = run('FILE_NOT_JSON', FIRST_FIVE)
    expect(results.map((r) => r.emit)).toEqual([true, true, true, true, true])
    expect(RATE_LIMIT).toBe(5)
  })

  it('drops records over the limit and counts them into the next emitted record', () => {
    const { state } = run('FILE_NOT_JSON', FIRST_FIVE)
    const { results } = run('FILE_NOT_JSON', secondsToMs([10, 20, 60]), state)
    expect(results.map((r) => r.emit)).toEqual([false, false, true])
    expect(results.map((r) => r.suppressed)).toEqual([0, 0, 2])
  })

  it('resets the suppressed count after it is carried by an emitted record', () => {
    const { state } = run('FILE_NOT_JSON', [...FIRST_FIVE, 10 * SECOND])
    const { results } = run('FILE_NOT_JSON', secondsToMs([60, 61]), state)
    expect(results.map((r) => r.suppressed)).toEqual([1, 0])
  })

  it('slides the window from each emitted record: 59.999 s is dropped, 60.000 s is emitted', () => {
    const { state } = run('FILE_NOT_JSON', FIRST_FIVE)
    expect(RATE_WINDOW_MS).toBe(60_000)
    expect(admit(state, 'FILE_NOT_JSON', 59_999).emit).toBe(false)
    expect(admit(state, 'FILE_NOT_JSON', 60_000).emit).toBe(true)
  })

  it('slides the boundary from later emitted records too, not only the first batch', () => {
    const { results, state } = run('FILE_NOT_JSON', [
      ...FIRST_FIVE,
      ...secondsToMs([60, 61, 62, 63, 64]),
    ])
    expect(results.slice(5).map((r) => r.emit)).toEqual([true, true, true, true, true])
    expect(admit(state, 'FILE_NOT_JSON', 119_999).emit).toBe(false)
    expect(admit(state, 'FILE_NOT_JSON', 120_000).emit).toBe(true)
  })

  it('does not count dropped records toward the window', () => {
    const { state } = run('FILE_NOT_JSON', [...FIRST_FIVE, 30 * SECOND, 59 * SECOND])
    expect(admit(state, 'FILE_NOT_JSON', 60 * SECOND).emit).toBe(true)
  })

  it('lets one code reach its limit without affecting another', () => {
    const { state } = run('FILE_NOT_JSON', FIRST_FIVE)
    const result = admit(state, 'STEP_ID_MISSING', 5 * SECOND)
    expect(result.emit).toBe(true)
    expect(result.suppressed).toBe(0)
  })

  it('keeps each code dropped count separate', () => {
    const first = run('FILE_NOT_JSON', [...FIRST_FIVE, 10 * SECOND])
    const second = run('STEP_ID_MISSING', FIRST_FIVE, first.state)
    const { results } = run('STEP_ID_MISSING', secondsToMs([20, 60]), second.state)
    expect(results.map((r) => [r.emit, r.suppressed])).toEqual([
      [false, 0],
      [true, 1],
    ])
    expect(admit(second.state, 'FILE_NOT_JSON', 60 * SECOND).suppressed).toBe(1)
  })

  it('forgets a code whose records have all aged out and that has nothing dropped', () => {
    const { state } = run('FILE_NOT_JSON', [0])
    const result = admit(state, 'STEP_ID_MISSING', 120 * SECOND)
    expect(Object.keys(result.state)).toEqual(['STEP_ID_MISSING'])
  })

  it('keeps a code that has a dropped count until it is carried', () => {
    const { state } = run('FILE_NOT_JSON', [...FIRST_FIVE, 10 * SECOND])
    const result = admit(state, 'STEP_ID_MISSING', 300 * SECOND)
    expect(result.state.FILE_NOT_JSON.dropped).toBe(1)
  })

  it('never changes the state it is given', () => {
    const { state } = run('FILE_NOT_JSON', FIRST_FIVE)
    const before = structuredClone(state)
    admit(state, 'FILE_NOT_JSON', 10 * SECOND)
    admit(state, 'FILE_NOT_JSON', 60 * SECOND)
    admit(state, 'STEP_ID_MISSING', 10 * SECOND)
    expect(state).toEqual(before)
  })

  it('returns a frozen state that shares no mutable entries', () => {
    const { state } = run('FILE_NOT_JSON', FIRST_FIVE)
    const next = admit(state, 'STEP_ID_MISSING', 5 * SECOND).state
    expect(Object.isFrozen(next)).toBe(true)
    expect(Object.isFrozen(next.FILE_NOT_JSON)).toBe(true)
    expect(Object.isFrozen(next.FILE_NOT_JSON.times)).toBe(true)
    expect(next.FILE_NOT_JSON).not.toBe(state.FILE_NOT_JSON)
  })
})
