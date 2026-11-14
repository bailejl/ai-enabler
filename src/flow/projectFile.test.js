import { describe, it, expect } from 'vitest'
import { projectFileName, toProjectFile } from './projectFile.js'

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

const exportNodes = (nodes) => toProjectFile({ project: PROJECT, nodes, edges: [], now: NOW }).nodes

describe('toProjectFile', () => {
  it('writes exactly the file fields', () => {
    const file = toProjectFile({ project: PROJECT, nodes: [], edges: [], now: NOW })
    expect(Object.keys(file)).toEqual(['schemaVersion', 'exportedAt', 'project', 'nodes', 'edges'])
  })

  it('stamps the current schema version', () => {
    const file = toProjectFile({ project: PROJECT, nodes: [], edges: [], now: NOW })
    expect(file.schemaVersion).toBe('0.0.0')
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
    expect(Object.keys(node)).toEqual(['id', 'type', 'position', 'data'])
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

  it('does not change its input', () => {
    const nodes = [structuredClone(runtimeNode)]
    toProjectFile({ project: PROJECT, nodes, edges: [], now: NOW })
    expect(nodes).toEqual([runtimeNode])
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
