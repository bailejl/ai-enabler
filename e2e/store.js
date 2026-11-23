// Seeds and reads the app's browser project store from a test, in the page, with the layout the
// app reads (src/flow/storeLayout.js), so the app needs no test seam. It uses the browser's own
// IndexedDB API, so it works on the dev server and on the production preview alike. The page must
// be on the app's origin.

import { expect } from '@playwright/test'
import { STORE_LAYOUT } from '../src/flow/storeLayout.js'

// Runs in the page: one store operation, `seed`, `read` or `index`, on the app's database.
const storeOperation = async ({ layout, operation, value }) => {
  const settle = (target, done) =>
    new Promise((resolve, reject) => {
      target[done] = () => resolve(target.result)
      target.onerror = () => reject(target.error)
      target.onabort = () => reject(target.error ?? new Error('transaction aborted'))
    })
  const opening = indexedDB.open(layout.database, layout.version)
  opening.onupgradeneeded = () => {
    opening.result.createObjectStore(layout.indexStore, { keyPath: 'id' })
    opening.result.createObjectStore(layout.filesStore)
  }
  const db = await settle(opening, 'onsuccess')
  try {
    const stores = [layout.indexStore, layout.filesStore]
    if (operation === 'seed') {
      const transaction = db.transaction(stores, 'readwrite')
      value.forEach(({ text, ...entry }) => {
        transaction.objectStore(layout.indexStore).put(entry)
        transaction.objectStore(layout.filesStore).put(text, entry.id)
      })
      await settle(transaction, 'oncomplete')
      return null
    }
    const transaction = db.transaction(stores)
    if (operation === 'read') {
      return (
        (await settle(transaction.objectStore(layout.filesStore).get(value), 'onsuccess')) ?? null
      )
    }
    const entries = await settle(transaction.objectStore(layout.indexStore).getAll(), 'onsuccess')
    return entries.sort((left, right) => left.id.localeCompare(right.id))
  } finally {
    db.close()
  }
}

const inStore = (page, operation, value = null) =>
  page.evaluate(storeOperation, { layout: STORE_LAYOUT, operation, value })

/**
 * Stores each record `{ id, name, modifiedAt, text }` as the app would. `text` may be any string,
 * so a corrupt record seeds the same way as a valid one.
 */
export const seedProjects = (page, records) => inStore(page, 'seed', records)

/** The stored text of project `id`, or null when it is not stored. */
export const readStored = (page, id) => inStore(page, 'read', id)

/** Every index entry `{ id, name, modifiedAt }`, sorted by id. */
export const readIndex = (page) => inStore(page, 'index')

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
