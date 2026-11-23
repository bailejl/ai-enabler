// The browser project store's layout: one database with an index of `{ id, name, modifiedAt }`
// entries and the save-file text of each project, both keyed by project id. The IndexedDB adapter
// and the e2e helpers that seed it read these names from here, so the two never drift apart.
export const STORE_LAYOUT = Object.freeze({
  database: 'ai-enabler',
  version: 1,
  indexStore: 'index',
  filesStore: 'files',
})
