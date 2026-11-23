import { describe, expect, it } from 'vitest'
import {
  DIALOG,
  FOCUS,
  HOME_EVENT,
  INITIAL_HOME_STATE,
  LIST_STATUS,
  actionAnnouncement,
  focusAfterRemove,
  isEmptyList,
  isStoreRefusal,
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
    expect(isEmptyList(state)).toBe(false)
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
      { type: HOME_EVENT.nameRefused, problems: refused },
    )
    expect(state.dialog).toEqual({ type: DIALOG.create, problems: refused })
  })

  it('closes on cancel and hands focus to New project', () => {
    const state = run({ type: HOME_EVENT.createOpened }, { type: HOME_EVENT.dialogCancelled })
    expect(state.dialog).toBeNull()
    expect(state.focus).toEqual({ target: FOCUS.newProject })
  })

  it('ignores a refusal that arrives after the dialog closed', () => {
    const state = run(
      { type: HOME_EVENT.createOpened },
      { type: HOME_EVENT.dialogCancelled },
      { type: HOME_EVENT.nameRefused, problems: refused },
    )
    expect(state.dialog).toBeNull()
  })
})

describe('reduceHome card actions', () => {
  const refused = [{ code: 'FILE_PROJECT_NAME_EMPTY' }]
  const writeFailed = [{ code: 'STORE_WRITE_FAILED' }]
  const renaming = { type: HOME_EVENT.renameOpened, id: 'p1', name: 'Checkout' }

  it('opens rename with the current name', () => {
    expect(run(renaming).dialog).toEqual({
      type: DIALOG.rename,
      id: 'p1',
      name: 'Checkout',
      problems: [],
    })
  })

  it('keeps rename open with the problems of a refused name', () => {
    const state = run(renaming, { type: HOME_EVENT.nameRefused, problems: refused })
    expect(state.dialog).toEqual({
      type: DIALOG.rename,
      id: 'p1',
      name: 'Checkout',
      problems: refused,
    })
  })

  it('hands focus back to the card menu when rename or delete is cancelled', () => {
    const deleting = { type: HOME_EVENT.deleteOpened, id: 'p2', name: 'B' }
    expect(run(renaming, { type: HOME_EVENT.dialogCancelled }).focus).toEqual({
      target: FOCUS.menu,
      id: 'p1',
    })
    expect(run(deleting, { type: HOME_EVENT.dialogCancelled }).focus).toEqual({
      target: FOCUS.menu,
      id: 'p2',
    })
  })

  it('ignores a cancel with no dialog open', () => {
    expect(run({ type: HOME_EVENT.dialogCancelled })).toEqual(INITIAL_HOME_STATE)
  })

  it('closes rename and focuses the card menu once renamed', () => {
    const state = run(renaming, { type: HOME_EVENT.renamed, id: 'p1' })
    expect(state.dialog).toBeNull()
    expect(state.focus).toEqual({ target: FOCUS.menu, id: 'p1' })
  })

  it('focuses the new card after a duplicate', () => {
    expect(run({ type: HOME_EVENT.duplicated, id: 'copy' }).focus).toEqual({
      target: FOCUS.card,
      id: 'copy',
    })
  })

  it('closes delete and moves focus where it is told', () => {
    const focus = { target: FOCUS.card, id: 'c' }
    const state = run(
      { type: HOME_EVENT.deleteOpened, id: 'b', name: 'B' },
      { type: HOME_EVENT.deleted, focus },
    )
    expect(state.dialog).toBeNull()
    expect(state.focus).toEqual(focus)
  })

  it('shows the problems of a refused action until one works', () => {
    const failed = run(renaming, { type: HOME_EVENT.actionFailed, id: 'p1', problems: writeFailed })
    expect(failed.dialog).toBeNull()
    expect(failed.actionProblems).toEqual(writeFailed)
    expect(failed.focus).toEqual({ target: FOCUS.menu, id: 'p1' })
    expect(reduceHome(failed, { type: HOME_EVENT.duplicated, id: 'x' }).actionProblems).toEqual([])
  })
})

describe('focusAfterRemove', () => {
  it('moves to the next card', () => {
    expect(focusAfterRemove(['a', 'b', 'c'], 'b')).toEqual({ target: FOCUS.card, id: 'c' })
    expect(focusAfterRemove(['a', 'b', 'c'], 'a')).toEqual({ target: FOCUS.card, id: 'b' })
  })

  it('moves to the previous card after the last', () => {
    expect(focusAfterRemove(['a', 'b'], 'b')).toEqual({ target: FOCUS.card, id: 'a' })
  })

  it('moves to New project after the only card', () => {
    expect(focusAfterRemove(['a'], 'a')).toEqual({ target: FOCUS.newProject })
  })

  it('moves to the first card when the removed id is not shown', () => {
    expect(focusAfterRemove(['a', 'b'], 'z')).toEqual({ target: FOCUS.card, id: 'a' })
  })
})

describe('isStoreRefusal', () => {
  it('is true only when every problem comes from the store', () => {
    expect(isStoreRefusal([{ code: 'STORE_WRITE_FAILED' }])).toBe(true)
    expect(isStoreRefusal([{ code: 'FILE_PROJECT_NAME_EMPTY' }])).toBe(false)
    expect(
      isStoreRefusal([{ code: 'STORE_FILE_INVALID' }, { code: 'STEP_POSITION_MISSING' }]),
    ).toBe(false)
    expect(isStoreRefusal([])).toBe(false)
  })
})

describe('actionAnnouncement', () => {
  it('reads as the verb and the name', () => {
    expect(actionAnnouncement('Duplicated', 'Checkout')).toBe('Duplicated Checkout')
  })
})
