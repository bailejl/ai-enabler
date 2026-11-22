import { describe, expect, it } from 'vitest'
import { connectEdit, deleteEdit, moveEdit, syncCanvas } from './canvas.js'

const step = (id, label, x = 0, y = 0) => ({
  id,
  type: 'step',
  position: { x, y },
  data: { label, pt: 5 },
})

const PROJECT = {
  project: { id: 'p', name: 'Map' },
  nodes: [step('a', 'Plan'), step('b', 'Build', 200), step('c', '  ', 400)],
  edges: [
    { id: 'a->b', source: 'a', target: 'b' },
    { id: 'b->c', source: 'b', target: 'c' },
  ],
}

const NO_CANVAS = { nodes: [], edges: [] }

describe('syncCanvas', () => {
  it('draws each project step with its title as the aria label, or its position when blank', () => {
    const { nodes } = syncCanvas(NO_CANVAS, PROJECT)
    expect(nodes).toEqual([
      { ...step('a', 'Plan'), ariaLabel: 'Plan' },
      { ...step('b', 'Build', 200), ariaLabel: 'Build' },
      { ...step('c', '  ', 400), ariaLabel: 'Step #3' },
    ])
  })

  it('draws each project connection with only its id, source and target', () => {
    expect(syncCanvas(NO_CANVAS, PROJECT).edges).toEqual(PROJECT.edges)
  })

  it('keeps selected and measured of the same id, and nothing else of the view', () => {
    const previous = {
      nodes: [
        { id: 'b', selected: true, measured: { width: 10, height: 20 }, dragging: true, width: 9 },
      ],
      edges: [{ id: 'a->b', selected: true, markerEnd: 'x', source: 'z' }],
    }
    const { nodes, edges } = syncCanvas(previous, PROJECT)
    expect(nodes[1]).toEqual({
      ...step('b', 'Build', 200),
      ariaLabel: 'Build',
      selected: true,
      measured: { width: 10, height: 20 },
    })
    expect(edges[0]).toEqual({ ...PROJECT.edges[0], selected: true })
  })

  it('gives steps and connections that were not selected no view fields', () => {
    const { nodes, edges } = syncCanvas(NO_CANVAS, PROJECT)
    expect(Object.keys(nodes[0])).not.toContain('selected')
    expect(Object.keys(nodes[0])).not.toContain('measured')
    expect(Object.keys(edges[0])).not.toContain('selected')
  })

  it('keeps a deselected state as it is', () => {
    const previous = { nodes: [{ id: 'a', selected: false }], edges: [] }
    expect(syncCanvas(previous, PROJECT).nodes[0].selected).toBe(false)
  })

  it('drops the view state of an id the project no longer has', () => {
    const previous = {
      nodes: [{ id: 'gone', selected: true }],
      edges: [{ id: 'gone->b', selected: true }],
    }
    const { nodes, edges } = syncCanvas(previous, PROJECT)
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(nodes.some((n) => n.selected)).toBe(false)
    expect(edges.some((e) => e.selected)).toBe(false)
  })

  it('resets a dragged view position and edited data to the project', () => {
    const previous = {
      nodes: [{ id: 'b', position: { x: 999, y: 999 }, data: { label: 'Edited' }, selected: true }],
      edges: [],
    }
    const built = syncCanvas(previous, PROJECT).nodes[1]
    expect(built.position).toEqual({ x: 200, y: 0 })
    expect(built.data).toEqual({ label: 'Build', pt: 5 })
  })

  it('follows the project: removed steps leave and aria labels use the new place', () => {
    const smaller = { ...PROJECT, nodes: [PROJECT.nodes[2]], edges: [] }
    const { nodes, edges } = syncCanvas(syncCanvas(NO_CANVAS, PROJECT), smaller)
    expect(nodes.map((n) => n.id)).toEqual(['c'])
    expect(nodes[0].ariaLabel).toBe('Step #1')
    expect(edges).toEqual([])
  })

  it('does not change its inputs', () => {
    const previous = { nodes: [{ id: 'a', selected: true }], edges: [] }
    const before = structuredClone({ previous, PROJECT })
    syncCanvas(previous, PROJECT)
    expect({ previous, PROJECT }).toEqual(before)
  })
})

describe('connectEdit', () => {
  it('builds one connect command and leaves handle ids behind', () => {
    expect(connectEdit({ source: 'a', target: 'b', sourceHandle: 'r', targetHandle: 'l' })).toEqual(
      [{ name: 'connect', args: { sourceId: 'a', targetId: 'b' } }],
    )
  })
})

describe('deleteEdit', () => {
  const edge = (source, target) => ({ id: `${source}->${target}`, source, target, selected: true })

  it('disconnects a selected connection and keeps both steps', () => {
    expect(deleteEdit({ nodes: [], edges: [edge('a', 'b')] })).toEqual([
      { name: 'disconnect', args: { sourceId: 'a', targetId: 'b' } },
    ])
  })

  it('removes each selected step, and carries no view fields into the command', () => {
    expect(deleteEdit({ nodes: [{ id: 'b', selected: true, measured: {} }], edges: [] })).toEqual([
      { name: 'remove_step', args: { stepId: 'b' } },
    ])
  })

  it('skips a connection attached to a removed step, at either end', () => {
    const commands = deleteEdit({
      nodes: [{ id: 'b' }],
      edges: [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')],
    })
    expect(commands).toEqual([
      { name: 'disconnect', args: { sourceId: 'x', targetId: 'y' } },
      { name: 'remove_step', args: { stepId: 'b' } },
    ])
  })

  it('builds nothing for an empty selection', () => {
    expect(deleteEdit({ nodes: [], edges: [] })).toEqual([])
  })
})

describe('moveEdit', () => {
  const move = (id, x, y, dragging) => ({ id, type: 'position', position: { x, y }, dragging })

  it('builds no command for in-progress drag positions and one for the drop', () => {
    const changes = [
      ...[1, 2, 3, 4, 5].map((i) => move('b', 200 + i * 10, 20, true)),
      move('b', 300, 80, false),
    ]
    expect(moveEdit(changes, PROJECT)).toEqual([
      { name: 'move_step', args: { stepId: 'b', x: 300, y: 80 } },
    ])
  })

  it('builds no command while a drag is in progress', () => {
    expect(moveEdit([move('b', 250, 20, true)], PROJECT)).toEqual([])
  })

  it('builds one command for a keyboard move, which has no dragging true before it', () => {
    expect(moveEdit([move('b', 205, 0, false)], PROJECT)).toEqual([
      { name: 'move_step', args: { stepId: 'b', x: 205, y: 0 } },
    ])
  })

  it('builds one command for each dropped step of a box selection', () => {
    const changes = [move('a', 50, 10, false), move('b', 250, 10, false)]
    expect(moveEdit(changes, PROJECT).map((c) => c.args)).toEqual([
      { stepId: 'a', x: 50, y: 10 },
      { stepId: 'b', x: 250, y: 10 },
    ])
  })

  it('builds none for a drop at the project position, and one when x or y differs', () => {
    expect(moveEdit([move('b', 200, 0, false)], PROJECT)).toEqual([])
    expect(moveEdit([move('b', 200, 1, false)], PROJECT)).toHaveLength(1)
    expect(moveEdit([move('b', 201, 0, false)], PROJECT)).toHaveLength(1)
  })

  it('builds none for a change without a position, or without dragging false', () => {
    const noPosition = { id: 'b', type: 'position', dragging: false }
    const noDragging = { id: 'b', type: 'position', position: { x: 1, y: 1 } }
    expect(moveEdit([noPosition, noDragging], PROJECT)).toEqual([])
  })

  it('builds none for select, dimensions, remove, add and replace changes', () => {
    const changes = [
      { id: 'b', type: 'select', selected: true },
      {
        id: 'b',
        type: 'dimensions',
        dimensions: { width: 1, height: 1 },
        position: { x: 9, y: 9 },
      },
      { id: 'b', type: 'remove' },
      { type: 'add', item: step('z', 'Z') },
      { id: 'b', type: 'replace', item: step('b', 'B', 9, 9) },
    ]
    expect(moveEdit(changes, PROJECT)).toEqual([])
  })

  it('builds the command for an id the project lacks, so the edit is rejected', () => {
    expect(moveEdit([move('nope', 1, 2, false)], PROJECT)).toEqual([
      { name: 'move_step', args: { stepId: 'nope', x: 1, y: 2 } },
    ])
  })

  it('builds nothing for no changes', () => {
    expect(moveEdit([], PROJECT)).toEqual([])
  })
})
