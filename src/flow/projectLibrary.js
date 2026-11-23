import { applyCommand } from './commands/index.js'
import { problem } from './diagnostics/problem.js'
import { parseImport } from './importFile.js'
import { projectFileName, toExportDownload, toMemoryProject } from './projectFile.js'

const COPY_SUFFIX = ' (copy)'

/**
 * The library rules over a project store (see projectStore.js). Every call returns
 * `{ ok, problems, ... }` and never throws.
 * @param {ReturnType<typeof import('./projectStore.js').createProjectStore>} store
 * @param {{ newId?: () => string, now?: () => Date }} [options] injected so ids and export times
 *   are deterministic in tests.
 */
export const createProjectLibrary = (
  store,
  { newId = () => crypto.randomUUID(), now = () => new Date() } = {},
) => {
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
    return read.ok ? openText(id, read.text) : read
  }

  // Opens text already read from the store as project `id`; see `open`.
  const openText = async (id, text) => {
    const imported = await parseImport(text)
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

  /**
   * Every saved project's index entry, sorted as projectStore's `list`, each with `openable`:
   * false when its stored file fails to open (STORE_FILE_INVALID), so its card offers only repairs.
   * A file that cannot be read now counts as openable, so a passing store failure hides nothing.
   */
  const list = async (options) => {
    const listed = await store.list(options)
    if (!listed.ok) return listed
    const projects = await Promise.all(
      listed.projects.map(async (entry) => {
        const read = await store.read(entry.id)
        const openable = !read.ok || (await parseImport(read.text)).ok
        return { ...entry, openable }
      }),
    )
    return { ...listed, projects }
  }

  // Opens `id` and, when it opens, runs `change(project)` and saves the project it returns.
  // A file that cannot be opened, a change that is refused or a failed write saves nothing.
  const withOpenedProject = async (id, change) => {
    const opened = await open(id)
    if (!opened.ok) return opened
    const changed = change(opened.project)
    if (!changed.ok) return { ok: false, problems: changed.problems }
    const saved = await store.save(changed.project)
    return saved.ok ? { ok: true, problems: [], project: changed.project } : saved
  }

  /** Renames a stored project through `rename_project` and saves it. */
  const rename = (id, name) =>
    withOpenedProject(id, (project) =>
      applyCommand(project, { name: 'rename_project', args: { name } }, { newId }),
    )

  /** Saves a copy of a stored project named "<name> (copy)" with a new id. */
  const duplicate = (id) =>
    withOpenedProject(id, ({ project, nodes, edges }) => ({
      ok: true,
      project: { project: { id: newId(), name: `${project.name}${COPY_SUFFIX}` }, nodes, edges },
    }))

  /** Removes a stored project; see projectStore's `remove`. */
  const remove = (id) => store.remove(id)

  /**
   * The file a card's Export downloads: `{ fileName, text }`. A project that opens is exported
   * as the open map would export it; one that cannot be opened downloads its stored text unchanged.
   */
  const exportFile = async (id) => {
    const read = await store.read(id)
    if (!read.ok) return read
    // The text read once decides both what opens and what downloads.
    const opened = await openText(id, read.text)
    if (!opened.ok) {
      const name = opened.name ?? ''
      return { ok: true, problems: [], fileName: projectFileName(name), text: read.text }
    }
    return { ok: true, problems: [], ...(await toExportDownload(opened.project, now())) }
  }

  /**
   * Creates an empty project named `name` through `create_project` and saves it. A name the
   * command rejects or a failed write changes nothing.
   * @returns {Promise<{ ok: boolean, problems: object[], project?: object }>}
   */
  const create = async (name) => {
    const created = applyCommand(null, { name: 'create_project', args: { name } }, { newId })
    if (!created.ok) return { ok: false, problems: created.problems }
    const saved = await store.save(created.project)
    return saved.ok ? { ok: true, problems: [], project: created.project } : saved
  }

  return { open, save, list, create, rename, duplicate, remove, exportFile }
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
 * made, and the first save or create that works calls `onFirstSave`, once.
 * @param {ReturnType<typeof createProjectLibrary>} library
 * @param {{ onProblems: (problems: object[]) => void, onFirstSave: () => void }} hooks
 */
export const observeLibrary = (library, { onProblems, onFirstSave }) => {
  const saved = { once: false }
  const observed = (result) => {
    if (!result.ok) onProblems(result.problems)
    return result
  }
  // A call that writes: the first one that works calls onFirstSave.
  const written = (result) => {
    if (result.ok && !saved.once) {
      saved.once = true
      onFirstSave()
    }
    return observed(result)
  }
  return {
    open: async (id) => observed(await library.open(id)),
    list: async (options) => observed(await library.list(options)),
    create: async (name) => written(await library.create(name)),
    save: async (memoryProject) => written(await library.save(memoryProject)),
    rename: async (id, name) => written(await library.rename(id, name)),
    duplicate: async (id) => written(await library.duplicate(id)),
    remove: async (id) => observed(await library.remove(id)),
    exportFile: async (id) => observed(await library.exportFile(id)),
  }
}
