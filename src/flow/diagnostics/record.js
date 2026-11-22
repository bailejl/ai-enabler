// The one place a console record is built. A record is made by copying named keys, never by
// spreading a problem, so message, params, untrusted, stepId, edgeId and any other key a problem
// carries cannot reach the console.

import { problem } from './problem.js'

/** The keys every record has, in order. Other keys (`field`, `suppressed`) appear only when set. */
export const RECORD_KEYS = Object.freeze([
  'source',
  'code',
  'severity',
  'version',
  'session',
  'platform',
  'build',
  'time',
])

/**
 * The only `field` names a record may carry: the fixed names the validator and the commands set.
 * Any other `field` value is dropped. A drift test in record.test.js keeps this list complete.
 */
export const KNOWN_FIELDS = Object.freeze([
  'project.id',
  'project.name',
  'id',
  'position',
  'label',
  'type',
  'pt',
  'lt',
  'queue',
  'batch',
  'ca',
  'modifiedBy',
  'modifiedBy.tool',
  'modifiedBy.at',
  'name',
  'stepId',
  'sourceId',
  'targetId',
])

const SOURCE = 'aie'

const CONTEXT_KEYS = Object.freeze(['version', 'session', 'platform', 'build', 'time'])

const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]))

/**
 * Builds a record from a problem, the run context (version, session, platform, build, time) and
 * the count of records of this code dropped since the last one. Only `code`, `severity`, the
 * context keys, a known `field` and a `suppressed` count above zero are copied.
 */
export const toRecord = (found, context, suppressed = 0) => ({
  source: SOURCE,
  ...pick(found, ['code', 'severity']),
  ...pick(context, CONTEXT_KEYS),
  ...(KNOWN_FIELDS.includes(found.field) && { field: found.field }),
  ...(suppressed > 0 && { suppressed }),
})

const NON_ERROR_NAME = 'NonError'

// Only a dev build keeps the message and stack. Anything that is not exactly 'dev' is treated as
// production, so an unexpected build value never leaks detail.
const errorDetail = (error, build) => {
  const isError = error instanceof Error
  const name = isError ? error.name : NON_ERROR_NAME
  if (build !== 'dev' || !isError) return { name }
  return { name, message: error.message, stack: error.stack }
}

/**
 * Builds the record of a crash code (APP_RENDER_FAILED, APP_UNCAUGHT_ERROR,
 * APP_UNHANDLED_REJECTION) with an `error` detail. A prod build gets `{ name }` only. A dev build
 * gets `{ name, message, stack }` for an Error. A thrown value that is not an Error is named
 * "NonError" and its text is never kept. Throws on a code that is not in the catalog.
 */
export const toErrorRecord = (code, error, context, suppressed = 0) => ({
  ...toRecord(problem(code), context, suppressed),
  error: errorDetail(error, context.build),
})

/** The record as one line of JSON text. */
export const serializeRecord = (record) => JSON.stringify(record)

/**
 * The record in a line of console text, or null when the text is not JSON, is not a JSON object,
 * or has no `source` of "aie".
 */
export const parseRecord = (text) => {
  try {
    const parsed = JSON.parse(text)
    const isObject = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    return isObject && parsed.source === SOURCE ? parsed : null
  } catch {
    return null
  }
}
