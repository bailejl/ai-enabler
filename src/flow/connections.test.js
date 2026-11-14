import { describe, expect, it } from 'vitest'
import { connectionProblem, findEdgeProblems, isValidConnection, reachable } from './connections.js'

const edge = (source, target) => ({ id: `${source}-${target}`, source, target })
const ideaToPlanToBuild = [edge('Idea', 'Plan'), edge('Plan', 'Build')]

describe('connectionProblem', () => {
  it.each([
    ['Build', 'Test', null],
    ['Idea', 'Build', null],
    ['Test', 'Build', null],
    ['Plan', 'Plan', 'self'],
    ['Idea', 'Plan', 'duplicate'],
    ['Build', 'Idea', 'loop'],
    ['Plan', 'Idea', 'loop'],
  ])('%s→%s given Idea→Plan, Plan→Build: %s', (source, target, expected) => {
    expect(connectionProblem(ideaToPlanToBuild, { source, target })).toBe(expected)
  })

  it('accepts any connection between different steps on an empty graph', () => {
    expect(connectionProblem([], { source: 'A', target: 'B' })).toBeNull()
  })

  it('rejects a self connection on an empty graph', () => {
    expect(connectionProblem([], { source: 'A', target: 'A' })).toBe('self')
  })
})

describe('isValidConnection', () => {
  it('accepts a connection with no problem', () => {
    expect(isValidConnection(ideaToPlanToBuild)({ source: 'Build', target: 'Test' })).toBe(true)
  })

  it.each([
    ['Plan', 'Plan'],
    ['Idea', 'Plan'],
    ['Build', 'Idea'],
  ])('rejects %s→%s', (source, target) => {
    expect(isValidConnection(ideaToPlanToBuild)({ source, target })).toBe(false)
  })

  it('ignores extra connection fields such as handles', () => {
    const connection = { source: 'Build', target: 'Test', sourceHandle: 'out', targetHandle: 'in' }
    expect(isValidConnection(ideaToPlanToBuild)(connection)).toBe(true)
  })
})

describe('reachable', () => {
  it.each([
    ['Idea', 'Build', true],
    ['Build', 'Idea', false],
    ['Idea', 'Idea', true],
    ['Idea', 'Unknown', false],
  ])('%s to %s: %s', (from, to, expected) => {
    expect(reachable(ideaToPlanToBuild, from, to)).toBe(expected)
  })

  it('reaches nothing on an empty graph', () => {
    expect(reachable([], 'A', 'B')).toBe(false)
  })

  it('terminates on cyclic input', () => {
    const cycle = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')]
    expect(reachable(cycle, 'A', 'C')).toBe(true)
    expect(reachable(cycle, 'A', 'Z')).toBe(false)
  })
})

describe('findEdgeProblems', () => {
  it('reports self, duplicate and loop for A→A, A→B, A→B, B→A', () => {
    const edges = [edge('A', 'A'), edge('A', 'B'), { ...edge('A', 'B'), id: 'dup' }, edge('B', 'A')]
    expect(findEdgeProblems(edges)).toEqual([
      { kind: 'self', edge: edges[0] },
      { kind: 'duplicate', edge: edges[2] },
      { kind: 'loop', edge: edges[3] },
    ])
  })

  it('reports nothing for an empty graph', () => {
    expect(findEdgeProblems([])).toEqual([])
  })

  it('reports nothing for a branching and fan-in graph', () => {
    const edges = [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')]
    expect(findEdgeProblems(edges)).toEqual([])
  })

  it('reports a loop in a three-step cycle', () => {
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')]
    expect(findEdgeProblems(edges)).toEqual([{ kind: 'loop', edge: edges[2] }])
  })
})
