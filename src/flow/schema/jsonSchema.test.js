import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, it, expect } from 'vitest'
import projectSchema from '../../../public/schema/project-0.1.0.json'
import { initialEdges, initialNodes } from '../initialFlow.js'
import { createStarterProject } from '../project.js'
import { toProjectFile, withContentHash } from '../projectFile.js'
import { STEP_DATA_FIELDS } from '../step.js'
import { markWith, PUBLISHED_SCHEMA_URL } from './testHelpers.js'
import { validateProjectFile } from './validate.js'

const ajv = addFormats(new Ajv2020({ allErrors: true }))
const checkSchema = ajv.compile(projectSchema)

// Fixtures are read here only, so the app bundle never includes them. Raw fixtures are what a
// released version wrote; expected/ holds each one upgraded to 0.1.0.
const byName = (files) =>
  Object.fromEntries(
    Object.entries(files).map(([path, fixture]) => [path.match(/([^/]+)\.json$/)[1], fixture]),
  )
const rawFixtures = byName(
  import.meta.glob('./fixtures/*.json', { eager: true, import: 'default' }),
)
const upgradedFixtures = byName(
  import.meta.glob('./fixtures/expected/*.json', { eager: true, import: 'default' }),
)

// The starter map exported the way the app exports it.
const starterExport = () =>
  withContentHash(
    toProjectFile({
      project: createStarterProject({ newId: () => 'starter-project' }),
      nodes: initialNodes,
      edges: initialEdges,
      now: new Date('2026-11-14T12:00:00.000Z'),
    }),
  )

const rejectedBySchema = (file) => !checkSchema(file)

describe('the project JSON Schema, 0.1.0', () => {
  it('declares draft 2020-12, the Pages URL and schemaVersion 0.1.0', () => {
    expect(projectSchema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: PUBLISHED_SCHEMA_URL,
      properties: { schemaVersion: { const: '0.1.0' } },
    })
  })

  it('describes exactly the step data fields the app knows, STEP_DATA_FIELDS', () => {
    expect(
      Object.keys(projectSchema.properties.nodes.items.properties.data.properties).toSorted(),
    ).toEqual(STEP_DATA_FIELDS.toSorted())
  })

  it.each(Object.entries(upgradedFixtures))('accepts the upgraded fixture %s', (_name, file) => {
    expect(checkSchema(file)).toBe(true)
  })

  it.each(['0.1.0', '0.1.0-marked'])('accepts the raw fixture %s', (name) => {
    expect(checkSchema(rawFixtures[name])).toBe(true)
  })

  it('accepts the starter export', async () => {
    expect(checkSchema(await starterExport())).toBe(true)
  })

  it('accepts unknown top-level fields', () => {
    expect(checkSchema({ ...rawFixtures['0.1.0'], extra: { anything: [1] } })).toBe(true)
  })

  it('accepts a 0-length step label, as the app does', () => {
    const file = structuredClone(rawFixtures['0.1.0'])
    file.nodes[0].data.label = ''
    expect(checkSchema(file)).toBe(true)
    expect(validateProjectFile(file).ok).toBe(true)
  })

  it('rejects a raw 0.0.0 file for its schema version', () => {
    expect(checkSchema(rawFixtures['0.0.0'])).toBe(false)
    expect(checkSchema.errors).toMatchObject([{ instancePath: '/schemaVersion', keyword: 'const' }])
  })
})

const withEdit = (edit) => {
  const file = structuredClone(rawFixtures['0.1.0'])
  edit(file)
  return file
}

describe('the JSON Schema and the validator agree on field rules', () => {
  it.each([
    ['a ca of 101', withEdit((f) => (f.nodes[0].data.ca = 101))],
    ['a ca of -0.5', withEdit((f) => (f.nodes[0].data.ca = -0.5))],
    ['a fractional queue', withEdit((f) => (f.nodes[0].data.queue = 1.5))],
    ['a text batch', withEdit((f) => (f.nodes[0].data.batch = '3'))],
    ['a blank project name', withEdit((f) => (f.project.name = '  '))],
    ['a step with no y', withEdit((f) => delete f.nodes[0].position.y)],
    ['a step of type box', withEdit((f) => (f.nodes[0].type = 'box'))],
    ['an AI mark tool with a space', withEdit((f) => (f.modifiedBy = markWith({ tool: 'a b' })))],
    [
      'an AI mark tool of 41 characters',
      withEdit((f) => (f.modifiedBy = markWith({ tool: 'a'.repeat(41) }))),
    ],
    [
      'an AI mark time with no zone',
      withEdit((f) => (f.modifiedBy = markWith({ at: '2026-11-20T09:30:00' }))),
    ],
    ['a connection with no id', withEdit((f) => delete f.edges[0].id)],
  ])('rejects %s', (_defect, file) => {
    expect(rejectedBySchema(file)).toBe(true)
    expect(validateProjectFile(file).ok).toBe(false)
  })

  it.each([
    [
      'a ca of 0 and of 100',
      withEdit((f) => {
        f.nodes[0].data.ca = 0
        f.nodes[1].data.ca = 100
      }),
    ],
    ['a step with no type', withEdit((f) => delete f.nodes[0].type)],
    ['a step with no metrics', withEdit((f) => (f.nodes[0].data = { label: 'Idea' }))],
    [
      'a mark tool of 40 characters',
      withEdit((f) => (f.modifiedBy = markWith({ tool: 'a'.repeat(40) }))),
    ],
    [
      'a mark time with an offset',
      withEdit((f) => (f.modifiedBy = markWith({ at: '2026-11-20T09:30:00+02:00' }))),
    ],
    ['a whitespace-only project id', withEdit((f) => (f.project.id = ' '))],
    ['a content hash that is not sha256', withEdit((f) => (f.contentHash = 'md5-abc'))],
    ['an export time that is not a date', withEdit((f) => (f.exportedAt = 'yesterday'))],
  ])('accepts %s', (_what, file) => {
    expect(checkSchema(file)).toBe(true)
    expect(validateProjectFile(file).ok).toBe(true)
  })
})

describe('files rejected by both the JSON Schema and the validator', () => {
  const base = () => structuredClone(rawFixtures['0.1.0'])
  const withoutProjectId = () => {
    const file = base()
    delete file.project.id
    return file
  }
  const withPt = (pt) => {
    const file = base()
    file.nodes[0].data.pt = pt
    return file
  }

  it.each([
    ['steps that are a string', { ...base(), nodes: 'Idea' }],
    ['no project id', withoutProjectId()],
    ['a pt of -1', withPt(-1)],
    ['a malformed AI mark', { ...base(), modifiedBy: { tool: '', at: 'soon' } }],
  ])('rejects %s', (_defect, file) => {
    expect(rejectedBySchema(file)).toBe(true)
    expect(validateProjectFile(file).ok).toBe(false)
  })
})
