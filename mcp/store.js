import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { problem } from '../src/flow/diagnostics/problem.js'

const FOLDER_NAME = 'projects'

// A plain file name: starts with a letter or digit, so never "." or ".."; no separators, no NUL.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/

const fail = (code, name) => ({
  ok: false,
  // The raw name is user text, so it goes in `untrusted` and never in the code, fix or message.
  problems: [problem(code, typeof name === 'string' ? { untrusted: { name } } : {})],
})

/**
 * The one check every read and write goes through. Accepts only a plain `.json` name, then
 * confirms the projects folder really is `<startDir>/projects` (not a link elsewhere) and that
 * the target is not a symlink. `create` makes the folder first (used by save). Throws on an I/O
 * error or an unexpected folder, which the caller turns into its own problem.
 * @returns {Promise<{ ok: true, target: string } | { ok: false, problems: object[] }>}
 */
const resolveName = async ({ startDir, folder }, name, create) => {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
    return fail('FILE_NAME_NOT_ALLOWED', name)
  }
  if (create) await mkdir(folder, { recursive: true })
  const realFolder = await realpath(folder)
  if (realFolder !== path.join(await realpath(startDir), FOLDER_NAME)) {
    // Stryker disable next-line StringLiteral: the message is never shown; callers map any throw
    throw new Error('The projects folder is not the expected directory')
  }
  const target = path.join(realFolder, name)
  // An lstat failure (missing file, name too long, no access) is not a symlink; the read or write
  // that follows fails on its own and is reported by the caller.
  const isLink = await lstat(target).then(
    (stats) => stats.isSymbolicLink(),
    () => false,
  )
  if (isLink) return fail('FILE_NAME_NOT_ALLOWED', name)
  return { ok: true, target }
}

/**
 * The projects folder: `<startDir>/projects`, resolved once. Files are addressed by plain name
 * only; nothing outside the folder is ever read or written. Results are `{ ok, problems }`.
 *
 * - `read(name)`: `{ ok: true, text }`, or FILE_NAME_NOT_ALLOWED, or FILE_NOT_FOUND for a
 *   missing, unreadable or unusable file or folder.
 * - `write(name, text, { mustBeNew })`: creates the folder if needed and writes the file;
 *   `{ ok: true }`, or FILE_NAME_NOT_ALLOWED, or FILE_SAVE_FAILED for any I/O failure (the
 *   caller keeps the project in memory). With `mustBeNew` an existing file is never touched and
 *   the problem is FILE_NAME_TAKEN.
 */
export const createStore = (startDir) => {
  const root = path.resolve(startDir)
  const paths = { startDir: root, folder: path.join(root, FOLDER_NAME) }

  const read = async (name) => {
    try {
      const resolved = await resolveName(paths, name, false)
      if (!resolved.ok) return resolved
      return { ok: true, text: await readFile(resolved.target, 'utf8') }
    } catch {
      return fail('FILE_NOT_FOUND', name)
    }
  }

  const write = async (name, text, { mustBeNew = false } = {}) => {
    try {
      const resolved = await resolveName(paths, name, true)
      if (!resolved.ok) return resolved
      // 'wx' fails atomically if the file exists, so a new project never overwrites.
      try {
        await writeFile(resolved.target, text, mustBeNew ? { flag: 'wx' } : undefined)
      } catch (error) {
        if (mustBeNew && error.code === 'EEXIST') return fail('FILE_NAME_TAKEN', name)
        throw error
      }
      return { ok: true }
    } catch {
      return fail('FILE_SAVE_FAILED', name)
    }
  }

  return { read, write }
}
