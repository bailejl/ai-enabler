import { describe, it, expect } from 'vitest'
import { shapeOf } from './shape.js'
import { CURRENT_SCHEMA_VERSION } from './version.js'
import { toProjectFile, withContentHash } from '../projectFile.js'
import { createStarterProject } from '../../testHelpers.js'
import { initialNodes, initialEdges } from '../initialFlow.js'

// The fixture is read here only, so the app bundle never includes it.
const fixtures = import.meta.glob('./fixtures/*.json', { eager: true, import: 'default' })
const currentFixture = fixtures[`./fixtures/${CURRENT_SCHEMA_VERSION}.json`]
const markedFixture = fixtures[`./fixtures/${CURRENT_SCHEMA_VERSION}-marked.json`]

describe('shapeOf', () => {
  it('lists each key path with its value type', () => {
    expect(shapeOf({ name: 'A', position: { x: 1 } })).toEqual([
      '$.name:string',
      '$.position.x:number',
      '$.position:object',
      '$:object',
    ])
  })

  it('ignores values', () => {
    expect(shapeOf({ a: 1, b: ['x'] })).toEqual(shapeOf({ a: 99, b: ['y', 'z'] }))
  })

  it.each([
    ['the element with the extra key first', [{ id: 'b', batch: 3 }, { id: 'a' }]],
    ['the element with the extra key last', [{ id: 'a' }, { id: 'b', batch: 3 }]],
  ])('unions the key paths of array elements with %s', (_name, value) => {
    expect(shapeOf(value)).toEqual(['$:array', '$[].batch:number', '$[].id:string', '$[]:object'])
  })

  it('records every type an array element key takes', () => {
    expect(shapeOf([{ id: 'a' }, { id: 1 }])).toEqual([
      '$:array',
      '$[].id:number',
      '$[].id:string',
      '$[]:object',
    ])
  })

  it('records an empty array as an array', () => {
    expect(shapeOf({ edges: [] })).toEqual(['$.edges:array', '$:object'])
  })

  it.each([
    ['null', null, '$:null'],
    ['array', [], '$:array'],
    ['boolean', true, '$:boolean'],
    ['number', 1.5, '$:number'],
  ])('types %s', (_name, value, entry) => {
    expect(shapeOf(value)).toEqual([entry])
  })

  it('differs when a key is added', () => {
    expect(shapeOf({ a: 1, b: 2 })).not.toEqual(shapeOf({ a: 1 }))
  })

  it('differs when a key is removed', () => {
    expect(shapeOf({ a: 1 })).not.toEqual(shapeOf({ a: 1, b: 2 }))
  })

  it('differs when a key changes type', () => {
    expect(shapeOf({ a: '1' })).not.toEqual(shapeOf({ a: 1 }))
  })
})

describe('export shape of the current schema version', () => {
  const starterExport = () =>
    withContentHash(
      toProjectFile({
        project: createStarterProject({ newId: () => 'starter-project' }),
        nodes: initialNodes,
        edges: initialEdges,
        now: new Date('2026-11-14T12:00:00.000Z'),
      }),
    )

  it('has a fixture for the current version', () => {
    expect(currentFixture).toBeDefined()
  })

  it('has a marked fixture that adds only the modifiedBy mark to the current fixture', () => {
    const markPaths = ['$.modifiedBy.at:string', '$.modifiedBy.tool:string', '$.modifiedBy:object']
    expect(shapeOf(markedFixture)).toEqual([...shapeOf(currentFixture), ...markPaths].sort())
  })

  it('matches the starter project export', async () => {
    expect(shapeOf(await starterExport())).toEqual(shapeOf(currentFixture))
  })

  const starterShape = async () => shapeOf(await starterExport())

  it.each([
    ['gains a key', (file) => ({ ...file, notes: 'new' })],
    [
      'gains a node key',
      (file) => ({ ...file, nodes: file.nodes.map((n) => ({ ...n, color: 'red' })) }),
    ],
    ['loses a key', (file) => ({ ...file, project: { id: file.project.id } })],
    [
      'loses a node key',
      (file) => ({
        ...file,
        nodes: file.nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      }),
    ],
    [
      'gains an edge key',
      (file) => ({ ...file, edges: file.edges.map((e) => ({ ...e, label: 'new' })) }),
    ],
    [
      'loses an edge key',
      (file) => ({ ...file, edges: file.edges.map((e) => ({ id: e.id, source: e.source })) }),
    ],
    ['retypes a key', (file) => ({ ...file, schemaVersion: 0 })],
    ['loses the contentHash', ({ contentHash: _hash, ...file }) => file],
    [
      'retypes a node key',
      (file) => ({ ...file, nodes: file.nodes.map((n) => ({ ...n, position: [n.position.x] })) }),
    ],
  ])('fails when the export %s', async (_name, change) => {
    expect(shapeOf(change(await starterExport()))).not.toEqual(await starterShape())
  })
})
