import { describe, expect, it } from 'vitest'
import { problem } from './diagnostics/problem.js'
import {
  INITIAL_STORE_STATUS,
  STORE_STATUS_EVENT,
  asksBeforeLeaving,
  reduceStoreStatus,
  showsStoreNotice,
  storeProblemsOf,
  toStoreStatusEvent,
} from './storeStatus.js'

const writeFailed = [problem('STORE_WRITE_FAILED')]
const failed = (id) => ({ type: STORE_STATUS_EVENT.saveFailed, id, problems: writeFailed })
const succeeded = (id) => ({ type: STORE_STATUS_EVENT.saveSucceeded, id })
const run = (...events) => events.reduce(reduceStoreStatus, INITIAL_STORE_STATUS)

describe('reduceStoreStatus', () => {
  it('lists nothing before any save', () => {
    expect(storeProblemsOf(INITIAL_STORE_STATUS, 'p1')).toEqual([])
  })

  it('lists the problems of a failed save', () => {
    expect(storeProblemsOf(run(failed('p1')), 'p1')).toEqual(writeFailed)
  })

  it('clears them when a save of the same project works', () => {
    expect(run(failed('p1'), succeeded('p1'))).toEqual(INITIAL_STORE_STATUS)
  })

  it('keeps the failure of each project until that project saves', () => {
    const state = run(failed('p1'), failed('p2'), succeeded('p2'))
    expect(storeProblemsOf(state, 'p1')).toEqual(writeFailed)
    expect(storeProblemsOf(state, 'p2')).toEqual([])
  })

  it('keeps them when a save of another project works', () => {
    expect(storeProblemsOf(run(failed('p1'), succeeded('p2')), 'p1')).toEqual(writeFailed)
  })

  it('keeps them through a second failure until a save works', () => {
    expect(storeProblemsOf(run(failed('p1'), failed('p1')), 'p1')).toEqual(writeFailed)
    expect(storeProblemsOf(run(failed('p1'), failed('p1'), succeeded('p1')), 'p1')).toEqual([])
  })

  it('shows them only with the project whose save failed open', () => {
    expect(storeProblemsOf(run(failed('p1')), 'p2')).toEqual([])
  })

  it('ignores an event it does not know', () => {
    const state = run(failed('p1'))
    expect(reduceStoreStatus(state, { type: 'other' })).toBe(state)
  })
})

describe('toStoreStatusEvent', () => {
  it('turns a save result into its event', () => {
    expect(toStoreStatusEvent('p1', { ok: true, problems: [] })).toEqual(succeeded('p1'))
    expect(toStoreStatusEvent('p1', { ok: false, problems: writeFailed })).toEqual(failed('p1'))
  })
})

describe('showsStoreNotice', () => {
  const store = (persistent, storeStatus = INITIAL_STORE_STATUS) => ({ persistent, storeStatus })

  it('shows on every page while the browser keeps nothing', () => {
    expect(showsStoreNotice(store(false), null)).toBe(true)
    expect(showsStoreNotice(store(false), 'p1')).toBe(true)
  })

  it('shows with a project open whose last save failed, until a save works', () => {
    expect(showsStoreNotice(store(true, run(failed('p1'))), 'p1')).toBe(true)
    expect(showsStoreNotice(store(true, run(failed('p1'), succeeded('p1'))), 'p1')).toBe(false)
  })

  it('does not show for another project, or on a page with no map, while the browser saves', () => {
    expect(showsStoreNotice(store(true, run(failed('p2'))), 'p1')).toBe(false)
    expect(showsStoreNotice(store(true, run(failed('p2'))), null)).toBe(false)
    expect(showsStoreNotice(store(true), 'p1')).toBe(false)
  })
})

describe('asksBeforeLeaving', () => {
  it('asks only while the open project has a change that is not stored', () => {
    expect(asksBeforeLeaving(run(failed('p1')), 'p1')).toBe(true)
    expect(asksBeforeLeaving(run(failed('p1'), succeeded('p1')), 'p1')).toBe(false)
    expect(asksBeforeLeaving(run(failed('p2')), 'p1')).toBe(false)
    expect(asksBeforeLeaving(INITIAL_STORE_STATUS, 'p1')).toBe(false)
  })
})
