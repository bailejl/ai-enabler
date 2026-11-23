import { describe, expect, it } from 'vitest'
import {
  DIALOG,
  HOME_EVENT,
  INITIAL_HOME_STATE,
  LIST_STATUS,
  isEmptyList,
  reduceHome,
} from './homeFlow.js'
import { SORT } from './projectStore.js'

const entry = (id) => ({ id, name: id.toUpperCase(), modifiedAt: '2026-11-22T10:00:00.000Z' })
const run = (...events) => events.reduce(reduceHome, INITIAL_HOME_STATE)

describe('reduceHome list', () => {
  it('starts loading, sorted by last modified, and is not empty while it loads', () => {
    expect(INITIAL_HOME_STATE.list.status).toBe(LIST_STATUS.loading)
    expect(INITIAL_HOME_STATE.sort).toBe(SORT.modified)
    expect(isEmptyList(INITIAL_HOME_STATE)).toBe(false)
  })

  it('holds the projects once loaded', () => {
    const state = run({ type: HOME_EVENT.listLoaded, projects: [entry('a')] })
    expect(state.list).toEqual({ status: LIST_STATUS.ready, projects: [entry('a')], problems: [] })
    expect(isEmptyList(state)).toBe(false)
  })

  it('keeps the problems of a list that could not be read', () => {
    const problems = [{ code: 'STORE_UNAVAILABLE' }]
    const state = run({ type: HOME_EVENT.listLoaded, projects: [], problems })
    expect(state.list.problems).toEqual(problems)
  })

  it('is empty once a list with no projects arrives', () => {
    expect(isEmptyList(run({ type: HOME_EVENT.listLoaded, projects: [] }))).toBe(true)
  })

  it('keeps the cards shown when the sort changes, until the new list arrives', () => {
    const state = run(
      { type: HOME_EVENT.listLoaded, projects: [entry('a')] },
      { type: HOME_EVENT.sortChanged, sort: SORT.name },
    )
    expect(state.sort).toBe(SORT.name)
    expect(state.list.projects).toEqual([entry('a')])
  })

  it('ignores an event it does not know', () => {
    expect(reduceHome(INITIAL_HOME_STATE, { type: 'other' })).toBe(INITIAL_HOME_STATE)
  })
})

describe('reduceHome create dialog', () => {
  const refused = [{ code: 'FILE_PROJECT_NAME_EMPTY' }]

  it('opens with no problems', () => {
    expect(run({ type: HOME_EVENT.createOpened }).dialog).toEqual({
      type: DIALOG.create,
      problems: [],
    })
  })

  it('stays open with the problems of a refused create', () => {
    const state = run(
      { type: HOME_EVENT.createOpened },
      { type: HOME_EVENT.createRefused, problems: refused },
    )
    expect(state.dialog).toEqual({ type: DIALOG.create, problems: refused })
  })

  it('closes on cancel', () => {
    expect(
      run({ type: HOME_EVENT.createOpened }, { type: HOME_EVENT.createCancelled }).dialog,
    ).toBeNull()
  })

  it('ignores a refusal that arrives after the dialog closed', () => {
    const state = run(
      { type: HOME_EVENT.createOpened },
      { type: HOME_EVENT.createCancelled },
      { type: HOME_EVENT.createRefused, problems: refused },
    )
    expect(state.dialog).toBeNull()
  })
})
