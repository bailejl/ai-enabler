// The console sink: the one place the app writes a diagnostic record. Each record is one line of
// JSON text, sent to the console method for its severity, after a per-code rate limit.

import defaultCatalog from '../flow/diagnostics/catalog.json' with { type: 'json' }
import { admit } from '../flow/diagnostics/rateLimit.js'
import { serializeRecord, toErrorRecord, toRecord } from '../flow/diagnostics/record.js'
import { APP_VERSION } from './version.js'

const PLATFORM = 'browser'
const EMPTY_LIMITER_STATE = Object.freeze({})

const CONSOLE_METHOD_BY_SEVERITY = Object.freeze({
  error: 'error',
  warning: 'warn',
  hint: 'info',
})

const UUID_BYTE_COUNT = 16
const UUID_VERSION_BYTE = 6
const UUID_VARIANT_BYTE = 8

const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

// A v4 UUID from random bytes: the version nibble is 4 and the variant bits are 10.
const uuidFromRandomBytes = () => {
  const random = globalThis.crypto.getRandomValues(new Uint8Array(UUID_BYTE_COUNT))
  const bytes = random.map((byte, index) => {
    if (index === UUID_VERSION_BYTE) return (byte & 0x0f) | 0x40
    if (index === UUID_VARIANT_BYTE) return (byte & 0x3f) | 0x80
    return byte
  })
  const hex = toHex(bytes)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

/** A random session id: `crypto.randomUUID` when the browser has it, else a v4 id built from `crypto.getRandomValues`. */
export const newSessionId = () =>
  typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : uuidFromRandomBytes()

/**
 * Creates a sink. `report(problem)` and `reportError(code, error)` throw on a code that is not in
 * `catalog` and write nothing. Otherwise the record goes through the per-code rate limit and then
 * to `console.error`, `console.warn` or `console.info` by the catalog's severity. `reset()` clears
 * the rate limit. A record's `severity` is always the catalog's, never the caller's.
 */
export const createDiagnostics = ({
  console: sink = globalThis.console,
  now = Date.now,
  build = import.meta.env.DEV ? 'dev' : 'prod',
  session = newSessionId(),
  version = APP_VERSION,
  catalog = defaultCatalog,
} = {}) => {
  let limiterState = EMPTY_LIMITER_STATE

  const write = (code, buildRecord) => {
    if (!Object.hasOwn(catalog, code)) throw new Error(`Unknown diagnostic code: ${String(code)}`)
    const at = now()
    const admission = admit(limiterState, code, at)
    limiterState = admission.state
    if (!admission.emit) return
    const context = {
      version,
      session,
      platform: PLATFORM,
      build,
      time: new Date(at).toISOString(),
    }
    const record = buildRecord(context, admission.suppressed)
    sink[CONSOLE_METHOD_BY_SEVERITY[record.severity]](serializeRecord(record))
  }

  const report = (found) =>
    write(found.code, (context, suppressed) =>
      toRecord({ ...found, severity: catalog[found.code].severity }, context, suppressed),
    )

  const reportError = (code, error) =>
    write(code, (context, suppressed) => toErrorRecord(code, error, context, suppressed))

  const reset = () => {
    limiterState = EMPTY_LIMITER_STATE
  }

  return { report, reportError, reset }
}

const diagnostics = createDiagnostics()

export const report = diagnostics.report
export const reportError = diagnostics.reportError
export const resetDiagnostics = diagnostics.reset
