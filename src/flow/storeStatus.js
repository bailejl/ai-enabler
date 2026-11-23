// The storage problems the app shows: the problems of the last failed save, kept until a save of
// the same project works, and shown only with that project open.

export const INITIAL_STORE_STATUS = Object.freeze({ failedSave: null })

export const STORE_STATUS_EVENT = Object.freeze({
  saveFailed: 'saveFailed',
  saveSucceeded: 'saveSucceeded',
})

/**
 * State: `{ failedSave: { id, problems } | null }`.
 * Events: `{ type: 'saveFailed', id, problems }`, `{ type: 'saveSucceeded', id }`.
 */
export const reduceStoreStatus = (state, event) => {
  if (event.type === STORE_STATUS_EVENT.saveFailed) {
    return { failedSave: { id: event.id, problems: event.problems } }
  }
  if (event.type === STORE_STATUS_EVENT.saveSucceeded && state.failedSave?.id === event.id) {
    return INITIAL_STORE_STATUS
  }
  return state
}

/** The event a save's result gives for project `id`. */
export const toStoreStatusEvent = (id, saved) =>
  saved.ok
    ? { type: STORE_STATUS_EVENT.saveSucceeded, id }
    : { type: STORE_STATUS_EVENT.saveFailed, id, problems: saved.problems }

/** The storage problems to list with project `id` open, empty when its last save worked. */
export const storeProblemsOf = (state, id) =>
  state.failedSave?.id === id ? state.failedSave.problems : []
