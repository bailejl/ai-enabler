import { describe, expect, it } from 'vitest'
import { contentHash } from './contentHash.js'
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

const parse = async (file, settings) => parseImport(JSON.stringify(file), settings)

const fixtures = import.meta.glob('./schema/fixtures/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const fixtureVersions = Object.keys(fixtures).map((path) => path.match(/([^/]+)\.json$/)[1])

describe('parseImport', () => {
  it('accepts a valid file at the current version and returns it unchanged', async () => {
    const file = validFile()
    expect(await parse(file)).toEqual({ ok: true, file, edited: true })
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
    ])('%s', async (_name, text) => {
      expect(await parseImport(text)).toEqual({ ok: false, message: NOT_A_PROJECT_FILE })
    })
  })

  it('rejects text that is not JSON', async () => {
    expect(await parseImport('this is not json')).toEqual({
      ok: false,
      message: 'This file is not valid JSON.',
    })
  })

  it('rejects empty text as not JSON', async () => {
    expect(await parseImport('')).toEqual({ ok: false, message: 'This file is not valid JSON.' })
  })

  it('reports only the version message for a newer schema with a bad step', async () => {
    const file = validFile({
      schemaVersion: '9.0.0',
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition(step('c', 'Build'))],
    })
    expect(await parse(file)).toEqual({
      ok: false,
      message: `This file uses schema 9.0.0; this app supports up to ${CURRENT_SCHEMA_VERSION}. Update the app or re-export the file.`,
    })
  })

  it('names a step with no position by label and number', async () => {
    const file = validFile({
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition(step('c', 'Build'))],
    })
    expect(await parse(file)).toEqual({
      ok: false,
      message: 'Step "Build" (#3) is missing a position.',
    })
  })

  it('names a step with no label by number only', async () => {
    const file = validFile({
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition({ ...step('c'), data: {} })],
    })
    expect(await parse(file)).toEqual({ ok: false, message: 'Step #3 is missing a position.' })
  })

  it('rejects connections that form a loop', async () => {
    const file = validFile({
      edges: [
        { id: 'a->b', source: 'a', target: 'b' },
        { id: 'b->c', source: 'b', target: 'c' },
        { id: 'c->a', source: 'c', target: 'a' },
      ],
    })
    expect(await parse(file)).toEqual({ ok: false, message: 'The connections form a loop.' })
  })

  describe('with an injected version history', () => {
    const settings = { current: '0.2.0', released: ['0.0.0', '0.2.0'], registry: [] }

    it('rejects a lower version that was never released, naming both versions', async () => {
      expect(await parse(validFile({ schemaVersion: '0.1.0' }), settings)).toEqual({
        ok: false,
        message:
          'This file uses schema 0.1.0, which was never released; this app supports up to 0.2.0.',
      })
    })

    it('accepts a file at the injected current version', async () => {
      const file = validFile({ schemaVersion: '0.2.0' })
      expect(await parse(file, settings)).toEqual({ ok: true, file, edited: true })
    })

    it('reports a version above the injected current as newer', async () => {
      expect(await parse(validFile({ schemaVersion: '0.2.1' }), settings)).toEqual({
        ok: false,
        message:
          'This file uses schema 0.2.1; this app supports up to 0.2.0. Update the app or re-export the file.',
      })
    })

    it('upgrades a released older file through the registry, then validates it', async () => {
      const registry = [
        {
          from: '0.0.0',
          to: '0.2.0',
          upgrade: (file) => ({ ...file, project: { ...file.project, name: 'Upgraded' } }),
        },
      ]
      const result = await parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry })
      expect(result.ok).toBe(true)
      expect(result.file).toMatchObject({ schemaVersion: '0.2.0', project: { name: 'Upgraded' } })
    })

    it('validates the upgraded file, not the original', async () => {
      const registry = [
        {
          from: '0.0.0',
          to: '0.2.0',
          upgrade: (file) => ({ ...file, project: { ...file.project, name: '' } }),
        },
      ]
      expect(await parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry })).toEqual(
        {
          ok: false,
          message: 'The project name is empty.',
        },
      )
    })

    it('fails plainly when an upgrade throws', async () => {
      const registry = [
        {
          from: '0.0.0',
          to: '0.2.0',
          upgrade: () => {
            throw new Error('boom')
          },
        },
      ]
      expect(await parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry })).toEqual(
        {
          ok: false,
          message: 'This file could not be upgraded from schema 0.0.0 to 0.2.0.',
        },
      )
    })

    it('fails plainly when a released version has no upgrade path', async () => {
      expect(await parse(validFile({ schemaVersion: '0.0.0' }), settings)).toEqual({
        ok: false,
        message: 'This file uses schema 0.0.0, which this app cannot upgrade to 0.2.0.',
      })
    })
  })

  describe('edit detection', () => {
    const withHash = async (file) => ({ ...file, contentHash: await contentHash(file) })

    it('is not edited when the contentHash matches the file', async () => {
      const file = await withHash(validFile())
      expect(await parse(file)).toEqual({ ok: true, file, edited: false })
    })

    it('does not count the key order of the file', async () => {
      const { contentHash: hash, ...rest } = await withHash(validFile())
      const reordered = { ...Object.fromEntries(Object.entries(rest).reverse()), contentHash: hash }
      expect((await parse(reordered)).edited).toBe(false)
    })

    it.each([
      ['missing', async () => validFile()],
      ['a number', async () => validFile({ contentHash: 42 })],
      ['null', async () => validFile({ contentHash: null })],
      ['an empty string', async () => validFile({ contentHash: '' })],
      [
        'a hash of other contents',
        async () =>
          withHash(validFile({ exportedAt: 'earlier' })).then((other) => ({
            ...validFile(),
            contentHash: other.contentHash,
          })),
      ],
    ])('is edited when the contentHash is %s', async (_name, makeFile) => {
      expect((await parse(await makeFile())).edited).toBe(true)
    })

    it('is edited when a label changed after export', async () => {
      const exported = await withHash(validFile())
      const changed = { ...exported, nodes: [step('a', 'Plan B'), ...exported.nodes.slice(1)] }
      expect((await parse(changed)).edited).toBe(true)
    })

    describe('with a file the upgrade changes', () => {
      const settings = {
        current: '0.2.0',
        released: ['0.0.0', '0.2.0'],
        registry: [
          {
            from: '0.0.0',
            to: '0.2.0',
            upgrade: (file) => ({ ...file, project: { ...file.project, name: 'Upgraded' } }),
          },
        ],
      }

      it('checks the hash of the file as read, not of the upgraded file', async () => {
        const exported = await withHash(validFile({ schemaVersion: '0.0.0' }))
        const result = await parse(exported, settings)
        expect(result.file.project.name).toBe('Upgraded')
        expect(result.edited).toBe(false)
      })

      it('is edited when the file as read does not match', async () => {
        const exported = await withHash(validFile({ schemaVersion: '0.0.0' }))
        const result = await parse({ ...exported, exportedAt: 'later' }, settings)
        expect(result.edited).toBe(true)
      })
    })

    it('reports no edited flag for a rejected file', async () => {
      expect(await parse(validFile({ project: { id: 'p1', name: '' } }))).not.toHaveProperty(
        'edited',
      )
    })

    it('accepts a file whose contentHash is a number without rejecting it', async () => {
      expect((await parse(validFile({ contentHash: 42 }))).ok).toBe(true)
    })
  })

  describe('released fixtures', () => {
    it('finds at least one fixture to import', () => {
      expect(fixtureVersions.length).toBeGreaterThan(0)
    })

    it.each(fixtureVersions)('imports the %s fixture', async (version) => {
      const result = await parseImport(fixtures[`./schema/fixtures/${version}.json`])
      expect(result.ok).toBe(true)
      expect(result.file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it.each(fixtureVersions)('treats the %s fixture as untouched', async (version) => {
      const result = await parseImport(fixtures[`./schema/fixtures/${version}.json`])
      expect(result.edited).toBe(false)
    })
  })
})
