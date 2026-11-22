/**
 * A project store adapter that keeps everything in memory: the test double for the store and the
 * fallback when the browser will not open its own storage. Every call is async, like the
 * IndexedDB adapter, and copies on the way in and out, so no caller shares an object with it.
 *
 * - `listIndex()`: every index entry `{ id, name, modifiedAt }`, in no particular order.
 * - `getFile(id)`: the stored text, or undefined when the id is not stored.
 * - `put(entry, text)`: stores the entry and its text together, replacing any with the same id.
 * - `remove(id)`: drops the entry and its text; an unknown id changes nothing.
 */
export const createMemoryStoreAdapter = () => {
  const entries = new Map()
  const files = new Map()
  return {
    listIndex: async () => [...entries.values()].map((entry) => ({ ...entry })),
    getFile: async (id) => files.get(id),
    put: async (entry, text) => {
      entries.set(entry.id, { ...entry })
      files.set(entry.id, text)
    },
    remove: async (id) => {
      entries.delete(id)
      files.delete(id)
    },
  }
}
