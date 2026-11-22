import { afterEach, describe, expect, it, vi } from 'vitest'
import { problem } from '../flow/diagnostics/problem.js'
import { MAX_RECORDS_PER_WINDOW, RATE_WINDOW_MS } from '../flow/diagnostics/rateLimit.js'
import { parseRecord } from '../flow/diagnostics/record.js'
import {
  createDiagnostics,
  newSessionId,
  report,
  reportError,
  resetDiagnostics,
} from './diagnostics.js'
import { capturedConsoleCalls, expectDiagnostics } from '../testHelpers.js'
import { APP_VERSION } from './version.js'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const SECRET = 'SECRET-MARKER'

const TEST_CATALOG = {
  TEST_ERROR: { severity: 'error' },
  TEST_WARNING: { severity: 'warning' },
  TEST_HINT: { severity: 'hint' },
}

// A console that remembers each call as { method, text }, so tests assert what was written.
const recordingConsole = () => {
  const calls = []
  const writer = (method) => (text) => calls.push({ method, text })
  return { calls, error: writer('error'), warn: writer('warn'), info: writer('info') }
}

const fixedClock = (...times) => {
  const remaining = [...times]
  return () => remaining.shift()
}

const sinkWith = (options = {}) => {
  const recorder = recordingConsole()
  const diagnostics = createDiagnostics({
    console: recorder,
    now: () => 0,
    build: 'dev',
    session: 'session-1',
    version: '9.9.9',
    ...options,
  })
  return { ...diagnostics, calls: recorder.calls }
}

const recordsOf = (calls) => calls.map(({ text }) => parseRecord(text))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('severity routing', () => {
  it('writes an error to console.error, a warning to console.warn and a hint to console.info', () => {
    const { report: write, calls } = sinkWith({ catalog: TEST_CATALOG })

    write({ code: 'TEST_ERROR' })
    write({ code: 'TEST_WARNING' })
    write({ code: 'TEST_HINT' })

    expect(calls.map(({ method }) => method)).toEqual(['error', 'warn', 'info'])
    expect(recordsOf(calls).map(({ code, severity }) => [code, severity])).toEqual([
      ['TEST_ERROR', 'error'],
      ['TEST_WARNING', 'warning'],
      ['TEST_HINT', 'hint'],
    ])
  })

  it('writes the record as one line of JSON text, not an object', () => {
    const { report: write, calls } = sinkWith({ catalog: TEST_CATALOG })

    write({ code: 'TEST_ERROR' })

    expect(typeof calls[0].text).toBe('string')
    expect(calls[0].text).not.toContain('\n')
  })

  it("takes the severity from the catalog, not from the caller's problem", () => {
    const { report: write, calls } = sinkWith({ catalog: TEST_CATALOG })

    write({ code: 'TEST_HINT', severity: 'error' })

    expect(calls.map(({ method }) => method)).toEqual(['info'])
    expect(parseRecord(calls[0].text).severity).toBe('hint')
  })
})

describe('record context', () => {
  it('carries the version, session, platform, build and an ISO 8601 UTC time', () => {
    const { report: write, calls } = sinkWith({ now: () => Date.UTC(2026, 10, 22, 8, 30, 15, 42) })

    write(problem('FILE_NOT_JSON'))

    const record = parseRecord(calls[0].text)
    expect(record).toMatchObject({
      source: 'aie',
      code: 'FILE_NOT_JSON',
      severity: 'error',
      version: '9.9.9',
      session: 'session-1',
      platform: 'browser',
      build: 'dev',
      time: '2026-11-22T08:30:15.042Z',
    })
  })

  it('keeps the message and params of a problem out of the record', () => {
    const { report: write, calls } = sinkWith()

    write(problem('STEP_LABEL_MISSING', { params: { step: SECRET }, untrusted: { title: SECRET } }))

    expect(calls[0].text).not.toContain(SECRET)
  })

  it('shares one session across records of one sink and differs between sinks', () => {
    const sinkA = sinkWith({ session: undefined })
    const sinkB = sinkWith({ session: undefined })

    sinkA.report(problem('FILE_NOT_JSON'))
    sinkA.report(problem('FILE_UNREADABLE'))
    sinkB.report(problem('FILE_NOT_JSON'))

    const [firstOfA, secondOfA] = recordsOf(sinkA.calls)
    const [firstOfB] = recordsOf(sinkB.calls)
    expect(firstOfA.session).toMatch(UUID_V4)
    expect(secondOfA.session).toBe(firstOfA.session)
    expect(firstOfB.session).not.toBe(firstOfA.session)
  })
})

describe('reportError', () => {
  const crash = new TypeError(SECRET)

  it('writes a dev crash record with the error name, message and stack', () => {
    const { reportError: write, calls } = sinkWith({ build: 'dev' })

    write('APP_UNCAUGHT_ERROR', crash)

    const record = parseRecord(calls[0].text)
    expect(calls[0].method).toBe('error')
    expect(record).toMatchObject({
      code: 'APP_UNCAUGHT_ERROR',
      build: 'dev',
      error: { name: 'TypeError', message: SECRET },
    })
    expect(typeof record.error.stack).toBe('string')
  })

  it('writes a prod crash record with the error name only', () => {
    const { reportError: write, calls } = sinkWith({ build: 'prod' })

    write('APP_UNCAUGHT_ERROR', crash)

    expect(parseRecord(calls[0].text)).toMatchObject({
      build: 'prod',
      error: { name: 'TypeError' },
    })
    expect(calls[0].text).not.toContain(SECRET)
  })

  it("takes the severity from the sink's catalog, as report does", () => {
    const { reportError: write, calls } = sinkWith({
      catalog: { APP_UNCAUGHT_ERROR: { severity: 'warning' } },
    })

    write('APP_UNCAUGHT_ERROR', crash)

    expect(calls.map(({ method }) => method)).toEqual(['warn'])
    expect(parseRecord(calls[0].text).severity).toBe('warning')
  })

  it('writes a code that only the sink catalog has, with its severity', () => {
    const { reportError: write, calls } = sinkWith({ catalog: TEST_CATALOG })

    write('TEST_ERROR', crash)

    expect(calls.map(({ method }) => method)).toEqual(['error'])
    expect(parseRecord(calls[0].text)).toMatchObject({
      code: 'TEST_ERROR',
      severity: 'error',
      error: { name: 'TypeError', message: SECRET },
    })
  })
})

describe('an unknown code', () => {
  it.each([
    ['report', (sink) => sink.report({ code: 'NOPE_UNKNOWN' })],
    ['reportError', (sink) => sink.reportError('NOPE_UNKNOWN', new Error('x'))],
  ])('throws from %s, naming the code, and writes nothing', (_name, call) => {
    const sink = sinkWith()

    expect(() => call(sink)).toThrow('NOPE_UNKNOWN')
    expect(sink.calls).toEqual([])
  })

  it.each([
    ['report', (sink, code) => sink.report({ code })],
    ['reportError', (sink, code) => sink.reportError(code, new Error('x'))],
  ])('throws from %s on a code that is not a string, and writes nothing', (_name, call) => {
    const sink = sinkWith({ catalog: { ...TEST_CATALOG, 1: { severity: 'error' } } })

    expect(() => call(sink, 1)).toThrow('Unknown diagnostic code: 1')
    expect(() => call(sink, undefined)).toThrow('Unknown diagnostic code: undefined')
    expect(sink.calls).toEqual([])
  })

  it('does not read the clock, so it cannot use up a rate limit slot', () => {
    const now = vi.fn(() => 0)
    const sink = sinkWith({ now })

    for (let count = 0; count <= MAX_RECORDS_PER_WINDOW; count += 1) {
      expect(() => sink.report({ code: 'NOPE_UNKNOWN' })).toThrow('NOPE_UNKNOWN')
    }

    expect(now).not.toHaveBeenCalled()
  })
})

describe('rate limit', () => {
  const IN_WINDOW = [0, 1000, 2000, 3000, 4000, 10_000, 20_000]
  const DROPPED_COUNT = IN_WINDOW.length - MAX_RECORDS_PER_WINDOW

  it('drops records over the limit and carries the dropped count on the next emitted one', () => {
    const times = [...IN_WINDOW, RATE_WINDOW_MS + 4000]
    const { report: write, calls } = sinkWith({ now: fixedClock(...times) })
    times.forEach(() => write(problem('FILE_NOT_JSON')))

    const records = recordsOf(calls)
    expect(records).toHaveLength(MAX_RECORDS_PER_WINDOW + 1)
    records
      .slice(0, MAX_RECORDS_PER_WINDOW)
      .forEach((record) => expect(record).not.toHaveProperty('suppressed'))
    expect(records[MAX_RECORDS_PER_WINDOW].suppressed).toBe(DROPPED_COUNT)
  })

  it('limits each code on its own', () => {
    const { report: write, calls } = sinkWith()
    for (let count = 0; count <= MAX_RECORDS_PER_WINDOW; count += 1) write(problem('FILE_NOT_JSON'))

    write(problem('STEP_ID_MISSING'))

    const last = parseRecord(calls.at(-1).text)
    expect(last.code).toBe('STEP_ID_MISSING')
    expect(last).not.toHaveProperty('suppressed')
  })

  it('starts counting again after reset', () => {
    const sink = sinkWith()
    for (let count = 0; count <= MAX_RECORDS_PER_WINDOW; count += 1)
      sink.report(problem('FILE_NOT_JSON'))
    expect(sink.calls).toHaveLength(MAX_RECORDS_PER_WINDOW)

    sink.reset()
    sink.report(problem('FILE_NOT_JSON'))

    expect(sink.calls).toHaveLength(MAX_RECORDS_PER_WINDOW + 1)
    expect(parseRecord(sink.calls[MAX_RECORDS_PER_WINDOW].text)).not.toHaveProperty('suppressed')
  })
})

describe('without crypto.randomUUID', () => {
  const stubCryptoWithoutRandomUuid = (fillByte) => {
    vi.stubGlobal('crypto', {
      getRandomValues: (array) => array.fill(fillByte),
    })
  }

  it('builds a UUID-shaped session id from random bytes', () => {
    stubCryptoWithoutRandomUuid(0xff)
    expect(newSessionId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')

    stubCryptoWithoutRandomUuid(0x00)
    expect(newSessionId()).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('builds a different id each time', () => {
    const { crypto: realCrypto } = globalThis
    vi.stubGlobal('crypto', { getRandomValues: (array) => realCrypto.getRandomValues(array) })

    expect(newSessionId()).not.toBe(newSessionId())
  })

  it('creates a sink that has a session id and reports normally', () => {
    stubCryptoWithoutRandomUuid(0xab)
    const recorder = recordingConsole()
    const diagnostics = createDiagnostics({ console: recorder, build: 'dev' })

    diagnostics.report(problem('FILE_NOT_JSON'))

    expect(parseRecord(recorder.calls[0].text).session).toMatch(UUID_V4)
  })
})

describe('the default sink', () => {
  afterEach(() => {
    resetDiagnostics()
  })

  it('writes to the real console with the app version and the dev build', () => {
    expectDiagnostics(['FILE_NOT_JSON', 'APP_UNCAUGHT_ERROR'])
    resetDiagnostics()

    report(problem('FILE_NOT_JSON'))
    reportError('APP_UNCAUGHT_ERROR', new Error('x'))

    const [firstRecord, secondRecord] = capturedConsoleCalls('error').map(parseRecord)
    expect(firstRecord).toMatchObject({ code: 'FILE_NOT_JSON', version: APP_VERSION, build: 'dev' })
    expect(secondRecord).toMatchObject({ code: 'APP_UNCAUGHT_ERROR', error: { name: 'Error' } })
  })
})
