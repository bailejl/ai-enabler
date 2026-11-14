import { describe, expect, it } from 'vitest'
import { parseImport } from './importFile.js'
import { CURRENT_SCHEMA_VERSION } from './schema/version.js'

const NOT_A_PROJECT_FILE = 'This is not a project file. Choose a file exported from AI Enabler.'

const step = (id, label, extra = {}) => ({
  id,
  type: 'step',
  position: { x: 0, y: 0 },
  data: { label },
  ...extra,
})

const validFile = (overrides = {}) => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  exportedAt: '2026-11-14T12:00:00.000Z',
  project: { id: 'p1', name: 'Checkout' },
  nodes: [step('a', 'Plan'), step('b', 'Design'), step('c', 'Build')],
  edges: [{ id: 'a->b', source: 'a', target: 'b' }],
  ...overrides,
})

const withoutPosition = (node) =>
  Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'position'))

const parse = (file, settings) => parseImport(JSON.stringify(file), settings)

const fixtures = import.meta.glob('./schema/fixtures/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const fixtureVersions = Object.keys(fixtures).map((path) => path.match(/([^/]+)\.json$/)[1])

describe('parseImport', () => {
  it('accepts a valid file at the current version and returns it unchanged', () => {
    const file = validFile()
    expect(parse(file)).toEqual({ ok: true, file })
  })

  describe('rejects files that are not project files', () => {
    it.each([
      ['an array', JSON.stringify([validFile()])],
      ['a file with no schemaVersion', JSON.stringify(validFile({ schemaVersion: undefined }))],
      ['a number', '42'],
      ['a string', '"hello"'],
      ['null', 'null'],
      ['a numeric schemaVersion', JSON.stringify(validFile({ schemaVersion: 1 }))],
      ['a schemaVersion with a v prefix', JSON.stringify(validFile({ schemaVersion: 'v1.0.0' }))],
    ])('%s', (_name, text) => {
      expect(parseImport(text)).toEqual({ ok: false, message: NOT_A_PROJECT_FILE })
    })
  })

  it('rejects text that is not JSON', () => {
    expect(parseImport('this is not json')).toEqual({
      ok: false,
      message: 'This file is not valid JSON.',
    })
  })

  it('rejects empty text as not JSON', () => {
    expect(parseImport('')).toEqual({ ok: false, message: 'This file is not valid JSON.' })
  })

  it('reports only the version message for a newer schema with a bad step', () => {
    const file = validFile({
      schemaVersion: '9.0.0',
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition(step('c', 'Build'))],
    })
    expect(parse(file)).toEqual({
      ok: false,
      message:
        'This file uses schema 9.0.0; this app supports up to 0.0.0. Update the app or re-export the file.',
    })
  })

  it('names a step with no position by label and number', () => {
    const file = validFile({
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition(step('c', 'Build'))],
    })
    expect(parse(file)).toEqual({
      ok: false,
      message: 'Step "Build" (#3) is missing a position.',
    })
  })

  it('names a step with no label by number only', () => {
    const file = validFile({
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition({ ...step('c'), data: {} })],
    })
    expect(parse(file)).toEqual({ ok: false, message: 'Step #3 is missing a position.' })
  })

  it('rejects connections that form a loop', () => {
    const file = validFile({
      edges: [
        { id: 'a->b', source: 'a', target: 'b' },
        { id: 'b->c', source: 'b', target: 'c' },
        { id: 'c->a', source: 'c', target: 'a' },
      ],
    })
    expect(parse(file)).toEqual({ ok: false, message: 'The connections form a loop.' })
  })

  describe('with an injected version history', () => {
    const settings = { current: '0.2.0', released: ['0.0.0', '0.2.0'], registry: [] }

    it('rejects a lower version that was never released, naming both versions', () => {
      expect(parse(validFile({ schemaVersion: '0.1.0' }), settings)).toEqual({
        ok: false,
        message:
          'This file uses schema 0.1.0, which was never released; this app supports up to 0.2.0.',
      })
    })

    it('accepts a file at the injected current version', () => {
      const file = validFile({ schemaVersion: '0.2.0' })
      expect(parse(file, settings)).toEqual({ ok: true, file })
    })

    it('reports a version above the injected current as newer', () => {
      expect(parse(validFile({ schemaVersion: '0.2.1' }), settings)).toEqual({
        ok: false,
        message:
          'This file uses schema 0.2.1; this app supports up to 0.2.0. Update the app or re-export the file.',
      })
    })

    it('upgrades a released older file through the registry, then validates it', () => {
      const registry = [
        {
          from: '0.0.0',
          to: '0.2.0',
          upgrade: (file) => ({ ...file, project: { ...file.project, name: 'Upgraded' } }),
        },
      ]
      const result = parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry })
      expect(result.ok).toBe(true)
      expect(result.file).toMatchObject({ schemaVersion: '0.2.0', project: { name: 'Upgraded' } })
    })

    it('validates the upgraded file, not the original', () => {
      const registry = [
        {
          from: '0.0.0',
          to: '0.2.0',
          upgrade: (file) => ({ ...file, project: { ...file.project, name: '' } }),
        },
      ]
      expect(parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry })).toEqual({
        ok: false,
        message: 'The project name is empty.',
      })
    })

    it('fails plainly when an upgrade throws', () => {
      const registry = [
        {
          from: '0.0.0',
          to: '0.2.0',
          upgrade: () => {
            throw new Error('boom')
          },
        },
      ]
      expect(parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry })).toEqual({
        ok: false,
        message: 'This file could not be upgraded from schema 0.0.0 to 0.2.0.',
      })
    })

    it('fails plainly when a released version has no upgrade path', () => {
      expect(parse(validFile({ schemaVersion: '0.0.0' }), settings)).toEqual({
        ok: false,
        message: 'This file uses schema 0.0.0, which this app cannot upgrade to 0.2.0.',
      })
    })
  })

  describe('released fixtures', () => {
    it('finds at least one fixture to import', () => {
      expect(fixtureVersions.length).toBeGreaterThan(0)
    })

    it.each(fixtureVersions)('imports the %s fixture', (version) => {
      const result = parseImport(fixtures[`./schema/fixtures/${version}.json`])
      expect(result.ok).toBe(true)
      expect(result.file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })
  })
})
