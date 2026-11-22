import { describe, expect, it } from 'vitest'
import { moveEdit, deleteEdit, syncCanvas } from './canvas.js'
import { EDIT_EVENT, INITIAL_EDIT_STATE, reduceEdit, runEdit, toEditEvent } from './editFlow.js'
import { createStarterMemoryProject } from './project.js'

const context = { newId: () => 'new-id' }
const PROJECT = createStarterMemoryProject({ newId: () => 'project-id' })
const startingEdit = () => ({
  project: PROJECT,
  canvas: syncCanvas({ nodes: [], edges: [] }, PROJECT),
})

const problemOf = (message) => ({ code: 'TEST_PROBLEM', message, fix: 'Fix it.' })
const rejected = (problems, focusReturn = null) => ({
  type: EDIT_EVENT.rejected,
  problems,
  focusReturn,
})

const nodeById = (canvas, id) => canvas.nodes.find((node) => node.id === id)
const edgesOf = (canvas, id) => canvas.edges.filter((e) => e.source === id || e.target === id)

describe('runEdit', () => {
  it('applies an accepted move to the project and the canvas, and no other step moves', () => {
    const edit = startingEdit()
    const result = runEdit(
      edit,
      [{ name: 'move_step', args: { stepId: 'build', x: 420, y: 80 } }],
      context,
    )
    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.problems).toEqual([])
    expect(result.project.nodes.find((n) => n.id === 'build').position).toEqual({ x: 420, y: 80 })
    expect(nodeById(result.canvas, 'build').position).toEqual({ x: 420, y: 80 })
    expect(nodeById(result.canvas, 'plan').position).toEqual(PROJECT.nodes[1].position)
  })

  it('puts the canvas back to the project when a move is rejected', () => {
    const edit = startingEdit()
    const dragged = {
      ...edit.canvas,
      nodes: edit.canvas.nodes.map((n) =>
        n.id === 'build' ? { ...n, position: { x: 999, y: 999 }, selected: true } : n,
      ),
    }
    const commands = moveEdit(
      [{ id: 'build', type: 'position', position: { x: 'left', y: 80 }, dragging: false }],
      PROJECT,
    )
    const result = runEdit({ project: PROJECT, canvas: dragged }, commands, context)
    expect(result.ok).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.problems.map((p) => p.code)).toEqual(['STEP_POSITION_MISSING'])
    expect(result.project).toBe(PROJECT)
    expect(nodeById(result.canvas, 'build').position).toEqual(PROJECT.nodes[2].position)
    expect(nodeById(result.canvas, 'build').selected).toBe(true)
  })

  it('does not ask to move focus for a rejected delete, and keeps the step and its connections', () => {
    const edit = startingEdit()
    const selected = {
      ...edit.canvas,
      nodes: edit.canvas.nodes.map((n) => (n.id === 'build' ? { ...n, selected: true } : n)),
    }
    // The project lacks the step the view deletes: the edit is rejected.
    const commands = [
      ...deleteEdit({ nodes: [{ id: 'build' }], edges: [] }),
      { name: 'remove_step', args: { stepId: 'nope' } },
    ]
    const result = runEdit({ project: PROJECT, canvas: selected }, commands, context)
    expect(result.ok).toBe(false)
    expect(result.moveFocus).toBe(false)
    expect(nodeById(result.canvas, 'build').selected).toBe(true)
    expect(edgesOf(result.canvas, 'build')).toHaveLength(2)
    expect(result.canvas.nodes).toHaveLength(PROJECT.nodes.length)
  })

  it('asks to move focus for an accepted delete, and the canvas loses the step and its connections', () => {
    const result = runEdit(
      startingEdit(),
      deleteEdit({ nodes: [{ id: 'build' }], edges: [] }),
      context,
    )
    expect(result.ok).toBe(true)
    expect(result.moveFocus).toBe(true)
    expect(nodeById(result.canvas, 'build')).toBeUndefined()
    expect(edgesOf(result.canvas, 'build')).toEqual([])
    expect(result.canvas.nodes).toHaveLength(PROJECT.nodes.length - 1)
  })

  it('accepts an empty edit: nothing changes, focus stays, the canvas is redrawn from the project', () => {
    const edit = startingEdit()
    const stale = {
      ...edit.canvas,
      nodes: edit.canvas.nodes.map((n) =>
        n.id === 'idea' ? { ...n, position: { x: 5, y: 5 } } : n,
      ),
    }
    const result = runEdit({ project: PROJECT, canvas: stale }, [], context)
    expect(result).toMatchObject({ ok: true, changed: false, moveFocus: false, problems: [] })
    expect(result.project).toBe(PROJECT)
    expect(nodeById(result.canvas, 'idea').position).toEqual(PROJECT.nodes[0].position)
  })

  it('names a new connection with the injected id', () => {
    const result = runEdit(
      startingEdit(),
      [{ name: 'connect', args: { sourceId: 'idea', targetId: 'test' } }],
      context,
    )
    expect(result.canvas.edges.at(-1)).toEqual({ id: 'new-id', source: 'idea', target: 'test' })
  })

  it('does not change the project or the canvas it was given', () => {
    const edit = startingEdit()
    const before = structuredClone(edit)
    runEdit(edit, deleteEdit({ nodes: [{ id: 'build' }], edges: [] }), context)
    expect(edit).toEqual(before)
  })
})

describe('toEditEvent', () => {
  const ok = { ok: true, changed: true, problems: [] }

  it('is a rejection with its problems and the focus to return to', () => {
    const problems = [problemOf('Bad.')]
    expect(toEditEvent({ ok: false, changed: false, problems }, 'the-button')).toEqual(
      rejected(problems, 'the-button'),
    )
  })

  it('is accepted for an edit that changed something', () => {
    expect(toEditEvent(ok)).toEqual({ type: EDIT_EVENT.accepted })
  })

  it('is nothing for an empty edit, so a shown rejection stays', () => {
    expect(toEditEvent({ ok: true, changed: false, problems: [] })).toBeNull()
  })
})

describe('reduceEdit', () => {
  const one = [problemOf('Step "Nope" does not exist.')]
  const two = [problemOf('First.'), problemOf('Second.')]

  it('starts with nothing shown', () => {
    expect(INITIAL_EDIT_STATE).toEqual({ rejection: null, focusReturn: null })
  })

  it('shows a rejection and announces the count and the first message', () => {
    const { state, announcement } = reduceEdit(INITIAL_EDIT_STATE, rejected(one, 'a-button'))
    expect(announcement).toBe('Edit rejected: 1 problem. Step "Nope" does not exist.')
    expect(state.rejection.heading).toBe('Edit rejected: 1 problem')
    expect(state.rejection.items.map((i) => i.message)).toEqual(['Step "Nope" does not exist.'])
    expect(state.rejection.more).toBeNull()
    expect(state.focusReturn).toBe('a-button')
  })

  it('pluralises the count for 2 problems and announces only the first message', () => {
    const { state, announcement } = reduceEdit(INITIAL_EDIT_STATE, rejected(two))
    expect(announcement).toBe('Edit rejected: 2 problems. First.')
    expect(state.rejection.heading).toBe('Edit rejected: 2 problems')
    expect(state.rejection.items).toHaveLength(2)
  })

  it('lists the first 10 of 12 problems and counts the rest', () => {
    const many = Array.from({ length: 12 }, (_, i) => problemOf(`Problem ${i}.`))
    const { state, announcement } = reduceEdit(INITIAL_EDIT_STATE, rejected(many))
    expect(announcement).toBe('Edit rejected: 12 problems. Problem 0.')
    expect(state.rejection.items).toHaveLength(10)
    expect(state.rejection.more).toBe('and 2 more')
  })

  it('replaces a shown rejection with the next, and its focus return', () => {
    const first = reduceEdit(INITIAL_EDIT_STATE, rejected(one, 'first')).state
    const { state, announcement } = reduceEdit(first, rejected(two, 'second'))
    expect(state.rejection.heading).toBe('Edit rejected: 2 problems')
    expect(state.focusReturn).toBe('second')
    expect(announcement).toBe('Edit rejected: 2 problems. First.')
  })

  it('keeps the focus return while the rejection is shown', () => {
    const shown = reduceEdit(INITIAL_EDIT_STATE, rejected(one, 'a-button')).state
    expect(reduceEdit(shown, { type: 'unrelated' }).state).toBe(shown)
  })

  it.each([EDIT_EVENT.accepted, EDIT_EVENT.dismiss, EDIT_EVENT.importReplaced])(
    'clears a shown rejection and its focus return on %s, with nothing to announce',
    (type) => {
      const shown = reduceEdit(INITIAL_EDIT_STATE, rejected(one, 'a-button')).state
      expect(reduceEdit(shown, { type })).toEqual({ state: INITIAL_EDIT_STATE, announcement: null })
    },
  )

  it('stays clear when there is nothing to clear', () => {
    expect(reduceEdit(INITIAL_EDIT_STATE, { type: EDIT_EVENT.dismiss }).state).toEqual(
      INITIAL_EDIT_STATE,
    )
  })

  it('ignores an event it does not know', () => {
    const shown = reduceEdit(INITIAL_EDIT_STATE, rejected(one)).state
    expect(reduceEdit(shown, { type: 'bogus' })).toEqual({ state: shown, announcement: null })
  })

  it('keeps the code, step id, connection id and field of each problem in the view', () => {
    const problems = [
      { ...problemOf('Bad.'), stepId: 's', edgeId: 'e', field: 'position', untrusted: { x: 1 } },
    ]
    const item = reduceEdit(INITIAL_EDIT_STATE, rejected(problems)).state.rejection.items[0]
    expect(item).toEqual({
      code: 'TEST_PROBLEM',
      message: 'Bad.',
      fix: 'Fix it.',
      stepId: 's',
      edgeId: 'e',
      field: 'position',
    })
  })
})
