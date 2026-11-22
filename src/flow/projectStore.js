import { problem } from './diagnostics/problem.js'
import { serializeProjectFile, toProjectFile, withContentHash } from './projectFile.js'

export const SORT = Object.freeze({ modified: 'modified', name: 'name' })

const NAME_COLLATION = { sensitivity: 'base' }

const byId = (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)

// Newest first; projects changed at the same moment keep their id order.
const byModifiedNewestFirst = (left, right) =>
  right.modifiedAt.localeCompare(left.modifiedAt) || byId(left, right)

// A to Z, ignoring case and accents; equal names keep their id order.
const byNameAtoZ = (left, right) =>
  left.name.localeCompare(right.name, 'en', NAME_COLLATION) || byId(left, right)

const COMPARATORS = { [SORT.modified]: byModifiedNewestFirst, [SORT.name]: byNameAtoZ }

const succeed = (fields = {}) => ({ ok: true, problems: [], ...fields })

// The id and name are user text, so they travel only in `untrusted`, never in the message.
const failWith = (code, untrusted) => ({ ok: false, problems: [problem(code, { untrusted })] })

/**
 * The browser's saved projects over an injected adapter (see memoryStoreAdapter.js for the
 * interface). Every call returns `{ ok, problems, ... }` and never throws.
 *
 * Calls for one project id run one after another in the order they were made, so the newest save
 * is the one stored and a read sees every save made before it. Serializing and hashing happen in
 * that queue too. `list` waits for every pending call before it reads. A failed call never stops
 * the next one.
 *
 * Adapter failures map to catalog codes: a failed `put` or `remove` is STORE_WRITE_FAILED, a
 * failed `getFile` or `listIndex` is STORE_UNAVAILABLE, and an id that is not stored is
 * STORE_PROJECT_NOT_FOUND.
 * @param {object} adapter
 * @param {{ now?: () => Date }} [options] now is injected so modified times are deterministic.
 */
export const createProjectStore = (adapter, { now = () => new Date() } = {}) => {
  const queues = new Map()

  const enqueue = (id, task) => {
    const previous = queues.get(id) ?? Promise.resolve()
    const result = previous.then(task)
    // A task never rejects (each catches its own adapter errors), but the queue must survive one
    // that does, so the next call still runs.
    const tail = result.catch(() => {})
    queues.set(id, tail)
    tail.then(() => {
      if (queues.get(id) === tail) queues.delete(id)
    })
    return result
  }

  const settled = () => Promise.all(queues.values())

  /**
   * Saves the in-memory project (`{ project, nodes, edges }`) in the export form, contentHash
   * included, with `modifiedAt` set to the moment of the call.
   * @returns {Promise<{ ok: boolean, problems: object[], modifiedAt?: string }>}
   */
  const save = (memoryProject) => {
    const changedAt = now()
    const { id, name } = memoryProject.project
    return enqueue(id, async () => {
      const text = serializeProjectFile(
        await withContentHash(toProjectFile({ ...memoryProject, now: changedAt })),
      )
      const modifiedAt = changedAt.toISOString()
      try {
        await adapter.put({ id, name, modifiedAt }, text)
        return succeed({ modifiedAt })
      } catch {
        return failWith('STORE_WRITE_FAILED', { id, name })
      }
    })
  }

  /**
   * Every saved project's index entry, sorted by `sort` (last modified by default).
   * @returns {Promise<{ ok: boolean, problems: object[], projects?: object[] }>}
   */
  const list = async ({ sort = SORT.modified } = {}) => {
    await settled()
    try {
      const entries = await adapter.listIndex()
      return succeed({ projects: [...entries].sort(COMPARATORS[sort] ?? byModifiedNewestFirst) })
    } catch {
      return failWith('STORE_UNAVAILABLE', {})
    }
  }

  /**
   * The stored text of one project.
   * @returns {Promise<{ ok: boolean, problems: object[], text?: string }>}
   */
  const read = (id) =>
    enqueue(id, async () => {
      try {
        const text = await adapter.getFile(id)
        return text === undefined ? failWith('STORE_PROJECT_NOT_FOUND', { id }) : succeed({ text })
      } catch {
        return failWith('STORE_UNAVAILABLE', { id })
      }
    })

  /**
   * Removes one project and its index entry.
   * @returns {Promise<{ ok: boolean, problems: object[] }>}
   */
  const remove = (id) =>
    enqueue(id, async () => {
      try {
        if ((await adapter.getFile(id)) === undefined) {
          return failWith('STORE_PROJECT_NOT_FOUND', { id })
        }
      } catch {
        return failWith('STORE_UNAVAILABLE', { id })
      }
      try {
        await adapter.remove(id)
        return succeed()
      } catch {
        return failWith('STORE_WRITE_FAILED', { id })
      }
    })

  return { save, list, read, remove }
}
