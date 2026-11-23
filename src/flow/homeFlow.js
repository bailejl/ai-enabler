import { SORT } from './projectStore.js'

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
})

export const DIALOG = Object.freeze({ create: 'create', rename: 'rename', delete: 'delete' })

/** Where focus goes next: New project, a card's link, or a card's "More actions" button. */
export const FOCUS = Object.freeze({ newProject: 'newProject', card: 'card', menu: 'menu' })

export const INITIAL_HOME_STATE = Object.freeze({
  list: Object.freeze({ status: LIST_STATUS.loading, projects: [], problems: [] }),
  sort: SORT.modified,
  dialog: null,
  actionProblems: [],
  focus: null,
})

const NAME_DIALOGS = [DIALOG.create, DIALOG.rename]

// A dialog that closes hands focus back to what opened it.
const focusOnClose = (dialog) =>
  dialog?.type === DIALOG.create
    ? { target: FOCUS.newProject }
    : { target: FOCUS.menu, id: dialog?.id }

// An action that worked closes its dialog and clears the problems of one that did not.
const done = (state, focus) => ({ ...state, dialog: null, actionProblems: [], focus })

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
  [HOME_EVENT.renamed]: (state, { id }) => done(state, { target: FOCUS.menu, id }),
  [HOME_EVENT.duplicated]: (state, { id }) => done(state, { target: FOCUS.card, id }),
  [HOME_EVENT.deleted]: (state, { focus }) => done(state, focus),
  // A card action the store refused: its dialog closes, its problems show, focus returns to it.
  [HOME_EVENT.actionFailed]: (state, { id, problems }) => ({
    ...state,
    dialog: null,
    actionProblems: problems,
    focus: { target: FOCUS.menu, id },
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
 * `{ type: 'nameRefused', problems }`, `{ type: 'renamed', id }`, `{ type: 'duplicated', id }`
 * (the copy's id), `{ type: 'deleted', focus }` (see `focusAfterRemove`) and
 * `{ type: 'actionFailed', id, problems }`. A create that works leaves the homepage, so it needs
 * no event.
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

/** True when every problem is the store's, so the input was fine and the browser refused it. */
export const isStoreRefusal = (problems) =>
  problems.length > 0 && problems.every(({ code }) => code.startsWith('STORE_'))

/** What a card action that worked announces, such as "Duplicated Checkout". */
export const actionAnnouncement = (verb, name) => `${verb} ${name}`
