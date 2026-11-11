import { describe, it, expect } from 'vitest'
import { STAGE_SPACING, toNodes, toEdges, initialNodes, initialEdges } from './initialFlow.js'

describe('toNodes', () => {
  it('lays stages out left to right, one spacing apart, keeping ids and labels', () => {
    expect(
      toNodes([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]),
    ).toEqual([
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', position: { x: STAGE_SPACING, y: 0 }, data: { label: 'B' } },
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

  it('returns no edges for no nodes', () => {
    expect(toEdges([])).toEqual([])
  })
})

describe('initial flow', () => {
  it('runs from Idea to Production in order', () => {
    expect(initialNodes.map((n) => n.data.label)).toEqual([
      'Idea',
      'Plan',
      'Build',
      'Test',
      'Deploy',
      'Production',
    ])
  })

  it('links each stage to the next', () => {
    expect(initialEdges.map((e) => [e.source, e.target])).toEqual([
      ['idea', 'plan'],
      ['plan', 'build'],
      ['build', 'test'],
      ['test', 'deploy'],
      ['deploy', 'production'],
    ])
  })
})
