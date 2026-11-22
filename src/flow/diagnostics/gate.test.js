import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import catalog from './catalog.json' with { type: 'json' }
import { checkDiagnostics } from './gate.js'
import { serializeRecord, toRecord } from './record.js'

const CONTEXT = {
  version: '0.1.0',
  session: 'session-1',
  platform: 'browser',
  build: 'dev',
  time: '2026-11-22T00:00:00.000Z',
}

const recordText = (code) => serializeRecord(toRecord({ code, severity: 'error' }, CONTEXT))

const entry = (level, text) => ({ level, text })
const recordEntry = (code, level = 'error') => entry(level, recordText(code))

const readText = (relativePath) =>
  readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8')

describe('checkDiagnostics: coded records', () => {
  it('passes a test whose only records are expected', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry('FILE_NOT_JSON')],
      expected: ['FILE_NOT_JSON'],
    })

    expect(failures).toEqual([])
  })

  it('ignores console.log text that is not a record', () => {
    const failures = checkDiagnostics({ entries: [entry('log', 'hello')], expected: [] })

    expect(failures).toEqual([])
  })

  it('ignores console.info text that is not a record', () => {
    const failures = checkDiagnostics({ entries: [entry('info', 'hello')], expected: [] })

    expect(failures).toEqual([])
  })

  it('fails an undeclared code with its severity and catalog fix line', () => {
    const failures = checkDiagnostics({ entries: [recordEntry('STEP_ID_MISSING')], expected: [] })

    expect(failures).toEqual([
      `unexpected STEP_ID_MISSING (${catalog.STEP_ID_MISSING.severity}): ${catalog.STEP_ID_MISSING.fix}`,
    ])
  })

  it('fails an undeclared hint record written to console.info', () => {
    const hintCode = 'TEST_ONLY_HINT'
    catalog[hintCode] = { code: hintCode, severity: 'hint', fix: 'Do the hinted thing.' }
    try {
      const failures = checkDiagnostics({
        entries: [recordEntry(hintCode, 'info')],
        expected: [],
      })

      expect(failures).toEqual([`unexpected ${hintCode} (hint): Do the hinted thing.`])
    } finally {
      delete catalog[hintCode]
    }
  })

  it('fails a code the test declared a different code for', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry('FILE_NOT_JSON')],
      expected: ['FILE_NOT_A_PROJECT'],
    })

    expect(failures).toEqual([
      `unexpected FILE_NOT_JSON (error): ${catalog.FILE_NOT_JSON.fix}`,
      'expected FILE_NOT_A_PROJECT was not seen',
    ])
  })

  it('names a code that is not in the catalog, without throwing', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry('NOT_IN_CATALOG')],
      expected: [],
    })

    expect(failures).toEqual(['unknown code NOT_IN_CATALOG'])
  })

  it('fails an unknown code even when the test declared it', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry('NOT_IN_CATALOG')],
      expected: ['NOT_IN_CATALOG'],
    })

    expect(failures).toEqual(['unknown code NOT_IN_CATALOG'])
  })

  it('does not treat an inherited property name as a catalog code', () => {
    const failures = checkDiagnostics({ entries: [recordEntry('toString')], expected: [] })

    expect(failures).toEqual(['unknown code toString'])
  })

  it('fails a declared code that was never written', () => {
    const failures = checkDiagnostics({ entries: [], expected: ['FILE_NOT_JSON'] })

    expect(failures).toEqual(['expected FILE_NOT_JSON was not seen'])
  })

  it('counts a record on any console level as seen', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry('FILE_NOT_JSON', 'log')],
      expected: ['FILE_NOT_JSON'],
    })

    expect(failures).toEqual([])
  })

  it('prints one line per problem, in console order and then declared order', () => {
    const failures = checkDiagnostics({
      entries: [entry('error', 'boom'), recordEntry('STEP_ID_MISSING')],
      expected: ['FILE_NOT_JSON'],
    })

    expect(failures).toEqual([
      'uncoded error: boom',
      `unexpected STEP_ID_MISSING (error): ${catalog.STEP_ID_MISSING.fix}`,
      'expected FILE_NOT_JSON was not seen',
    ])
  })
})

describe('checkDiagnostics: uncoded console output', () => {
  it('fails an uncoded console.error with its text', () => {
    const failures = checkDiagnostics({
      entries: [entry('error', 'something broke')],
      expected: [],
    })

    expect(failures).toEqual(['uncoded error: something broke'])
  })

  it('fails an uncoded console.warn with its text', () => {
    const failures = checkDiagnostics({ entries: [entry('warn', 'something broke')], expected: [] })

    expect(failures).toEqual(['uncoded warn: something broke'])
  })

  it('fails a JSON console.error that is not an aie record', () => {
    const failures = checkDiagnostics({
      entries: [entry('error', '{"source":"other","code":"FILE_NOT_JSON"}')],
      expected: ['FILE_NOT_JSON'],
    })

    expect(failures).toEqual([
      'uncoded error: {"source":"other","code":"FILE_NOT_JSON"}',
      'expected FILE_NOT_JSON was not seen',
    ])
  })
})

describe('checkDiagnostics: page errors', () => {
  const UNCAUGHT = 'APP_UNCAUGHT_ERROR'
  const REJECTION = 'APP_UNHANDLED_REJECTION'

  it('fails a page error when the test declared no codes', () => {
    const failures = checkDiagnostics({ entries: [], pageErrors: ['boom'], expected: [] })

    expect(failures).toEqual(['page error: boom'])
  })

  it('passes a page error paired with an expected APP_UNCAUGHT_ERROR record', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry(UNCAUGHT)],
      pageErrors: ['boom'],
      expected: [UNCAUGHT],
    })

    expect(failures).toEqual([])
  })

  it('passes a page error paired with an expected APP_UNHANDLED_REJECTION record', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry(REJECTION)],
      pageErrors: ['rejected'],
      expected: [REJECTION],
    })

    expect(failures).toEqual([])
  })

  it('lets one record cover only one page error', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry(UNCAUGHT)],
      pageErrors: ['first', 'second'],
      expected: [UNCAUGHT],
    })

    expect(failures).toEqual(['page error: second'])
  })

  it('lets two records cover two page errors', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry(UNCAUGHT), recordEntry(REJECTION)],
      pageErrors: ['first', 'second'],
      expected: [UNCAUGHT, REJECTION],
    })

    expect(failures).toEqual([])
  })

  it('does not let a record of a code the test did not declare cover a page error', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry(UNCAUGHT)],
      pageErrors: ['boom'],
      expected: [],
    })

    expect(failures).toEqual([
      `unexpected ${UNCAUGHT} (error): ${catalog[UNCAUGHT].fix}`,
      'page error: boom',
    ])
  })

  it('does not let a record of another expected code cover a page error', () => {
    const failures = checkDiagnostics({
      entries: [recordEntry('FILE_NOT_JSON')],
      pageErrors: ['boom'],
      expected: ['FILE_NOT_JSON'],
    })

    expect(failures).toEqual(['page error: boom'])
  })

  it('treats a missing pageErrors list as none', () => {
    const failures = checkDiagnostics({ entries: [], expected: [] })

    expect(failures).toEqual([])
  })
})

describe('checkDiagnostics: no global suppression (AC11)', () => {
  it.each(['allow', 'allowList', 'ignore', 'catalog'])('throws on the key %s', (key) => {
    expect(() => checkDiagnostics({ entries: [], expected: [], [key]: ['FILE_NOT_JSON'] })).toThrow(
      key,
    )
  })

  it('throws on a key even when it is the only extra one among valid keys', () => {
    expect(() =>
      checkDiagnostics({ entries: [], pageErrors: [], expected: [], extra: true }),
    ).toThrow('extra')
  })

  it.each(['src/flow/diagnostics/gate.js'])(
    'keeps %s free of environment reads and the file system',
    (path) => {
      const text = readText(path)

      expect(text).not.toContain('process.env')
      expect(text).not.toContain('import.meta.env')
      expect(text).not.toMatch(/['"](node:)?fs(\/promises)?['"]/)
    },
  )
})
