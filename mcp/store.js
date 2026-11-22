import { constants } from 'node:fs'
import fsp from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { problem } from '../src/flow/diagnostics/problem.js'

const FOLDER_NAME = 'projects'

// A project file is far smaller than this; the cap keeps one read from filling memory.
const MAX_FILE_BYTES = 5 * 1024 * 1024

// A plain file name: starts with a letter or digit, so never "." or ".."; no separators, no NUL.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/

const fail = (code, name) => ({
  ok: false,
  // The raw name is user text, so it goes in `untrusted` and never in the code, fix or message.
  problems: [problem(code, typeof name === 'string' ? { untrusted: { name } } : {})],
})

// Accepts only a plain `.json` name.
const checkName = (name) =>
  typeof name === 'string' && NAME_PATTERN.test(name) ? null : fail('FILE_NAME_NOT_ALLOWED', name)

/**
 * The check every read and write goes through after checkName: confirms the projects folder really
 * is `<startDir>/projects` (not a link elsewhere) and that the target, when it exists, is a regular
 * file with no other hard link (not a symlink, a pipe, a directory or a second name for a file
 * elsewhere). Throws on an I/O error or an unexpected folder, which the caller turns into its own
 * problem.
 * @returns {Promise<{ ok: true, target: string, stats?: object } | { ok: false, problems: object[] }>}
 *   stats is the lstat of the target, absent when it does not exist.
 */
const resolveTarget = async ({ startDir, folder }, name) => {
  const realFolder = await fsp.realpath(folder)
  if (realFolder !== path.join(await fsp.realpath(startDir), FOLDER_NAME)) {
    // Stryker disable next-line StringLiteral: the message is never shown; callers map any throw
    throw new Error('The projects folder is not the expected directory')
  }
  const target = path.join(realFolder, name)
  // An lstat failure (missing file, name too long, no access) is not a bad target; the read or
  // write that follows fails on its own and is reported by the caller.
  const stats = await fsp.lstat(target).catch(() => undefined)
  if (stats && (!stats.isFile() || stats.nlink > 1)) return fail('FILE_NAME_NOT_ALLOWED', name)
  return { ok: true, target, stats }
}

/**
 * The projects folder: `<startDir>/projects`, resolved once. Files are addressed by plain name
 * only; nothing outside the folder is ever read or written. Results are `{ ok, problems }`.
 *
 * - `read(name)`: `{ ok: true, text }`, or FILE_NAME_NOT_ALLOWED (also for a target that is not a
 *   regular file or has another hard link), FILE_TOO_LARGE above 5 MB, or FILE_NOT_FOUND for a
 *   missing, unreadable or unusable file or folder.
 * - `write(name, text, { mustBeNew })`: creates the folder if needed and writes the file through
 *   a temp file that is flushed to disk first, so a failure leaves the old file as it was;
 *   `{ ok: true }`, or FILE_NAME_NOT_ALLOWED, FILE_TOO_LARGE for text above 5 MB, or FILE_SAVE_FAILED for any I/O failure (the caller keeps the project
 *   in memory). With `mustBeNew` an existing file is never touched and the problem is
 *   FILE_NAME_TAKEN.
 */
export const createStore = (startDir) => {
  const root = path.resolve(startDir)
  const paths = { startDir: root, folder: path.join(root, FOLDER_NAME) }

  const read = async (name) => {
    try {
      const bad = checkName(name)
      if (bad) return bad
      const resolved = await resolveTarget(paths, name)
      if (!resolved.ok) return resolved
      // Stryker disable next-line OptionalChaining: for a missing file the TypeError it would raise
      // is caught below and ends in the same FILE_NOT_FOUND
      if (resolved.stats?.size > MAX_FILE_BYTES) return fail('FILE_TOO_LARGE', name)
      // O_NOFOLLOW closes the gap between the lstat above and this open: a symlink put in place in
      // between makes the open fail with ELOOP instead of being followed.
      const handle = await fsp.open(resolved.target, constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        return { ok: true, text: await handle.readFile('utf8') }
      } finally {
        await handle.close()
      }
    } catch (error) {
      return fail(error.code === 'ELOOP' ? 'FILE_NAME_NOT_ALLOWED' : 'FILE_NOT_FOUND', name)
    }
  }

  // The text goes to a temp file in the same folder first, so a failed write never leaves a
  // half-written project. The name starts with a dot, which NAME_PATTERN never accepts, so the
  // temp file can never be addressed as a project. An overwrite renames it over the target; a new
  // project links it to the target, which fails atomically if the name is taken. The temp file is
  // always removed (it is already gone after a rename).
  const write = async (name, text, { mustBeNew = false } = {}) => {
    let temp
    try {
      const bad = checkName(name)
      if (bad) return bad
      if (Buffer.byteLength(text) > MAX_FILE_BYTES) return fail('FILE_TOO_LARGE', name)
      await fsp.mkdir(paths.folder, { recursive: true })
      const resolved = await resolveTarget(paths, name)
      if (!resolved.ok) return resolved
      const { target, stats } = resolved
      // A rename would replace a read-only file, so check that the file could be written first.
      if (stats && !mustBeNew) await fsp.access(target, constants.W_OK)
      temp = path.join(path.dirname(target), `.${randomUUID()}.tmp`)
      // Flushed to disk before it is renamed or linked into place, so a crash cannot leave the
      // target pointing at a file whose contents never reached the disk.
      const handle = await fsp.open(temp, 'wx')
      try {
        await handle.writeFile(text)
        await handle.sync()
      } finally {
        await handle.close()
      }
      if (mustBeNew) {
        await fsp.link(temp, target)
      } else {
        await fsp.rename(temp, target)
      }
      return { ok: true }
    } catch (error) {
      return fail(
        mustBeNew && error.code === 'EEXIST' ? 'FILE_NAME_TAKEN' : 'FILE_SAVE_FAILED',
        name,
      )
    } finally {
      if (temp) await fsp.unlink(temp).catch(() => {})
    }
  }

  return { read, write }
}
