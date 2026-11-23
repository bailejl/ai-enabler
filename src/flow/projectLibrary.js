import { problem } from './diagnostics/problem.js'
import { parseImport } from './importFile.js'
import { toMemoryProject } from './projectFile.js'

/**
 * The library rules over a project store (see projectStore.js). Every call returns
 * `{ ok, problems, ... }` and never throws.
 * @param {ReturnType<typeof import('./projectStore.js').createProjectStore>} store
 */
export const createProjectLibrary = (store) => {
  // The index entry for `id`, for the name a page shows when the file cannot be opened.
  const entryFor = async (id) => {
    const listed = await store.list()
    return listed.ok ? listed.projects.find((entry) => entry.id === id) : undefined
  }

  /**
   * Opens a stored project through the import pipeline, so an older file upgrades. Writes nothing.
   * A file that fails the pipeline is STORE_FILE_INVALID, followed by the pipeline's problems, and
   * `name` is the index entry's name when there is one.
   * @returns {Promise<{ ok: boolean, problems: object[], project?: object, name?: string }>}
   */
  const open = async (id) => {
    const read = await store.read(id)
    if (!read.ok) return read
    const imported = await parseImport(read.text)
    if (imported.ok) return { ok: true, problems: [], project: toMemoryProject(imported.file) }
    const name = (await entryFor(id))?.name
    return {
      ok: false,
      problems: [problem('STORE_FILE_INVALID', { untrusted: { id, name } }), ...imported.problems],
      ...(name === undefined ? {} : { name }),
    }
  }

  /** Saves the in-memory project; see projectStore's `save`. */
  const save = (memoryProject) => store.save(memoryProject)

  return { open, save }
}

export const OPEN_OUTCOME = Object.freeze({
  found: 'found',
  missing: 'missing',
  unopenable: 'unopenable',
})

/**
 * What a project link shows for an `open` result: `{ type: 'found', project }`,
 * `{ type: 'missing', problems }` for an id that is not stored, or `{ type: 'unopenable', name,
 * problems }` for a stored file that cannot be opened or a store that cannot be read.
 */
export const toOpenOutcome = (opened) => {
  if (opened.ok) return { type: OPEN_OUTCOME.found, project: opened.project }
  if (opened.problems[0]?.code === 'STORE_PROJECT_NOT_FOUND') {
    return { type: OPEN_OUTCOME.missing, problems: opened.problems }
  }
  return { type: OPEN_OUTCOME.unopenable, name: opened.name ?? null, problems: opened.problems }
}

/**
 * Wraps a library so each failed call hands its problems to `onProblems` once, where the call is
 * made, and the first save that works calls `onFirstSave`, once.
 * @param {ReturnType<typeof createProjectLibrary>} library
 * @param {{ onProblems: (problems: object[]) => void, onFirstSave: () => void }} hooks
 */
export const observeLibrary = (library, { onProblems, onFirstSave }) => {
  const saved = { once: false }
  const observed = (result) => {
    if (!result.ok) onProblems(result.problems)
    return result
  }
  return {
    open: async (id) => observed(await library.open(id)),
    save: async (memoryProject) => {
      const result = observed(await library.save(memoryProject))
      if (result.ok && !saved.once) {
        saved.once = true
        onFirstSave()
      }
      return result
    },
  }
}
