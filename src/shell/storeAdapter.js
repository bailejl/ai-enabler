import { problem } from '../flow/diagnostics/problem.js'
import { createMemoryStoreAdapter } from '../flow/memoryStoreAdapter.js'
import { createIndexedDbAdapter, openProjectsDatabase } from './indexedDbAdapter.js'

/**
 * Picks the store adapter once: IndexedDB when the browser opens it, else the memory adapter with
 * STORE_UNAVAILABLE. `persistent` is false for the memory adapter, whose projects go with the tab.
 * Never rejects.
 * @param {{ factory?: IDBFactory }} [options] factory is injected for tests.
 * @returns {Promise<{ adapter: object, persistent: boolean, problems: object[] }>}
 */
export const openStoreAdapter = async ({ factory = globalThis.indexedDB } = {}) => {
  try {
    if (!factory) throw new Error('no indexedDB')
    const db = await openProjectsDatabase(factory)
    return { adapter: createIndexedDbAdapter(db), persistent: true, problems: [] }
  } catch {
    return {
      adapter: createMemoryStoreAdapter(),
      persistent: false,
      problems: [problem('STORE_UNAVAILABLE')],
    }
  }
}

/**
 * Asks the browser once, best effort, to keep this site's storage under pressure. Never rejects.
 * @param {{ storage?: StorageManager }} [options]
 */
export const requestDurableStorage = async ({ storage = globalThis.navigator?.storage } = {}) => {
  try {
    await storage?.persist?.()
  } catch {
    // Best effort: a refusal changes nothing the user can act on.
  }
}
