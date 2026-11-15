import { describe, expect, it } from 'vitest'
import { pickFocusAfterDelete } from './focusAfterDelete.js'

const nodesNamed = (...ids) => ids.map((id) => ({ id }))
const nodes = nodesNamed('a', 'b', 'c', 'd')

describe('pickFocusAfterDelete: deleted steps', () => {
  it.each([
    ['the first step', ['a'], 'b'],
    ['a middle step', ['b'], 'c'],
    ['two steps in a row', ['b', 'c'], 'd'],
    ['the first and a later step', ['a', 'c'], 'b'],
  ])('moves focus to the next remaining step after deleting %s', (_label, deleted, expected) => {
    expect(
      pickFocusAfterDelete({ nodes, deletedNodes: nodesNamed(...deleted), deletedEdges: [] }),
    ).toBe(expected)
  })

  it.each([
    ['the last step', ['d'], 'c'],
    ['the last two steps', ['c', 'd'], 'b'],
  ])('falls back to the nearest earlier step after deleting %s', (_label, deleted, expected) => {
    expect(
      pickFocusAfterDelete({ nodes, deletedNodes: nodesNamed(...deleted), deletedEdges: [] }),
    ).toBe(expected)
  })

  it('returns null so the canvas takes focus when no step remains', () => {
    expect(pickFocusAfterDelete({ nodes, deletedNodes: nodes, deletedEdges: [] })).toBeNull()
  })
})

describe('pickFocusAfterDelete: deleted connections', () => {
  it('moves focus to the source step of the deleted connection', () => {
    const deletedEdges = [{ id: 'b->c', source: 'b', target: 'c' }]
    expect(pickFocusAfterDelete({ nodes, deletedNodes: [], deletedEdges })).toBe('b')
  })

  it('returns null when the source step is not on the map', () => {
    const deletedEdges = [{ id: 'x->c', source: 'x', target: 'c' }]
    expect(pickFocusAfterDelete({ nodes, deletedNodes: [], deletedEdges })).toBeNull()
  })

  it('prefers the next remaining step when steps are deleted along with their connections', () => {
    const deletedEdges = [
      { id: 'a->b', source: 'a', target: 'b' },
      { id: 'b->c', source: 'b', target: 'c' },
    ]
    expect(pickFocusAfterDelete({ nodes, deletedNodes: nodesNamed('b'), deletedEdges })).toBe('c')
  })
})

describe('pickFocusAfterDelete: nothing deleted', () => {
  it('returns null', () => {
    expect(pickFocusAfterDelete({ nodes, deletedNodes: [], deletedEdges: [] })).toBeNull()
  })

  it('does not change its input', () => {
    const input = Object.freeze({
      nodes: Object.freeze([...nodes]),
      deletedNodes: Object.freeze(nodesNamed('b')),
      deletedEdges: Object.freeze([]),
    })
    expect(() => pickFocusAfterDelete(input)).not.toThrow()
  })
})
