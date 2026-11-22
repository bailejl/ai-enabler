// Seeds and reads the app's browser project store from a test. It runs in the page against the
// Vite dev server, importing the app's own IndexedDB adapter, so it writes the layout the app
// reads (src/flow/storeLayout.js) and the app needs no test seam. The page must be on the app.

import { expect } from '@playwright/test'
import { STORE_LAYOUT } from '../src/flow/storeLayout.js'

const ADAPTER_MODULE = '/src/shell/indexedDbAdapter.js'

// Runs `action(adapter, value)` in the page with an adapter over the app's database.
const withAdapter = (page, action, value) =>
  page.evaluate(
    async ({ modulePath, source, arg }) => {
      const { createIndexedDbAdapter, openProjectsDatabase } = await import(modulePath)
      const db = await openProjectsDatabase(indexedDB)
      try {
        // The action arrives as source text, the only way a function crosses into the page.
        const run = new Function(`return (${source})`)()
        return await run(createIndexedDbAdapter(db), arg)
      } finally {
        db.close()
      }
    },
    { modulePath: ADAPTER_MODULE, source: action.toString(), arg: value },
  )

/**
 * Stores each record `{ id, name, modifiedAt, text }` as the app would. `text` may be any string,
 * so a corrupt record seeds the same way as a valid one.
 */
export const seedProjects = (page, records) =>
  withAdapter(
    page,
    async (adapter, list) => {
      for (const { text, ...entry } of list) await adapter.put(entry, text)
    },
    records,
  )

/** The stored text of project `id`, or null when it is not stored. */
export const readStored = (page, id) =>
  withAdapter(page, async (adapter, key) => (await adapter.getFile(key)) ?? null, id)

/** Every index entry `{ id, name, modifiedAt }`, sorted by id. */
export const readIndex = (page) =>
  withAdapter(page, async (adapter) =>
    (await adapter.listIndex()).sort((left, right) => left.id.localeCompare(right.id)),
  )

/**
 * Waits until the stored file of project `id`, parsed, makes `predicate` true, so a test reloads
 * only after a save has landed.
 */
export const waitForStored = (page, id, predicate) =>
  expect
    .poll(async () => {
      const text = await readStored(page, id)
      return text !== null && predicate(JSON.parse(text))
    })
    .toBe(true)

/** The names of every IndexedDB database on the page's origin, sorted. */
export const databaseNames = (page) =>
  page.evaluate(async () => (await indexedDB.databases()).map(({ name }) => name).sort())

/**
 * For `page.addInitScript(abortFileWrites, filesStore)`: from then on the browser aborts a
 * transaction once its file text has been put, after the index entry, so the write fails halfway
 * and asynchronously. Setting `window.allowFileWrites = true` lets writes through again.
 */
export const abortFileWrites = (filesStore) => {
  const original = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = function (...args) {
    // A prototype patch learns the store the call was made on only from `this`.
    // eslint-disable-next-line no-restricted-syntax
    const store = this
    const request = original.apply(store, args)
    if (store.name === filesStore && !window.allowFileWrites) {
      request.addEventListener('success', () => store.transaction.abort())
    }
    return request
  }
}

export const FILES_STORE = STORE_LAYOUT.filesStore
