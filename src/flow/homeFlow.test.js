import { describe, expect, it } from 'vitest'
import {
  DIALOG,
  FOCUS,
  HOME_EVENT,
  INITIAL_HOME_STATE,
  LIST_STATUS,
  actionAnnouncement,
  describeHomeImport,
  describeHomeImportStatus,
  focusAfterRemove,
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
    const state = run(renaming, { type: HOME_EVENT.nameRefused, id: 'p1', problems: refused })
    expect(state.dialog).toEqual({
      type: DIALOG.rename,
      id: 'p1',
      name: 'Checkout',
      problems: refused,
    })
  })

  it('keeps a late refusal out of a rename opened since for another card', () => {
    const renamingB = { type: HOME_EVENT.renameOpened, id: 'b', name: 'B' }
    const state = run(renaming, renamingB, {
      type: HOME_EVENT.nameRefused,
      id: 'p1',
      problems: writeFailed,
    })
    expect(state.dialog.problems).toEqual([])
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
    expect(run({ type: HOME_EVENT.duplicated, id: 'p1', copyId: 'copy' }).focus).toEqual({
      target: FOCUS.card,
      id: 'copy',
    })
  })

  it('closes delete and moves focus where it is told', () => {
    const focus = { target: FOCUS.card, id: 'c' }
    const state = run(
      { type: HOME_EVENT.deleteOpened, id: 'b', name: 'B' },
      { type: HOME_EVENT.deleted, id: 'b', focus },
    )
    expect(state.dialog).toBeNull()
    expect(state.focus).toEqual(focus)
  })

  it.each([
    ['deleted', { type: HOME_EVENT.deleted, id: 'a', focus: null }],
    ['renamed', { type: HOME_EVENT.renamed, id: 'a' }],
    ['duplicated', { type: HOME_EVENT.duplicated, id: 'a', copyId: 'a2' }],
    ['actionFailed', { type: HOME_EVENT.actionFailed, id: 'a', problems: writeFailed }],
    ['imported', { type: HOME_EVENT.imported, id: 'new', text: 'Imported New, 1 step' }],
  ])('keeps a dialog opened for another card when an earlier %s ends', (_name, event) => {
    const renamingB = { type: HOME_EVENT.renameOpened, id: 'b', name: 'B' }
    expect(run(renamingB, event).dialog).toEqual({
      type: DIALOG.rename,
      id: 'b',
      name: 'B',
      problems: [],
    })
  })

  it('clears the problems of a refused action once an export or replace works', () => {
    const failed = run({ type: HOME_EVENT.actionFailed, id: 'p1', problems: writeFailed })
    const state = reduceHome(failed, { type: HOME_EVENT.actionSucceeded })
    expect(state.actionProblems).toEqual([])
    expect(state.focus).toEqual(failed.focus)
  })

  it('leaves the state as it is when a working action had no problems to clear', () => {
    expect(run({ type: HOME_EVENT.actionSucceeded })).toBe(INITIAL_HOME_STATE)
  })

  it('shows the problems of a refused action until one works', () => {
    const failed = run(renaming, { type: HOME_EVENT.actionFailed, id: 'p1', problems: writeFailed })
    expect(failed.dialog).toBeNull()
    expect(failed.actionProblems).toEqual(writeFailed)
    expect(failed.focus).toEqual({ target: FOCUS.menu, id: 'p1' })
    const copied = reduceHome(failed, { type: HOME_EVENT.duplicated, id: 'p1', copyId: 'x' })
    expect(copied.actionProblems).toEqual([])
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

describe('actionAnnouncement', () => {
  it('reads as the verb and the name', () => {
    expect(actionAnnouncement('Duplicated', 'Checkout')).toBe('Duplicated Checkout')
  })
})

describe('reduceHome homepage import', () => {
  it('shows the outcome, focuses the new card and clears refused-action problems', () => {
    const state = run(
      { type: HOME_EVENT.actionFailed, id: 'a', problems: [{ code: 'STORE_WRITE_FAILED' }] },
      { type: HOME_EVENT.imported, id: 'abc', text: 'Imported Payments, 6 steps' },
    )
    expect(state.importStatus).toEqual({ text: 'Imported Payments, 6 steps' })
    expect(state.focus).toEqual({ target: FOCUS.card, id: 'abc' })
    expect(state.actionProblems).toEqual([])
  })

  it('shows the problems of a rejected file until dismissed', () => {
    const problems = [{ code: 'FILE_NOT_JSON' }]
    const rejected = run(
      { type: HOME_EVENT.actionFailed, id: 'a', problems: [{ code: 'STORE_WRITE_FAILED' }] },
      { type: HOME_EVENT.importRejected, problems },
    )
    expect(rejected.importStatus).toEqual({ problems })
    expect(rejected.actionProblems).toEqual([])
    const dismissed = reduceHome(rejected, {
      type: HOME_EVENT.importDismissed,
      focus: { target: FOCUS.importProject },
    })
    expect(dismissed.importStatus).toBeNull()
    expect(dismissed.focus).toEqual({ target: FOCUS.importProject })
  })

  it('sends focus where a failed action says', () => {
    const focus = { target: FOCUS.importProject }
    const state = run({ type: HOME_EVENT.actionFailed, id: null, problems: [], focus })
    expect(state.focus).toEqual(focus)
  })
})

describe('describeHomeImportStatus', () => {
  it('is nothing with no import shown', () => {
    expect(describeHomeImportStatus(null)).toBeNull()
  })

  it('gives the outcome line', () => {
    expect(describeHomeImportStatus({ text: 'Imported Payments, 6 steps' })).toEqual({
      text: 'Imported Payments, 6 steps',
      isError: false,
    })
  })

  it('gives the rejection view of a refused file', () => {
    const status = describeHomeImportStatus({ problems: [{ code: 'FILE_NOT_JSON' }] })
    expect(status.isError).toBe(true)
    expect(status.view.items.map(({ code }) => code)).toEqual(['FILE_NOT_JSON'])
  })
})

describe('describeHomeImport', () => {
  it('names the project and its steps, and a new id when the file had to take one', () => {
    const base = { name: 'Payments', stepCount: 6, notices: [] }
    expect(describeHomeImport({ ...base, isNewId: false })).toBe('Imported Payments, 6 steps')
    expect(describeHomeImport({ ...base, isNewId: true })).toBe(
      'Imported Payments as a new project, 6 steps',
    )
  })

  it('follows with the notices', () => {
    expect(
      describeHomeImport({ name: 'A', stepCount: 1, isNewId: false, notices: ['N1.', 'N2.'] }),
    ).toBe('Imported A, 1 step. N1. N2.')
  })
})
