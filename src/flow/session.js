import { applyCommand } from './commands/index.js'
import { problem } from './diagnostics/problem.js'
import { parseImport } from './importFile.js'
import { layoutSteps } from './layout.js'
import { toProjectFile, withContentHash } from './projectFile.js'

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

const toMemory = ({ project, nodes, edges }) => ({ project, nodes, edges })

export const hasUnsavedChanges = (session) => session.changes > 0

/**
 * Parses a file's text through the app's import pipeline, so the file is upgraded and must be
 * valid. Failure returns the problems and no session; the caller keeps the session it has.
 * @returns {Promise<{ ok: true, session: object } | { ok: false, problems: object[] }>}
 */
export const openSession = async (text, name) => {
  const result = await parseImport(text)
  if (!result.ok) return result
  const project = toMemory(result.file)
  return { ok: true, session: { name, project, baseline: project, changes: 0 } }
}

/**
 * The problems that stop another file being opened or a new project being created: unsaved
 * changes in the open project. Empty when switching is allowed.
 */
export const checkCanSwitch = (session) =>
  hasUnsavedChanges(session) ? [problem('CMD_UNSAVED_CHANGES')] : []

const CREATE = 'create_project'

/**
 * Applies one command to the session's project. A rejected command, including a create_project
 * that unsaved changes block, returns the same session, so it never makes the session unsaved.
 * Commands never move existing steps; layout runs on save.
 * @param {{ newId: () => string }} deps
 * @returns {{ ok: boolean, session: object, problems: object[], summary: string, created?: string }}
 */
export const applyToSession = (session, command, deps) => {
  if (command?.name === CREATE && hasUnsavedChanges(session)) {
    return {
      ok: false,
      session,
      problems: checkCanSwitch(session),
      summary: `Rejected ${CREATE}: the open project has unsaved changes`,
    }
  }
  const { project, ...outcome } = applyCommand(session.project, command, deps)
  if (!outcome.ok) return { ...outcome, session }
  const next =
    command.name === CREATE
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
 * Builds the file to write: the project laid out left to right, at schema 0.1.0, exported at `now`
 * and marked as changed by `tool`. The mark goes in before the hash, so the hash covers it. The
 * session is not changed; call markSaved once the file is written.
 * @param {{ now: Date, tool: string }} settings now and tool are injected
 * @returns {Promise<{ ok: true, file: object } | { ok: false, problems: object[] }>}
 */
export const toSaveFile = async (session, { now, tool }) => {
  if (!session.project) return { ok: false, problems: [problem('CMD_PROJECT_NOT_OPEN')] }
  const { project, nodes, edges } = session.project
  const exported = toProjectFile({ project, nodes: layoutSteps(nodes, edges), edges, now })
  const marked = { ...exported, modifiedBy: { tool, at: now.toISOString() } }
  return { ok: true, file: await withContentHash(marked) }
}

/**
 * The session after `file` (from toSaveFile) was written as `name`: clean, holding the laid-out
 * project.
 */
export const markSaved = (session, file, name = session.name) => {
  const project = toMemory(file)
  return { name, project, baseline: project, changes: 0 }
}
