import { applyCommand, rejectCommand, replacesProject } from './commands/index.js'
import { problem } from './diagnostics/problem.js'
import { parseImport } from './importFile.js'
import { layoutSteps } from './layout.js'
import { toMemoryProject, toProjectFile, withContentHash } from './projectFile.js'

/**
 * The editing session is a plain value; every transition takes one and returns the next, so
 * nothing is held between calls.
 *
 * - `name`: the file the project was opened from or last saved as, or null for a new project.
 * - `project`: the in-memory project (`{ project, nodes, edges }`, the project file shape without
 *   schemaVersion, exportedAt, contentHash or modifiedBy), or null when none is open.
 * - `baseline`: the project as last opened or saved, which discard returns to; null for a new
 *   project that was never saved.
 * - `changes`: how many commands succeeded since then. Above zero means unsaved changes.
 */
export const EMPTY_SESSION = Object.freeze({
  name: null,
  project: null,
  baseline: null,
  changes: 0,
})

export const hasUnsavedChanges = (session) => session.changes > 0

/**
 * The problems that stop another file being opened or a new project being created: unsaved
 * changes in the open project. Empty when switching is allowed.
 */
export const checkCanSwitch = (session) =>
  hasUnsavedChanges(session) ? [problem('CMD_UNSAVED_CHANGES')] : []

/**
 * Opens a file's text as the session, through the app's import pipeline, so the file is upgraded
 * and must be valid. Unsaved changes in `session` block it before the text is parsed. A failure
 * returns the problems and the session it was given. `schemaVersion` is the version the file was
 * written at, before any upgrade.
 * @returns {Promise<{ ok: true, session: object, schemaVersion: string } | { ok: false, session: object, problems: object[] }>}
 */
export const openInto = async (session, text, name) => {
  const blocked = checkCanSwitch(session)
  if (blocked.length > 0) return { ok: false, session, problems: blocked }
  const result = await parseImport(text)
  if (!result.ok) return { ok: false, session, problems: result.problems }
  const project = toMemoryProject(result.file)
  return {
    ok: true,
    session: { name, project, baseline: project, changes: 0 },
    schemaVersion: result.fileVersion,
  }
}

/**
 * Applies one command to the session's project. A rejected command, including a create_project
 * that unsaved changes block, returns the same session, so it never makes the session unsaved.
 * MCP commands never move existing steps; layout runs on save.
 * @param {{ newId: () => string }} deps
 * @returns {{ ok: boolean, session: object, problems: object[], summary: string, created?: string }}
 */
export const applyToSession = (session, command, deps) => {
  if (replacesProject(command) && hasUnsavedChanges(session)) {
    return { ...rejectCommand(command.name, checkCanSwitch(session)), session }
  }
  const { project, ...outcome } = applyCommand(session.project, command, deps)
  if (!outcome.ok) return { ...outcome, session }
  const next = replacesProject(command)
    ? { name: null, project, baseline: null, changes: 1 }
    : { ...session, project, changes: session.changes + 1 }
  return { ...outcome, session: next }
}

/**
 * Drops the unsaved changes by returning to the project as last opened or saved; a new project
 * that was never saved has nothing to return to, so the session empties.
 * @returns {{ session: object, discarded: number }} discarded is the number of changes dropped
 */
export const discard = (session) => {
  if (!hasUnsavedChanges(session)) return { session, discarded: 0 }
  const reverted = session.baseline
    ? { ...session, project: session.baseline, changes: 0 }
    : EMPTY_SESSION
  return { session: reverted, discarded: session.changes }
}

/**
 * Where a save goes. No name (undefined or null) means the file the session came from; a project
 * never saved has none, so it needs a name. Only the session's own file may be overwritten: any
 * other name must be a new file.
 * @param {string|null|undefined} name
 * @returns {{ ok: true, name: string, mustBeNew: boolean } | { ok: false, problems: object[] }}
 */
export const planSave = (session, name) => {
  const target = name ?? session.name
  if (target === null) return { ok: false, problems: [problem('FILE_NAME_REQUIRED')] }
  return { ok: true, name: target, mustBeNew: target !== session.name }
}

/**
 * Builds the file to write: the project laid out left to right, at schema 0.1.0, exported at `now`
 * and marked as changed by `tool`. The mark goes in before the hash, so the hash covers it. The
 * session is not changed; pass the result to markSaved once the file is written. `from` is the
 * project the file was built from.
 * @param {{ now: Date, tool: string }} settings now and tool are injected
 * @returns {Promise<{ ok: true, file: object, from: object } | { ok: false, problems: object[] }>}
 */
export const toSaveFile = async (session, { now, tool }) => {
  if (!session.project) return { ok: false, problems: [problem('CMD_NO_PROJECT')] }
  const { project, nodes, edges } = session.project
  const exported = toProjectFile({ project, nodes: layoutSteps(nodes, edges), edges, now })
  const marked = { ...exported, modifiedBy: { tool, at: now.toISOString() } }
  return { ok: true, file: await withContentHash(marked), from: session.project }
}

/**
 * The session after the file from toSaveFile was written as `name`. The file becomes the
 * baseline. When the project is still the one the file was built from, the session is clean and
 * holds the laid-out project. When commands were applied (or changes discarded) since, the
 * project is kept and the session stays unsaved, so those changes are not lost.
 * @param {{ file: object, from: object }} saved The ok result of toSaveFile
 */
export const markSaved = (session, { file, from }, name = session.name) => {
  const project = toMemoryProject(file)
  if (session.project !== from) {
    return {
      name,
      project: session.project,
      baseline: project,
      changes: Math.max(session.changes, 1),
    }
  }
  return { name, project, baseline: project, changes: 0 }
}
