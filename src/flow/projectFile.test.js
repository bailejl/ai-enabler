import { describe, it, expect } from 'vitest'
import { contentHash } from './contentHash.js'
import { projectFileName, toProjectFile, withContentHash } from './projectFile.js'
import { validateProjectFile } from './schema/validate.js'
import { CURRENT_SCHEMA_VERSION } from './schema/version.js'
import { createStarterProject } from './project.js'
import { initialNodes, initialEdges } from './initialFlow.js'

const NOW = new Date('2026-11-14T12:30:45.123Z')
const PROJECT = { id: 'project-1', name: 'Delivery', extra: 'ignored' }

const runtimeNode = {
  id: 'build',
  position: { x: 200, y: 100 },
  data: { label: 'Build', pt: 480, lt: 1200, ca: 90, queue: 4, batch: 3, colour: 'red' },
  selected: true,
  measured: { width: 160, height: 80 },
  width: 160,
  height: 80,
  dragging: false,
  positionAbsolute: { x: 200, y: 100 },
}

const sortedKeys = (value) => Object.keys(value).sort()

const deepFreeze = (value) => {
  Object.values(value).forEach((child) => {
    if (typeof child === 'object' && child !== null) deepFreeze(child)
  })
  return Object.freeze(value)
}

const exportNodes = (nodes) => toProjectFile({ project: PROJECT, nodes, edges: [], now: NOW }).nodes

describe('withContentHash', () => {
  const file = () => toProjectFile({ project: PROJECT, nodes: [runtimeNode], edges: [], now: NOW })

  it('adds the hash of the file as a top-level contentHash', async () => {
    const hashed = await withContentHash(file())
    expect(hashed.contentHash).toBe(await contentHash(file()))
    expect(hashed.contentHash).toMatch(/^sha256-[0-9a-f]{64}$/)
  })

  it('keeps every other field of the file', async () => {
    expect(await withContentHash(file())).toEqual({ ...file(), contentHash: expect.any(String) })
  })

  it('does not change the file it was given', async () => {
    const original = deepFreeze(file())
    await withContentHash(original)
    expect(original).not.toHaveProperty('contentHash')
  })
})

describe('toProjectFile', () => {
  it('writes exactly the file fields', () => {
    const file = toProjectFile({ project: PROJECT, nodes: [], edges: [], now: NOW })
    expect(sortedKeys(file)).toEqual(['edges', 'exportedAt', 'nodes', 'project', 'schemaVersion'])
  })

  it('stamps the current schema version', () => {
    const file = toProjectFile({ project: PROJECT, nodes: [], edges: [], now: NOW })
    expect(file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('writes exportedAt as ISO UTC from the injected now', () => {
    const file = toProjectFile({ project: PROJECT, nodes: [], edges: [], now: NOW })
    expect(file.exportedAt).toBe('2026-11-14T12:30:45.123Z')
  })

  it('keeps only the project id and name', () => {
    const file = toProjectFile({ project: PROJECT, nodes: [], edges: [], now: NOW })
    expect(file.project).toEqual({ id: 'project-1', name: 'Delivery' })
  })

  it('keeps only id, type, position, and data on a node', () => {
    const [node] = exportNodes([runtimeNode])
    expect(sortedKeys(node)).toEqual(['data', 'id', 'position', 'type'])
  })

  it('keeps only x and y in a position', () => {
    const [node] = exportNodes([{ ...runtimeNode, position: { x: 1, y: 2, z: 3 } }])
    expect(node.position).toEqual({ x: 1, y: 2 })
  })

  it('keeps only the known data keys', () => {
    const [node] = exportNodes([runtimeNode])
    expect(node.data).toEqual({ label: 'Build', pt: 480, lt: 1200, ca: 90, queue: 4, batch: 3 })
  })

  it('omits optional data keys that are absent', () => {
    const [node] = exportNodes([{ ...runtimeNode, data: { label: 'Review' } }])
    expect(node.data).toEqual({ label: 'Review' })
  })

  it('keeps a zero value', () => {
    const [node] = exportNodes([{ ...runtimeNode, data: { label: 'Design', queue: 0 } }])
    expect(node.data).toEqual({ label: 'Design', queue: 0 })
  })

  it.each([
    ['absent', undefined],
    ['step', 'step'],
    ['another type', 'custom'],
  ])('writes type "step" when the node type is %s', (_name, type) => {
    const [node] = exportNodes([{ ...runtimeNode, type }])
    expect(node.type).toBe('step')
  })

  it('leaves the accessible name out of an exported node', () => {
    const [node] = exportNodes([{ ...runtimeNode, ariaLabel: 'Build' }])
    expect(sortedKeys(node)).toEqual(['data', 'id', 'position', 'type'])
  })

  it('keeps exactly id, source, and target on an edge', () => {
    const edge = {
      id: 'idea->plan',
      source: 'idea',
      target: 'plan',
      markerEnd: { type: 'arrowclosed' },
      selected: true,
      sourceHandle: null,
      type: 'smoothstep',
    }
    const file = toProjectFile({ project: PROJECT, nodes: [], edges: [edge], now: NOW })
    expect(file.edges).toEqual([{ id: 'idea->plan', source: 'idea', target: 'plan' }])
  })

  it('keeps several nodes and edges in their input order', () => {
    const nodes = ['c', 'a', 'b'].map((id) => ({ ...runtimeNode, id }))
    const edges = [
      { id: 'b->c', source: 'b', target: 'c' },
      { id: 'a->b', source: 'a', target: 'b' },
    ]
    const file = toProjectFile({ project: PROJECT, nodes, edges, now: NOW })
    expect(file.nodes.map((node) => node.id)).toEqual(['c', 'a', 'b'])
    expect(file.edges.map((edge) => edge.id)).toEqual(['b->c', 'a->b'])
  })

  it('exports the starter project as a file that passes validation', () => {
    const file = toProjectFile({
      project: createStarterProject({ newId: () => 'starter-project' }),
      nodes: initialNodes,
      edges: initialEdges,
      now: NOW,
    })
    expect(validateProjectFile(file)).toEqual({ ok: true })
  })

  it('does not change its input', () => {
    const input = {
      project: deepFreeze(structuredClone(PROJECT)),
      nodes: deepFreeze([structuredClone(runtimeNode)]),
      edges: deepFreeze([{ id: 'a->b', source: 'a', target: 'b', selected: true }]),
    }
    expect(() => toProjectFile({ ...input, now: NOW })).not.toThrow()
  })
})

describe('projectFileName', () => {
  it.each([
    ['Untitled Project', 'untitled-project.ai-enabler.json'],
    ['Checkout Revamp!', 'checkout-revamp.ai-enabler.json'],
    [' A--B ', 'a-b.ai-enabler.json'],
    ['Q3/Q4 Plan', 'q3-q4-plan.ai-enabler.json'],
    ['!!!', 'project.ai-enabler.json'],
    ['', 'project.ai-enabler.json'],
    ['Café', 'caf.ai-enabler.json'],
  ])('names the file for %j as %s', (name, fileName) => {
    expect(projectFileName(name)).toBe(fileName)
  })
})
