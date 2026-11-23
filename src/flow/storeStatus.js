// The storage problems the app shows: the problems of the last failed save, kept until a save of
// the same project works, and shown only with that project open.

export const INITIAL_STORE_STATUS = Object.freeze({ failedSaves: Object.freeze({}) })

export const STORE_STATUS_EVENT = Object.freeze({
  saveFailed: 'saveFailed',
  saveSucceeded: 'saveSucceeded',
})

/**
 * State: `{ failedSaves: { [id]: problems } }`, one entry per project whose last save failed.
 * Events: `{ type: 'saveFailed', id, problems }`, `{ type: 'saveSucceeded', id }`.
 */
export const reduceStoreStatus = (state, event) => {
  if (event.type === STORE_STATUS_EVENT.saveFailed) {
    return { failedSaves: { ...state.failedSaves, [event.id]: event.problems } }
  }
  if (
    event.type === STORE_STATUS_EVENT.saveSucceeded &&
    Object.hasOwn(state.failedSaves, event.id)
  ) {
    const failedSaves = Object.fromEntries(
      Object.entries(state.failedSaves).filter(([id]) => id !== event.id),
    )
    return { failedSaves }
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
  Object.hasOwn(state.failedSaves, id) ? state.failedSaves[id] : []

/**
 * True when the page shows the lasting "Not saved in this browser" notice: the browser is not
 * keeping projects at all (`persistent` false), or the open project's last save failed.
 * @param {{ persistent: boolean, storeStatus: object }} store
 * @param {string | null} openId the open project's id, or null on a page with no map
 */
export const showsStoreNotice = ({ persistent, storeStatus }, openId) =>
  !persistent || (openId !== null && Object.hasOwn(storeStatus.failedSaves, openId))

/**
 * True when leaving the open project inside the app asks first: its last change is not stored.
 * In a tab that keeps projects in memory, moving between pages loses nothing, so it does not ask.
 */
export const asksBeforeLeaving = (storeStatus, openId) =>
  Object.hasOwn(storeStatus.failedSaves, openId)
