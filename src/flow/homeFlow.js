import { toRejection } from './problemsView.js'
import { SORT } from './projectStore.js'
import { formatCount } from './text.js'

// The homepage as a pure reducer: the list and its sort, the dialogs, the problems of a refused
// card action and the focus target. React only renders what it returns.

export const LIST_STATUS = Object.freeze({ loading: 'loading', ready: 'ready' })

export const HOME_EVENT = Object.freeze({
  listLoaded: 'listLoaded',
  sortChanged: 'sortChanged',
  createOpened: 'createOpened',
  renameOpened: 'renameOpened',
  deleteOpened: 'deleteOpened',
  dialogCancelled: 'dialogCancelled',
  nameRefused: 'nameRefused',
  renamed: 'renamed',
  duplicated: 'duplicated',
  deleted: 'deleted',
  actionFailed: 'actionFailed',
  actionSucceeded: 'actionSucceeded',
  imported: 'imported',
  importRejected: 'importRejected',
  importDismissed: 'importDismissed',
})

export const DIALOG = Object.freeze({ create: 'create', rename: 'rename', delete: 'delete' })

/**
 * Where focus goes next: New project, Import project, a card's link, or a card's "More actions"
 * button.
 */
export const FOCUS = Object.freeze({
  newProject: 'newProject',
  importProject: 'importProject',
  card: 'card',
  menu: 'menu',
})

export const INITIAL_HOME_STATE = Object.freeze({
  list: Object.freeze({ status: LIST_STATUS.loading, projects: [], problems: [] }),
  sort: SORT.modified,
  dialog: null,
  actionProblems: [],
  importStatus: null,
  focus: null,
})

const NAME_DIALOGS = [DIALOG.create, DIALOG.rename]

// A dialog that closes hands focus back to what opened it.
const focusOnClose = (dialog) =>
  dialog?.type === DIALOG.create
    ? { target: FOCUS.newProject }
    : { target: FOCUS.menu, id: dialog?.id }

// The dialog left open once the action on card `id` ends: one opened for another card since stays.
const dialogAfter = (state, id) => (state.dialog?.id === id ? null : state.dialog)

// An action on card `id` that worked closes its dialog and clears the problems of one that did not.
const closeAfterSuccess = (state, id, focus) => ({
  ...state,
  dialog: dialogAfter(state, id),
  actionProblems: [],
  focus,
})

const HANDLERS = {
  [HOME_EVENT.listLoaded]: (state, { projects, problems = [] }) => ({
    ...state,
    list: { status: LIST_STATUS.ready, projects, problems },
  }),
  // The cards shown stay until the list in the new order arrives.
  [HOME_EVENT.sortChanged]: (state, { sort }) => ({ ...state, sort }),
  [HOME_EVENT.createOpened]: (state) => ({
    ...state,
    dialog: { type: DIALOG.create, problems: [] },
  }),
  [HOME_EVENT.renameOpened]: (state, { id, name }) => ({
    ...state,
    dialog: { type: DIALOG.rename, id, name, problems: [] },
  }),
  [HOME_EVENT.deleteOpened]: (state, { id, name }) => ({
    ...state,
    dialog: { type: DIALOG.delete, id, name },
  }),
  [HOME_EVENT.dialogCancelled]: (state) =>
    state.dialog ? { ...state, dialog: null, focus: focusOnClose(state.dialog) } : state,
  // A refused name keeps its dialog open with the problems, so the user can retry.
  [HOME_EVENT.nameRefused]: (state, { problems }) =>
    NAME_DIALOGS.includes(state.dialog?.type)
      ? { ...state, dialog: { ...state.dialog, problems } }
      : state,
  [HOME_EVENT.renamed]: (state, { id }) => closeAfterSuccess(state, id, { target: FOCUS.menu, id }),
  [HOME_EVENT.duplicated]: (state, { id, copyId }) =>
    closeAfterSuccess(state, id, { target: FOCUS.card, id: copyId }),
  [HOME_EVENT.deleted]: (state, { id, focus }) => closeAfterSuccess(state, id, focus),
  // A card action the store refused: its dialog closes, its problems show, focus returns to it.
  [HOME_EVENT.actionFailed]: (state, { id, problems, focus = { target: FOCUS.menu, id } }) => ({
    ...state,
    dialog: dialogAfter(state, id),
    actionProblems: problems,
    focus,
  }),
  // A card action with no dialog and no focus move (export, replace) that worked.
  [HOME_EVENT.actionSucceeded]: (state) =>
    state.actionProblems.length === 0 ? state : { ...state, actionProblems: [] },
  // A homepage import: its outcome line stays until dismissed or the next import's.
  [HOME_EVENT.imported]: (state, { id, text }) => ({
    ...closeAfterSuccess(state, null, { target: FOCUS.card, id }),
    importStatus: { text },
  }),
  [HOME_EVENT.importRejected]: (state, { problems }) => ({
    ...state,
    actionProblems: [],
    importStatus: { problems },
  }),
  [HOME_EVENT.importDismissed]: (state, { focus = null }) => ({
    ...state,
    importStatus: null,
    focus,
  }),
}

/**
 * State: `{ list: { status: 'loading' | 'ready', projects, problems }, sort, dialog,
 * actionProblems, focus }`, where `dialog` is null, `{ type: 'create', problems }`,
 * `{ type: 'rename', id, name, problems }` or `{ type: 'delete', id, name }`, and `focus` is null
 * or `{ target, id? }` (a new object each time, so the same target can take focus again).
 * Events: `{ type: 'listLoaded', projects, problems? }` (the index entries, in order, and the
 * problems of a list that could not be read), `{ type: 'sortChanged', sort }`,
 * `{ type: 'createOpened' }`, `{ type: 'renameOpened', id, name }`,
 * `{ type: 'deleteOpened', id, name }`, `{ type: 'dialogCancelled' }`,
 * `{ type: 'nameRefused', problems }`, `{ type: 'renamed', id }`,
 * `{ type: 'duplicated', id, copyId }`, `{ type: 'deleted', id, focus }` (see `focusAfterRemove`),
 * `{ type: 'actionFailed', id, problems, focus? }`, `{ type: 'actionSucceeded' }`,
 * `{ type: 'imported', id, text }`,
 * `{ type: 'importRejected', problems }` and `{ type: 'importDismissed', focus? }`. `importStatus`
 * is null, `{ text }` or `{ problems }`. A create that works leaves the homepage, so it needs no
 * event. An action's end closes the dialog only when it is that card's (`id`), so a late result
 * never closes a dialog opened since for another card.
 */
export const reduceHome = (state, event) => HANDLERS[event.type]?.(state, event) ?? state

/**
 * True when the list has arrived and holds no project, so the empty state shows. A list that
 * could not be read is not empty: its problems show instead.
 */
export const isEmptyList = ({ list }) =>
  list.status === LIST_STATUS.ready && list.projects.length === 0 && list.problems.length === 0

/**
 * Where focus goes after `removedId` leaves the cards `ids` (in their shown order): the next card,
 * else the previous one, else New project.
 */
export const focusAfterRemove = (ids, removedId) => {
  const index = ids.indexOf(removedId)
  const rest = ids.filter((id) => id !== removedId)
  const id = rest[Math.min(Math.max(index, 0), rest.length - 1)]
  return id === undefined ? { target: FOCUS.newProject } : { target: FOCUS.card, id }
}

/**
 * The outcome line of a homepage import, such as "Imported Payments, 6 steps", or "Imported
 * Payments as a new project, 6 steps" when the file's id was taken, then the file's notices.
 */
export const describeHomeImport = ({ name, stepCount, isNewId, notices }) => {
  const as = isNewId ? ' as a new project' : ''
  const outcome = `Imported ${name}${as}, ${formatCount(stepCount, 'step')}`
  return notices.length > 0 ? `${outcome}. ${notices.join(' ')}` : outcome
}

/**
 * The homepage import's outcome line as the import status shows it (see describeImportStatus):
 * `{ text, isError: false }`, `{ isError: true, view }` or null.
 */
export const describeHomeImportStatus = (importStatus) => {
  if (!importStatus) return null
  if (importStatus.problems) {
    return { isError: true, view: toRejection('Import', importStatus.problems).view }
  }
  return { text: importStatus.text, isError: false }
}

/** What a card action that worked announces, such as "Duplicated Checkout". */
export const actionAnnouncement = (verb, name) => `${verb} ${name}`
