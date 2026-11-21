import { describe, expect, it } from 'vitest'
import { contentHash } from './contentHash.js'
import { isCatalogCode } from './diagnostics/problem.js'
import { parseImport, unreadableImport } from './importFile.js'
import { CURRENT_SCHEMA_VERSION } from './schema/version.js'

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

// Rejected imports are checked through these, so every emitted code is proven to be in the catalog.
const rejectedProblems = (result) => {
  expect(result.ok).toBe(false)
  result.problems.forEach((found) => expect(isCatalogCode(found.code)).toBe(true))
  return result.problems
}

const codesOf = (result) => rejectedProblems(result).map((found) => found.code)

const fixtures = import.meta.glob('./schema/fixtures/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const e2eFixtures = import.meta.glob('../../e2e/fixtures/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const fixtureVersions = Object.keys(fixtures).map((path) => path.match(/([^/]+)\.json$/)[1])

describe('parseImport', () => {
  it('accepts a valid file at the current version, flagging it edited since it has no hash, and returns it unchanged', async () => {
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
      expect(codesOf(await parseImport(text))).toEqual(['FILE_NOT_A_PROJECT'])
    })
  })

  it('rejects text that is not JSON', async () => {
    expect(codesOf(await parseImport('this is not json'))).toEqual(['FILE_NOT_JSON'])
  })

  it('rejects empty text as not JSON', async () => {
    expect(codesOf(await parseImport(''))).toEqual(['FILE_NOT_JSON'])
  })

  it('reports only the newer-schema problem for a newer schema with a bad step', async () => {
    const file = validFile({
      schemaVersion: '9.0.0',
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition(step('c', 'Build'))],
    })
    const problems = rejectedProblems(await parse(file))
    expect(problems.map((found) => found.code)).toEqual(['FILE_NEWER_SCHEMA'])
    expect(problems[0].message).toContain('9.0.0')
    expect(problems[0].message).toContain(CURRENT_SCHEMA_VERSION)
  })

  it('names a step with no position by label and number', async () => {
    const file = validFile({
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition(step('c', 'Build'))],
    })
    const problems = rejectedProblems(await parse(file))
    expect(problems).toHaveLength(1)
    expect(problems[0].message).toContain('Step "Build" (#3)')
  })

  it('names a step with no label by number only', async () => {
    const file = validFile({
      nodes: [step('a', 'Plan'), step('b', 'Design'), withoutPosition({ ...step('c'), data: {} })],
    })
    const problems = rejectedProblems(await parse(file))
    expect(problems.map((found) => found.code)).toEqual([
      'STEP_POSITION_MISSING',
      'STEP_LABEL_MISSING',
    ])
    expect(problems.filter((found) => !found.message.startsWith('Step #3 '))).toEqual([])
  })

  it('passes every validator problem through, not only the first', async () => {
    const file = validFile({
      project: { id: 'p1', name: '' },
      nodes: [withoutPosition(step('a', 'Plan')), step('b', 'Design'), withoutPosition(step('c'))],
    })
    const problems = rejectedProblems(await parse(file))
    expect(problems.map((found) => found.code)).toEqual([
      'FILE_PROJECT_NAME_EMPTY',
      'STEP_POSITION_MISSING',
      'STEP_POSITION_MISSING',
      'STEP_LABEL_MISSING',
    ])
    expect(new Set(problems.map((found) => found.message)).size).toBe(problems.length)
  })

  // AC17: a file's claim to have been made by AI tools never skips validation.
  it('rejects an invalid file that carries an AI mark and lists every problem', async () => {
    const file = validFile({
      modifiedBy: { tool: 'aie-mcp', at: '2026-11-21T00:00:00.000Z' },
      project: { id: 'p1', name: '' },
      nodes: [withoutPosition(step('a', 'Plan')), step('b', 'Design')],
    })
    expect(codesOf(await parse(file))).toEqual(['FILE_PROJECT_NAME_EMPTY', 'STEP_POSITION_MISSING'])
  })

  // More problems than a function call can take as spread arguments.
  it('rejects a file with a very large number of problems without throwing', async () => {
    const BARE_STEPS = 60_000
    const file = validFile({ nodes: Array.from({ length: BARE_STEPS }, () => ({})), edges: [] })
    const result = await parse(file)
    expect(result.ok).toBe(false)
    expect(result.problems.length).toBeGreaterThan(BARE_STEPS * 2)
  })

  it('rejects connections that form a loop', async () => {
    const file = validFile({
      edges: [
        { id: 'a->b', source: 'a', target: 'b' },
        { id: 'b->c', source: 'b', target: 'c' },
        { id: 'c->a', source: 'c', target: 'a' },
      ],
    })
    const problems = rejectedProblems(await parse(file))
    expect(problems).toHaveLength(1)
    expect(problems[0].message).toContain('Connection 3')
  })

  describe('with an injected version history', () => {
    const settings = { current: '0.2.0', released: ['0.0.0', '0.2.0'], registry: [] }

    it('rejects a lower version that was never released, naming both versions', async () => {
      const problems = rejectedProblems(
        await parse(validFile({ schemaVersion: '0.1.0' }), settings),
      )
      expect(problems.map((found) => found.code)).toEqual(['FILE_UNRELEASED_SCHEMA'])
      expect(problems[0].message).toContain('0.1.0')
      expect(problems[0].message).toContain('0.2.0')
    })

    it('accepts a file at the injected current version, flagging it edited since it has no hash', async () => {
      const file = validFile({ schemaVersion: '0.2.0' })
      expect(await parse(file, settings)).toEqual({ ok: true, file, edited: true })
    })

    it('reports a version above the injected current as newer', async () => {
      const problems = rejectedProblems(
        await parse(validFile({ schemaVersion: '0.2.1' }), settings),
      )
      expect(problems.map((found) => found.code)).toEqual(['FILE_NEWER_SCHEMA'])
      expect(problems[0].message).toContain('0.2.1')
      expect(problems[0].message).toContain('0.2.0')
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
      const result = await parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry })
      expect(codesOf(result)).toEqual(['FILE_PROJECT_NAME_EMPTY'])
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
      const problems = rejectedProblems(
        await parse(validFile({ schemaVersion: '0.0.0' }), { ...settings, registry }),
      )
      expect(problems.map((found) => found.code)).toEqual(['FILE_UPGRADE_FAILED'])
      expect(problems[0].message).toContain('0.0.0')
      expect(problems[0].message).toContain('0.2.0')
    })

    it('fails plainly when a released version has no upgrade path', async () => {
      const problems = rejectedProblems(
        await parse(validFile({ schemaVersion: '0.0.0' }), settings),
      )
      expect(problems.map((found) => found.code)).toEqual(['FILE_NO_UPGRADE_PATH'])
      expect(problems[0].message).toContain('0.0.0')
      expect(problems[0].message).toContain('0.2.0')
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

    it('rejects as unreadable instead of throwing when hashing fails', async () => {
      const digest = async () => {
        throw new Error('no crypto')
      }
      expect(codesOf(await parse(validFile(), { digest }))).toEqual(['FILE_UNREADABLE'])
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

  describe('e2e fixtures', () => {
    it('finds the e2e fixtures', () => {
      expect(Object.keys(e2eFixtures).length).toBeGreaterThan(0)
    })

    it.each(Object.entries(e2eFixtures))('treats %s as untouched', async (_path, text) => {
      expect((await parseImport(text)).edited).toBe(false)
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

describe('unreadableImport', () => {
  it('is a rejection with the one unreadable-file problem', () => {
    expect(unreadableImport()).toMatchObject({ ok: false, problems: [{ code: 'FILE_UNREADABLE' }] })
    expect(unreadableImport().problems).toHaveLength(1)
  })
})
