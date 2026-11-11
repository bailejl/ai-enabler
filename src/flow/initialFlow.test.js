import { describe, it, expect } from 'vitest'
import { toNodes, toEdges, initialNodes, initialEdges } from './initialFlow.js'

describe('toNodes', () => {
  it('lays stages out left to right with labels', () => {
    expect(toNodes(['A', 'B'])).toEqual([
      { id: 'stage-0', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'stage-1', position: { x: 200, y: 0 }, data: { label: 'B' } },
    ])
  })

  it('returns no nodes for no stages', () => {
    expect(toNodes([])).toEqual([])
  })
})

describe('toEdges', () => {
  it('links each node to the next', () => {
    expect(toEdges([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual([
      { id: 'a->b', source: 'a', target: 'b' },
      { id: 'b->c', source: 'b', target: 'c' },
    ])
  })

  it('returns no edges for a single node', () => {
    expect(toEdges([{ id: 'a' }])).toEqual([])
  })
})

describe('initial flow', () => {
  it('runs from Idea to Production with one edge per gap', () => {
    expect(initialNodes.map((n) => n.data.label)).toEqual([
      'Idea',
      'Plan',
      'Build',
      'Test',
      'Deploy',
      'Production',
    ])
    expect(initialEdges).toHaveLength(initialNodes.length - 1)
  })
})
