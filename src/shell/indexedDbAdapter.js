import { STORE_LAYOUT } from '../flow/storeLayout.js'

const { database, version, indexStore, filesStore } = STORE_LAYOUT

// A request's result as a promise.
const requestResult = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

// Runs `work` in one transaction over both stores, settling only when the transaction does: a
// write resolves on `complete`, so a write the browser aborts halfway rejects and leaves nothing.
const inTransaction = (db, mode, work) =>
  new Promise((resolve, reject) => {
    const transaction = db.transaction([indexStore, filesStore], mode)
    const results = { value: undefined }
    transaction.oncomplete = () => resolve(results.value)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'))
    const index = transaction.objectStore(indexStore)
    const files = transaction.objectStore(filesStore)
    work({ index, files }).then(
      (value) => {
        results.value = value
      },
      (error) => {
        try {
          transaction.abort()
        } catch {
          // Already finished or aborted: there is nothing left to undo.
        }
        reject(error)
      },
    )
  })

/**
 * Opens the projects database, creating its stores on first use. Rejects when the browser will
 * not open it: `open` throws, or fires `error` or `blocked`.
 * @param {IDBFactory} factory
 * @returns {Promise<IDBDatabase>}
 */
export const openProjectsDatabase = (factory) =>
  new Promise((resolve, reject) => {
    const request = factory.open(database, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(indexStore))
        db.createObjectStore(indexStore, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(filesStore)) db.createObjectStore(filesStore)
    }
    const outcome = { rejected: false }
    const fail = (error) => {
      outcome.rejected = true
      reject(error)
    }
    request.onsuccess = () => {
      const db = request.result
      // A connection that opens after a `blocked` refusal is not used, so it is closed.
      if (outcome.rejected) {
        db.close()
        return
      }
      // A newer version opened in another tab must not wait on this one.
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => fail(request.error)
    request.onblocked = () => fail(new Error('blocked'))
  })

/**
 * The project store adapter over an open projects database (see memoryStoreAdapter.js for the
 * interface). Request-to-promise plumbing only: ordering and error mapping live in the store.
 * @param {IDBDatabase} db
 */
export const createIndexedDbAdapter = (db) => ({
  listIndex: () => inTransaction(db, 'readonly', ({ index }) => requestResult(index.getAll())),
  getFile: (id) => inTransaction(db, 'readonly', ({ files }) => requestResult(files.get(id))),
  put: (entry, text) =>
    inTransaction(db, 'readwrite', async ({ index, files }) => {
      index.put({ id: entry.id, name: entry.name, modifiedAt: entry.modifiedAt })
      files.put(text, entry.id)
    }),
  remove: (id) =>
    inTransaction(db, 'readwrite', async ({ index, files }) => {
      index.delete(id)
      files.delete(id)
    }),
})
