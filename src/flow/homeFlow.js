import { SORT } from './projectStore.js'

// The homepage as a pure reducer: the list and its sort, and (in later steps) the dialogs, the
// pending action, the focus target and the announcements. React only renders what it returns.

export const LIST_STATUS = Object.freeze({ loading: 'loading', ready: 'ready' })

export const HOME_EVENT = Object.freeze({
  listLoaded: 'listLoaded',
  sortChanged: 'sortChanged',
})

export const INITIAL_HOME_STATE = Object.freeze({
  list: Object.freeze({ status: LIST_STATUS.loading, projects: [], problems: [] }),
  sort: SORT.modified,
})

const HANDLERS = {
  [HOME_EVENT.listLoaded]: (state, { projects, problems = [] }) => ({
    ...state,
    list: { status: LIST_STATUS.ready, projects, problems },
  }),
  // The cards shown stay until the list in the new order arrives.
  [HOME_EVENT.sortChanged]: (state, { sort }) => ({ ...state, sort }),
}

/**
 * State: `{ list: { status: 'loading' | 'ready', projects, problems }, sort }`.
 * Events: `{ type: 'listLoaded', projects, problems? }` (the index entries, in order, and the
 * problems of a list that could not be read),
 * `{ type: 'sortChanged', sort }`.
 */
export const reduceHome = (state, event) => HANDLERS[event.type]?.(state, event) ?? state

/** True when the list has arrived and holds no project, so the empty state shows. */
export const isEmptyList = ({ list }) =>
  list.status === LIST_STATUS.ready && list.projects.length === 0
