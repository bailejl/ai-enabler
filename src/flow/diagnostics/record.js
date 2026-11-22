// The one place a console record is built. A record is made by copying named keys, never by
// spreading a problem, so message, params, untrusted, stepId, edgeId and any other key a problem
// carries cannot reach the console.

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
export const toRecord = (problem, context, suppressed = 0) => ({
  source: SOURCE,
  ...pick(problem, ['code', 'severity']),
  ...pick(context, CONTEXT_KEYS),
  ...(KNOWN_FIELDS.includes(problem.field) && { field: problem.field }),
  ...(suppressed > 0 && { suppressed }),
})

/** The record as one line of JSON text. */
export const serializeRecord = (record) => JSON.stringify(record)
