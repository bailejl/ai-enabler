import { contentHash } from './contentHash.js'
import { problem } from './diagnostics/problem.js'
import { REGISTRY, upgradeToCurrent } from './schema/upgrades.js'
import { isObject } from './schema/primitives.js'
import { validateProjectFile } from './schema/validate.js'
import {
  CURRENT_SCHEMA_VERSION,
  RELEASED_SCHEMA_VERSIONS,
  compareSemver,
  parseSemver,
} from './schema/version.js'

// Takes an array, never spread arguments: a broken file can carry more problems than a call can
// take as arguments.
const fail = (problems) => ({ ok: false, problems })
const succeed = (file) => ({ ok: true, file })

// Each stage takes the file so far plus the settings and returns { ok: true, file } to continue or
// { ok: false, problems } to stop. Stages see only what earlier stages let through.

const parseJson = (text) => {
  try {
    return succeed(JSON.parse(text))
  } catch {
    return fail([problem('FILE_NOT_JSON')])
  }
}

// Reads only the envelope (an object with a SemVer schemaVersion), never nodes or edges, so a
// future upgrade is free to restructure them. Rejects versions newer than current or unreleased.
const checkEnvelope = (file, { current, released }) => {
  if (!isObject(file) || parseSemver(file.schemaVersion) === null) {
    return fail([problem('FILE_NOT_A_PROJECT')])
  }
  const version = file.schemaVersion
  const params = { version, current }
  if (compareSemver(version, current) > 0) return fail([problem('FILE_NEWER_SCHEMA', { params })])
  if (!released.includes(version)) return fail([problem('FILE_UNRELEASED_SCHEMA', { params })])
  return succeed(file)
}

const validate = (file) => {
  const result = validateProjectFile(file)
  return result.ok ? succeed(file) : fail(result.problems)
}

const STAGES = [checkEnvelope, upgradeToCurrent, validate]

const runStages = (first, settings) =>
  STAGES.reduce((result, stage) => (result.ok ? stage(result.file, settings) : result), first)

// AC48: a file is edited unless it carries a contentHash string equal to the hash of its own
// contents. Compared on the file as read, so an upgrade never makes an untouched file look edited.
const isEdited = async (file, digest) => (await contentHash(file, { digest })) !== file.contentHash

/**
 * The result for a file whose contents could not be read or hashed, whether the browser failed to
 * read it or the hash could not be computed.
 * @returns {{ ok: false, problems: object[] }}
 */
export const unreadableImport = () => fail([problem('FILE_UNREADABLE')])

/**
 * Turns the text of a chosen file into a validated project file at the current schema version.
 * `edited` says the file changed outside the app since it was exported (it has no matching
 * contentHash); the hash is checked against the file as read, before any upgrade.
 * Never throws on any file contents; the injected settings are trusted.
 * @returns {Promise<{ ok: true, file: object, edited: boolean } | { ok: false, problems: object[] }>}
 */
export const parseImport = async (
  text,
  {
    registry = REGISTRY,
    current = CURRENT_SCHEMA_VERSION,
    released = RELEASED_SCHEMA_VERSIONS,
    digest,
  } = {},
) => {
  const parsed = parseJson(text)
  if (!parsed.ok) return parsed
  const result = runStages(parsed, { registry, current, released })
  if (!result.ok) return result
  try {
    return { ...result, edited: await isEdited(parsed.file, digest) }
  } catch {
    return unreadableImport()
  }
}
