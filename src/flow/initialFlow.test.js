import { describe, it, expect } from 'vitest'
import { STAGE_SPACING, toNodes, toEdges, initialNodes, initialEdges } from './initialFlow.js'

describe('toNodes', () => {
  it('lays stages out left to right as step cards, one spacing apart, keeping ids and labels', () => {
    expect(
      toNodes([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ]),
    ).toEqual([
      { id: 'a', type: 'step', position: { x: 0, y: 0 }, data: { label: 'A' }, ariaLabel: 'A' },
      {
        id: 'b',
        type: 'step',
        position: { x: STAGE_SPACING, y: 0 },
        data: { label: 'B' },
        ariaLabel: 'B',
      },
      {
        id: 'c',
        type: 'step',
        position: { x: STAGE_SPACING * 2, y: 0 },
        data: { label: 'C' },
        ariaLabel: 'C',
      },
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
  it('names every starter node for assistive technology by its step title', () => {
    expect(initialNodes.map((n) => n.ariaLabel)).toEqual(initialNodes.map((n) => n.data.label))
  })

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

  it.each([
    ['idea', { label: 'Idea', pt: 120, lt: 1440, ca: 90, queue: 20 }],
    ['plan', { label: 'Plan', pt: 360, lt: 960, ca: 90, queue: 3 }],
    ['build', { label: 'Build', pt: 480, lt: 1200, ca: 90, queue: 4 }],
    ['test', { label: 'Test', pt: 240, lt: 1200, ca: 90, queue: 5 }],
    ['deploy', { label: 'Deploy', pt: 240, lt: 720, ca: 90, queue: 1 }],
    ['production', { label: 'Production', pt: 120, lt: 480, ca: 90, queue: 1, batch: 3 }],
  ])('gives %s its starter data in minutes', (id, expected) => {
    expect(initialNodes.find((n) => n.id === id).data).toStrictEqual(expected)
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
