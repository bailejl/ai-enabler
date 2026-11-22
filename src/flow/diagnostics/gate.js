// The diagnostics gate: given what a test wrote to the console, returns one failure line per
// problem. Both the unit gate (Vitest) and the e2e gate (Playwright) call it. There is no way to
// let a code or console text pass except naming the code in `expected` for that one test.

import catalog from './catalog.json' with { type: 'json' }
import { parseRecord } from './record.js'

const ALLOWED_KEYS = Object.freeze(['entries', 'pageErrors', 'expected'])
const UNCODED_LEVELS = Object.freeze(['error', 'warn'])

// Every failure line is built here, so the unit and e2e gates print the same text.
const FAILURE_LINE = Object.freeze({
  uncoded: (level, text) => `uncoded ${level}: ${text}`,
  unexpected: (code, severity, fix) => `unexpected ${code} (${severity}): ${fix}`,
  unknownCode: (code) => `unknown code ${code}`,
  notSeen: (code) => `expected ${code} was not seen`,
  pageError: (message) => `page error: ${message}`,
})

const recordLineFor = (record, expected) => {
  if (!Object.hasOwn(catalog, record.code)) return FAILURE_LINE.unknownCode(record.code)
  if (expected.includes(record.code)) return null
  const { severity, fix } = catalog[record.code]
  return FAILURE_LINE.unexpected(record.code, severity, fix)
}

const entryLineFor = (entry, expected) => {
  const record = parseRecord(entry.text)
  if (record) return recordLineFor(record, expected)
  return UNCODED_LEVELS.includes(entry.level) ? FAILURE_LINE.uncoded(entry.level, entry.text) : null
}

/**
 * Checks one test's console output. `entries` are `{ level, text }` console messages (level is
 * the console method name, such as `error`, `warn` or `info`), `pageErrors` are the messages of
 * uncaught page errors, and `expected` are the codes the test declared. Returns failure lines,
 * empty when the test is clean. Throws on any other key, so no allow-list can be passed in.
 */
export const checkDiagnostics = (options) => {
  const unsupportedKeys = Object.keys(options).filter((key) => !ALLOWED_KEYS.includes(key))
  if (unsupportedKeys.length > 0) {
    throw new Error(`checkDiagnostics does not accept: ${unsupportedKeys.join(', ')}`)
  }
  const { entries, pageErrors = [], expected = [] } = options
  const records = entries.map((entry) => parseRecord(entry.text)).filter(Boolean)
  const seenCodes = records.map((record) => record.code)
  return [
    ...entries.map((entry) => entryLineFor(entry, expected)).filter(Boolean),
    ...expected.filter((code) => !seenCodes.includes(code)).map(FAILURE_LINE.notSeen),
    ...pageErrors.map(FAILURE_LINE.pageError),
  ]
}
