import { SORT } from './projectStore.js'

// The homepage as a pure reducer: the list and its sort, and (in later steps) the dialogs, the
// pending action, the focus target and the announcements. React only renders what it returns.

export const LIST_STATUS = Object.freeze({ loading: 'loading', ready: 'ready' })

export const HOME_EVENT = Object.freeze({
  listLoaded: 'listLoaded',
  sortChanged: 'sortChanged',
  createOpened: 'createOpened',
  createCancelled: 'createCancelled',
  createRefused: 'createRefused',
})

export const DIALOG = Object.freeze({ create: 'create' })

export const INITIAL_HOME_STATE = Object.freeze({
  list: Object.freeze({ status: LIST_STATUS.loading, projects: [], problems: [] }),
  sort: SORT.modified,
  dialog: null,
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
  [HOME_EVENT.createCancelled]: (state) => ({ ...state, dialog: null }),
  // A refused create keeps the dialog open with its problems, so the user can retry.
  [HOME_EVENT.createRefused]: (state, { problems }) =>
    state.dialog?.type === DIALOG.create
      ? { ...state, dialog: { type: DIALOG.create, problems } }
      : state,
}

/**
 * State: `{ list: { status: 'loading' | 'ready', projects, problems }, sort, dialog }`, where
 * `dialog` is null or `{ type: 'create', problems }`.
 * Events: `{ type: 'listLoaded', projects, problems? }` (the index entries, in order, and the
 * problems of a list that could not be read),
 * `{ type: 'sortChanged', sort }`, `{ type: 'createOpened' }`, `{ type: 'createCancelled' }`,
 * `{ type: 'createRefused', problems }`. A create that works leaves the homepage, so it needs no
 * event.
 */
export const reduceHome = (state, event) => HANDLERS[event.type]?.(state, event) ?? state

/**
 * True when the list has arrived and holds no project, so the empty state shows. A list that
 * could not be read is not empty: its problems show instead.
 */
export const isEmptyList = ({ list }) =>
  list.status === LIST_STATUS.ready && list.projects.length === 0 && list.problems.length === 0
