import { contentHash } from './contentHash.js'
import { REGISTRY, upgradeToCurrent } from './schema/upgrades.js'
import { isObject } from './schema/primitives.js'
import { NOT_A_PROJECT_FILE, validateProjectFile } from './schema/validate.js'
import {
  CURRENT_SCHEMA_VERSION,
  RELEASED_SCHEMA_VERSIONS,
  compareSemver,
  parseSemver,
} from './schema/version.js'

const NOT_JSON = 'This file is not valid JSON.'
const UNREADABLE = 'This file could not be read.'

const fail = (message) => ({ ok: false, message })
const succeed = (file) => ({ ok: true, file })

// Each stage takes the file so far plus the settings and returns { ok: true, file } to continue or
// { ok: false, message } to stop. Stages see only what earlier stages let through.

const parseJson = (text) => {
  try {
    return succeed(JSON.parse(text))
  } catch {
    return fail(NOT_JSON)
  }
}

const describeNewer = (version, current) =>
  `This file uses schema ${version}; this app supports up to ${current}. Update the app or re-export the file.`

const describeUnreleased = (version, current) =>
  `This file uses schema ${version}, which was never released; this app supports up to ${current}.`

// Reads only the envelope (an object with a SemVer schemaVersion), never nodes or edges, so a
// future upgrade is free to restructure them. Rejects versions newer than current or unreleased.
const checkEnvelope = (file, { current, released }) => {
  if (!isObject(file) || parseSemver(file.schemaVersion) === null) return fail(NOT_A_PROJECT_FILE)
  const version = file.schemaVersion
  if (compareSemver(version, current) > 0) return fail(describeNewer(version, current))
  if (!released.includes(version)) return fail(describeUnreleased(version, current))
  return succeed(file)
}

const validate = (file) => {
  const result = validateProjectFile(file)
  return result.ok ? succeed(file) : fail(result.message)
}

const STAGES = [checkEnvelope, upgradeToCurrent, validate]

const runStages = (first, settings) =>
  STAGES.reduce((result, stage) => (result.ok ? stage(result.file, settings) : result), first)

// AC48: a file is edited unless it carries a contentHash string equal to the hash of its own
// contents. Compared on the file as read, so an upgrade never makes an untouched file look edited.
const isEdited = async (file, digest) => (await contentHash(file, { digest })) !== file.contentHash

/**
 * Turns the text of a chosen file into a validated project file at the current schema version.
 * `edited` says the file changed outside the app since it was exported (it has no matching
 * contentHash); the hash is checked against the file as read, before any upgrade.
 * Never throws on any file contents; the injected settings are trusted.
 * @returns {Promise<{ ok: true, file: object, edited: boolean } | { ok: false, message: string }>}
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
    return fail(UNREADABLE)
  }
}
