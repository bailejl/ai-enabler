import { describe, expect, it } from 'vitest'
import catalog from './catalog.json' with { type: 'json' }
import { CATALOG_CODES, isCatalogCode, problem } from './problem.js'

describe('problem', () => {
  it('returns code, severity, message and fix from the catalog for a known code', () => {
    expect(problem('FILE_NOT_JSON')).toEqual({
      code: 'FILE_NOT_JSON',
      severity: 'error',
      message: 'This file is not valid JSON.',
      fix: 'Choose a file exported from AI Enabler, or repair the JSON syntax.',
    })
  })

  it('throws on a code that is not in the catalog', () => {
    expect(() => problem('FILE_MADE_UP')).toThrow('Unknown diagnostic code: FILE_MADE_UP')
  })

  it('throws on inherited object keys that are not catalog codes', () => {
    expect(() => problem('toString')).toThrow('Unknown diagnostic code')
  })

  it('fills the message template from params', () => {
    const result = problem('STEP_COUNT_INVALID', {
      params: { step: 'Step "Plan" (#2)', fieldLabel: 'process time', field: 'pt' },
    })
    expect(result.message).toBe(
      'Step "Plan" (#2): process time (pt) must be a whole number, 0 or more.',
    )
  })

  it('fills every placeholder in the template', () => {
    expect(
      problem('FILE_NEWER_SCHEMA', { params: { version: '9.0.0', current: '0.1.0' } }).message,
    ).toBe('This file uses schema 9.0.0; this app supports up to 0.1.0.')
  })

  it('leaves a placeholder as written when its value is missing, without throwing', () => {
    const result = problem('STEP_ID_MISSING', { params: {} })
    expect(result.message).toBe('{step} is missing an id (id).')
  })

  it('leaves placeholders as written when no params are given', () => {
    expect(problem('STEP_ID_MISSING').message).toBe('{step} is missing an id (id).')
  })

  it('does not expand a placeholder that appears inside a param value', () => {
    const result = problem('STEP_ID_MISSING', { params: { step: 'Step "{id}" (#1)', id: 'x' } })
    expect(result.message).toBe('Step "{id}" (#1) is missing an id (id).')
  })

  it('carries stepId, edgeId, field and untrusted through unchanged', () => {
    const untrusted = { title: 'Plan <script>' }
    const result = problem('STEP_COUNT_INVALID', {
      stepId: 's2',
      edgeId: 'e1',
      field: 'pt',
      untrusted,
      params: { step: 'x', fieldLabel: 'process time', field: 'pt' },
    })
    expect(result).toMatchObject({ stepId: 's2', edgeId: 'e1', field: 'pt', untrusted })
  })

  it('does not keep params on the result', () => {
    expect(problem('STEP_ID_MISSING', { params: { step: 'A' } })).not.toHaveProperty('params')
  })

  it('names every unknown detail key in the error', () => {
    expect(() => problem('FILE_NOT_JSON', { a: 1, b: 2 })).toThrow('Unknown problem detail: a, b')
  })

  it.each(['code', 'severity', 'message', 'fix', 'extra'])(
    'throws when details carry the key "%s"',
    (key) => {
      expect(() => problem('FILE_NOT_JSON', { [key]: 'injected' })).toThrow(
        `Unknown problem detail: ${key}`,
      )
    },
  )
})

describe('catalog', () => {
  const REQUIRED_FIELDS = [
    'code',
    'severity',
    'title',
    'summary',
    'message',
    'fix',
    'docs',
    'owner',
    'status',
    'since',
  ]
  const AREAS = ['FILE_', 'STEP_', 'CONN_', 'MARK_', 'CMD_', 'GATE_', 'APP_', 'STORE_']
  const SEVERITIES = ['error', 'warning', 'hint']
  const APP_CODES = ['APP_RENDER_FAILED', 'APP_UNCAUGHT_ERROR', 'APP_UNHANDLED_REJECTION']
  const docsAnchor = (code) => `#${code.toLowerCase().replaceAll('_', '-')}`
  const entries = Object.entries(catalog)
  const entriesWithUnknownSeverity = (candidates) =>
    candidates.filter(([, entry]) => !SEVERITIES.includes(entry.severity))

  it.each(entries)('%s has every required field as a non-empty string', (_code, entry) => {
    const missing = REQUIRED_FIELDS.filter(
      (field) => typeof entry[field] !== 'string' || entry[field].trim() === '',
    )
    expect(missing).toEqual([])
  })

  it.each(entries)('%s is keyed by its own code', (key, entry) => {
    expect(entry.code).toBe(key)
  })

  it.each(entries)('%s is UPPER_SNAKE with an area prefix', (code) => {
    expect(code).toMatch(/^[A-Z]+(_[A-Z0-9]+)+$/)
    expect(AREAS.some((area) => code.startsWith(area))).toBe(true)
  })

  it.each(entries)('%s has a one-line summary and fix and a docs anchor', (code, entry) => {
    expect(entry.summary).not.toMatch(/\n/)
    expect(entry.fix).not.toMatch(/\n/)
    expect(entry.docs).toBe(docsAnchor(code))
  })

  it('has no duplicate codes', () => {
    const codes = entries.map(([, entry]) => entry.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('uses error, warning or hint severity for every entry', () => {
    expect(entriesWithUnknownSeverity(entries)).toEqual([])
  })

  it('accepts entries with warning and hint severity', () => {
    const accepted = SEVERITIES.map((severity) => [`FILE_${severity}`, { severity }])
    expect(entriesWithUnknownSeverity(accepted)).toEqual([])
  })

  it.each(['debug', 'Error', ''])('reports an entry whose severity is %j', (severity) => {
    const badEntry = ['FILE_BAD', { code: 'FILE_BAD', severity }]
    expect(entriesWithUnknownSeverity([...entries, badEntry])).toEqual([badEntry])
  })

  it.each(APP_CODES)('%s is an active app-owned error since 0.1.0', (code) => {
    expect(catalog[code]).toMatchObject({
      code,
      severity: 'error',
      owner: 'app',
      status: 'active',
      since: '0.1.0',
      docs: docsAnchor(code),
    })
  })

  it('lists exactly the catalog codes in CATALOG_CODES', () => {
    expect(CATALOG_CODES).toEqual(Object.keys(catalog))
  })

  it('recognises catalog codes and rejects others with isCatalogCode', () => {
    expect(isCatalogCode('CONN_LOOP')).toBe(true)
    expect(isCatalogCode('CONN_NOPE')).toBe(false)
    expect(isCatalogCode(undefined)).toBe(false)
  })

  it.each(entries)('%s builds a problem from its own template', (code) => {
    expect(problem(code).code).toBe(code)
  })
})
