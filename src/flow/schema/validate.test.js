import { describe, it, expect } from 'vitest'
import { validateProjectFile } from './validate.js'
import { isCatalogCode } from '../diagnostics/problem.js'
import { initialNodes, initialEdges } from '../initialFlow.js'
import { STEP_DATA_FIELDS } from '../step.js'

const step = (id, label, index) => ({
  id,
  type: 'step',
  position: { x: index * 200, y: 0 },
  data: { label, pt: 60, lt: 120, ca: 90, queue: 2 },
})

// Idea (#1), Plan (#2), Build (#3), connected in a line.
const validFile = () => ({
  schemaVersion: '0.0.0',
  exportedAt: '2026-11-14T00:00:00.000Z',
  project: { id: 'project-1', name: 'Delivery' },
  nodes: [step('idea', 'Idea', 0), step('plan', 'Plan', 1), step('build', 'Build', 2)],
  edges: [
    { id: 'idea->plan', source: 'idea', target: 'plan' },
    { id: 'plan->build', source: 'plan', target: 'build' },
  ],
})

// Replaces the step at the 1-based position with the result of change(step).
const withStep = (position, change, file = validFile()) => ({
  ...file,
  nodes: file.nodes.map((node, i) => (i === position - 1 ? change(node) : node)),
})

const withData = (position, patch, file = validFile()) =>
  withStep(position, (node) => ({ ...node, data: { ...node.data, ...patch } }), file)

const withoutKey = (object, key) =>
  Object.fromEntries(Object.entries(object).filter(([k]) => k !== key))

const withEdges = (...pairs) => ({
  ...validFile(),
  edges: pairs.map(([source, target], i) => ({ id: `edge-${i}`, source, target })),
})

// Replaces the connection at the 1-based position with the result of change(connection).
const withEdge = (position, change, file = validFile()) => ({
  ...file,
  edges: file.edges.map((edge, i) => (i === position - 1 ? change(edge) : edge)),
})

// Steps whose ids are edited would leave the starter connections pointing at nothing.
const withoutEdges = (file) => ({ ...file, edges: [] })

const withProject = (patch) => ({ ...validFile(), project: { ...validFile().project, ...patch } })

const deepFreeze = (value) => {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const problemsOf = (file) => validateProjectFile(file).problems

// The one problem a file has; fails when it has none or more than one.
const onlyProblem = (file) => {
  const [found, ...rest] = problemsOf(file)
  expect(rest).toEqual([])
  expect(found).toBeDefined()
  return found
}

describe('validateProjectFile: whole file', () => {
  it('accepts a valid file with no problems', () => {
    expect(validateProjectFile(validFile())).toEqual({ ok: true, problems: [] })
  })

  it('accepts a valid file with extra unknown top-level fields', () => {
    expect(validateProjectFile({ ...validFile(), extra: { anything: [1] } })).toEqual({
      ok: true,
      problems: [],
    })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 7],
    ['a string', 'project'],
    ['a boolean', true],
    ['an array', []],
  ])('reports %s as exactly one not-a-project problem', (_label, value) => {
    expect(problemsOf(value)).toMatchObject([{ code: 'FILE_NOT_A_PROJECT', severity: 'error' }])
  })

  it.each([
    ['nodes missing', { ...validFile(), nodes: undefined }],
    ['nodes an object', { ...validFile(), nodes: {} }],
    ['edges null', { ...validFile(), edges: null }],
    ['edges a string', { ...validFile(), edges: 'none' }],
  ])('reports %s as exactly one not-a-project problem', (_label, file) => {
    expect(problemsOf(file)).toMatchObject([{ code: 'FILE_NOT_A_PROJECT' }])
  })

  it('stops at the not-a-project problem when the project name is also empty and edges are missing', () => {
    const file = { ...validFile(), project: {}, nodes: 'x', edges: undefined }
    expect(problemsOf(file)).toMatchObject([{ code: 'FILE_NOT_A_PROJECT' }])
  })

  it.each([
    ['a whitespace-only name', withProject({ name: '   ' })],
    ['an empty name', withProject({ name: '' })],
    ['a non-string name', withProject({ name: 7 })],
  ])('reports %s as an empty project name', (_label, file) => {
    expect(problemsOf(file)).toMatchObject([
      { code: 'FILE_PROJECT_NAME_EMPTY', field: 'project.name' },
    ])
  })

  it.each([
    ['an empty id', withProject({ id: '' })],
    ['a numeric id', withProject({ id: 7 })],
    ['a missing id', withProject({ id: undefined })],
    ['an object id', withProject({ id: {} })],
  ])('reports %s as a missing project id', (_label, file) => {
    expect(problemsOf(file)).toMatchObject([
      { code: 'FILE_PROJECT_ID_MISSING', field: 'project.id' },
    ])
  })

  it.each([
    ['no project', { ...validFile(), project: undefined }],
    ['a null project', { ...validFile(), project: null }],
    ['a string project', { ...validFile(), project: 'Delivery' }],
    ['an array project', { ...validFile(), project: [] }],
  ])('reports both project problems for %s', (_label, file) => {
    expect(problemsOf(file).map((p) => p.code)).toEqual([
      'FILE_PROJECT_NAME_EMPTY',
      'FILE_PROJECT_ID_MISSING',
    ])
  })

  it('accepts a whitespace-only project id', () => {
    expect(problemsOf(withProject({ id: ' ' }))).toEqual([])
  })
})

const validMark = () => ({ tool: 'aie-mcp', at: '2026-11-20T09:30:00.000Z' })

const withMark = (modifiedBy, file = validFile()) => ({ ...file, modifiedBy })

describe('validateProjectFile: the modifiedBy mark', () => {
  it('accepts a file with no mark', () => {
    expect(problemsOf(validFile())).toEqual([])
  })

  it.each([
    ['a mark from aie-mcp', validMark()],
    ['a mark from another tool', { tool: 'other-tool', at: '2026-11-20T09:30:00Z' }],
    ['a time with an offset', { tool: 'aie-mcp', at: '2026-11-20T09:30:00+02:00' }],
    ['a time with fractional seconds', { tool: 'aie-mcp', at: '2026-11-20T09:30:00.5Z' }],
    ['extra keys', { ...validMark(), extra: 1 }],
  ])('accepts %s', (_label, mark) => {
    expect(problemsOf(withMark(mark))).toEqual([])
  })

  it.each([
    ['no time', { tool: 'aie-mcp' }, 'MARK_TIME_INVALID', 'modifiedBy.at'],
    ['the time "soon"', { tool: 'aie-mcp', at: 'soon' }, 'MARK_TIME_INVALID', 'modifiedBy.at'],
    ['an empty time', { tool: 'aie-mcp', at: '' }, 'MARK_TIME_INVALID', 'modifiedBy.at'],
    [
      'a numeric time',
      { tool: 'aie-mcp', at: 1763631000000 },
      'MARK_TIME_INVALID',
      'modifiedBy.at',
    ],
    [
      'a date with no time',
      { tool: 'aie-mcp', at: '2026-11-20' },
      'MARK_TIME_INVALID',
      'modifiedBy.at',
    ],
    [
      'a time with no zone',
      { tool: 'aie-mcp', at: '2026-11-20T09:30:00' },
      'MARK_TIME_INVALID',
      'modifiedBy.at',
    ],
    [
      'month 13',
      { tool: 'aie-mcp', at: '2026-13-20T09:30:00Z' },
      'MARK_TIME_INVALID',
      'modifiedBy.at',
    ],
    ['an empty tool', { tool: '', at: validMark().at }, 'MARK_TOOL_INVALID', 'modifiedBy.tool'],
    ['no tool', { at: validMark().at }, 'MARK_TOOL_INVALID', 'modifiedBy.tool'],
    ['a numeric tool', { tool: 7, at: validMark().at }, 'MARK_TOOL_INVALID', 'modifiedBy.tool'],
    ['a null tool', { tool: null, at: validMark().at }, 'MARK_TOOL_INVALID', 'modifiedBy.tool'],
  ])('reports a mark with %s as one problem naming the bad part', (_label, mark, code, field) => {
    expect(onlyProblem(withMark(mark))).toMatchObject({ code, field, severity: 'error' })
  })

  it.each([
    ['null', null],
    ['a string', 'aie-mcp'],
    ['a number', 7],
    ['an array', []],
    ['a boolean', false],
  ])('reports a mark that is %s as one problem, without reading its parts', (_label, mark) => {
    expect(onlyProblem(withMark(mark))).toMatchObject({
      code: 'MARK_NOT_AN_OBJECT',
      field: 'modifiedBy',
    })
  })

  it('reports a mark with a bad tool and a bad time as two problems', () => {
    expect(problemsOf(withMark({ tool: '', at: 'soon' })).map((p) => p.code)).toEqual([
      'MARK_TOOL_INVALID',
      'MARK_TIME_INVALID',
    ])
  })

  it.each([
    ['MARK_NOT_AN_OBJECT', 'modifiedBy', null],
    ['MARK_TOOL_INVALID', 'modifiedBy.tool', { tool: '', at: validMark().at }],
    ['MARK_TIME_INVALID', 'modifiedBy.at', { tool: 'aie-mcp', at: 'soon' }],
  ])('%s names %s and says removing the modifiedBy field fixes the file', (_code, field, mark) => {
    const { message, fix } = onlyProblem(withMark(mark))
    expect(message).toContain(field)
    expect(message).toContain('Removing the modifiedBy field fixes the file.')
    expect(fix).toContain('Remove the modifiedBy field')
  })

  it('keeps the bad time as untrusted text, cut to 80 characters', () => {
    const found = onlyProblem(withMark({ tool: 'aie-mcp', at: 'x'.repeat(200) }))
    expect(found.untrusted).toEqual({ time: `${'x'.repeat(79)}…` })
    expect(found.message).not.toContain('xxx')
  })

  it('carries no untrusted text for a time that is not text', () => {
    expect(onlyProblem(withMark({ tool: 'aie-mcp', at: 7 }))).not.toHaveProperty('untrusted')
  })

  it('lists a mark problem together with every other problem in the file', () => {
    const file = withMark({ tool: '', at: validMark().at }, withData(2, { pt: -1 }))
    expect(problemsOf(file).map((p) => p.code)).toEqual(['MARK_TOOL_INVALID', 'STEP_COUNT_INVALID'])
  })

  it('does not change a file with a malformed mark', () => {
    const file = deepFreeze(withMark({ tool: 7, at: 'soon' }))
    expect(() => validateProjectFile(file)).not.toThrow()
  })
})

describe('validateProjectFile: step rules', () => {
  it.each([
    ['pt -1', withData(2, { pt: -1 }), 'pt', 'Plan', 2, 'process time (pt)'],
    ['pt 1.5', withData(2, { pt: 1.5 }), 'pt', 'Plan', 2, 'process time (pt)'],
    ['pt a string', withData(2, { pt: '5' }), 'pt', 'Plan', 2, 'process time (pt)'],
    ['pt null', withData(3, { pt: null }), 'pt', 'Build', 3, 'process time (pt)'],
    ['lt -1', withData(3, { lt: -1 }), 'lt', 'Build', 3, 'lead time (lt)'],
    ['queue -1', withData(2, { queue: -1 }), 'queue', 'Plan', 2, 'queue (queue)'],
    ['queue 1.5', withData(2, { queue: 1.5 }), 'queue', 'Plan', 2, 'queue (queue)'],
    ['batch -2', withData(3, { batch: -2 }), 'batch', 'Build', 3, 'batch size (batch)'],
  ])('rejects %s as a count problem', (_label, file, field, title, position, fieldText) => {
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'STEP_COUNT_INVALID', field })
    expect(found.message).toContain(`Step "${title}" (#${position})`)
    expect(found.message).toContain(fieldText)
  })

  it.each([
    ['%C&A 100.5', withData(3, { ca: 100.5 }), 'Build', 3],
    ['%C&A -0.5', withData(2, { ca: -0.5 }), 'Plan', 2],
    ['%C&A a string', withData(2, { ca: '90' }), 'Plan', 2],
  ])('rejects %s as a percentage problem', (_label, file, title, position) => {
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'STEP_PERCENT_INVALID', field: 'ca' })
    expect(found.message).toContain(`Step "${title}" (#${position})`)
    expect(found.message).toContain('%C&A (ca)')
  })

  // A field added to STEP_DATA_FIELDS without an entry here, or without a validator rule, fails.
  const OPTIONAL_FIELD_CODES = {
    pt: 'STEP_COUNT_INVALID',
    lt: 'STEP_COUNT_INVALID',
    queue: 'STEP_COUNT_INVALID',
    batch: 'STEP_COUNT_INVALID',
    ca: 'STEP_PERCENT_INVALID',
  }

  it.each(STEP_DATA_FIELDS.filter((field) => field !== 'label'))(
    'rejects an optional field "%s" holding a string that is not a number',
    (field) => {
      expect(problemsOf(withData(2, { [field]: 'not a number' }))).toMatchObject([
        { code: OPTIONAL_FIELD_CODES[field], field },
      ])
    },
  )

  it.each([
    [
      'type "group"',
      withStep(3, (node) => ({ ...node, type: 'group' })),
      'STEP_TYPE_UNKNOWN',
      'type',
    ],
    ['a null type', withStep(3, (node) => ({ ...node, type: null })), 'STEP_TYPE_UNKNOWN', 'type'],
    [
      'an id missing',
      withoutEdges(withStep(2, (node) => withoutKey(node, 'id'))),
      'STEP_ID_MISSING',
      'id',
    ],
    [
      'a numeric id',
      withoutEdges(withStep(2, (node) => ({ ...node, id: 7 }))),
      'STEP_ID_MISSING',
      'id',
    ],
    [
      'a position missing',
      withStep(2, (node) => withoutKey(node, 'position')),
      'STEP_POSITION_MISSING',
      'position',
    ],
    [
      'position y missing',
      withStep(2, (node) => ({ ...node, position: { x: 0 } })),
      'STEP_POSITION_MISSING',
      'position',
    ],
    [
      'position x a string',
      withStep(2, (node) => ({ ...node, position: { x: '0', y: 0 } })),
      'STEP_POSITION_MISSING',
      'position',
    ],
    [
      'a null position',
      withStep(2, (node) => ({ ...node, position: null })),
      'STEP_POSITION_MISSING',
      'position',
    ],
    ['a numeric label', withData(2, { label: 5 }), 'STEP_LABEL_MISSING', 'label'],
  ])('rejects a step with %s', (_label, file, code, field) => {
    expect(problemsOf(file)).toMatchObject([{ code, field }])
  })

  it.each([
    ['type absent', withStep(2, (node) => withoutKey(node, 'type'))],
    ['optional fields absent', withStep(2, (node) => ({ ...node, data: { label: 'Plan' } }))],
    ['pt 0', withData(2, { pt: 0 })],
    ['lt 0', withData(2, { lt: 0 })],
    ['queue 0', withData(2, { queue: 0 })],
    ['batch 0', withData(2, { batch: 0 })],
    ['%C&A 0', withData(2, { ca: 0 })],
    ['%C&A at its upper bound', withData(2, { ca: 100 })],
    ['a fractional %C&A', withData(2, { ca: 87.5 })],
  ])('accepts a step with %s', (_label, file) => {
    expect(validateProjectFile(file)).toEqual({ ok: true, problems: [] })
  })
})

describe('validateProjectFile: connection rules', () => {
  it.each([
    ['no id', withEdge(2, (edge) => withoutKey(edge, 'id'))],
    ['the numeric id 42', withEdge(2, (edge) => ({ ...edge, id: 42 }))],
    ['an empty id', withEdge(2, (edge) => ({ ...edge, id: '' }))],
  ])('rejects a connection with %s and names it by number', (_label, file) => {
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'CONN_ID_MISSING', field: 'id' })
    expect(found.message).toContain('Connection 2')
    expect(found).not.toHaveProperty('edgeId')
  })
})

describe('validateProjectFile: every problem is reported', () => {
  it('reports an empty name, a bad process time and a connection to a missing step', () => {
    const file = {
      ...withData(2, { pt: -1 }),
      project: { id: 'p', name: '' },
      edges: [{ id: 'to-ghost', source: 'plan', target: 'ghost' }],
    }
    const problems = problemsOf(file)
    expect(problems.map((p) => p.code).sort()).toEqual([
      'CONN_ENDPOINT_MISSING',
      'FILE_PROJECT_NAME_EMPTY',
      'STEP_COUNT_INVALID',
    ])
    const count = problems.find((p) => p.code === 'STEP_COUNT_INVALID')
    expect(count.message).toContain('Plan')
    expect(count.message).toContain('process time (pt)')
    expect(problems.find((p) => p.code === 'CONN_ENDPOINT_MISSING').edgeId).toBe('to-ghost')
  })

  it('reports the same rule failing on two steps, one per step', () => {
    const [first, second, ...rest] = problemsOf(withData(2, { pt: -1 }, withData(3, { pt: -1 })))
    expect(rest).toEqual([])
    expect(first.message).toContain('Step "Plan" (#2)')
    expect(second.message).toContain('Step "Build" (#3)')
  })

  it('reports every failing rule on one step', () => {
    const file = withStep(2, (node) => ({
      ...withoutKey(node, 'position'),
      type: 'group',
      data: { label: 'Plan', pt: -1, ca: 101 },
    }))
    expect(problemsOf(file).map((p) => p.code)).toEqual([
      'STEP_POSITION_MISSING',
      'STEP_TYPE_UNKNOWN',
      'STEP_COUNT_INVALID',
      'STEP_PERCENT_INVALID',
    ])
  })

  it('carries the step id and title on a step problem', () => {
    expect(problemsOf(withData(2, { pt: -1 }))).toMatchObject([
      { stepId: 'plan', untrusted: { title: 'Plan' } },
    ])
  })

  it('names a step without a usable title by its position', () => {
    const [found] = problemsOf(withData(2, { label: ' ', pt: -1 }))
    expect(found.message).toContain('Step #2')
    expect(found).not.toHaveProperty('untrusted')
  })
})

describe('validateProjectFile: relational rules', () => {
  it('reports the later of two steps sharing an id', () => {
    const file = withoutEdges(withStep(3, (node) => ({ ...node, id: 'plan' })))
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'STEP_ID_DUPLICATE', stepId: 'plan', field: 'id' })
    expect(found.message).toContain('Step "Build" (#3)')
    expect(found.untrusted).toEqual({ title: 'Build', id: 'plan' })
  })

  it('reports every step that repeats an earlier id', () => {
    const file = withoutEdges(
      withStep(
        3,
        (node) => ({ ...node, id: 'idea' }),
        withStep(2, (node) => ({ ...node, id: 'idea' })),
      ),
    )
    expect(problemsOf(file).map((p) => p.code)).toEqual(['STEP_ID_DUPLICATE', 'STEP_ID_DUPLICATE'])
  })

  it('reports the later of two connections sharing an id', () => {
    const file = withEdge(2, (edge) => ({ ...edge, id: 'idea->plan' }))
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'CONN_ID_DUPLICATE', edgeId: 'idea->plan', field: 'id' })
    expect(found.message).toContain('Connection 2')
    expect(found.untrusted).toEqual({ id: 'idea->plan' })
  })

  it.each([
    ['to a missing step', withEdges(['plan', 'ghost'])],
    ['from a missing step', withEdges(['ghost', 'plan'])],
    ['with object endpoints', withEdge(1, (edge) => ({ ...edge, source: {}, target: [] }))],
  ])('reports a connection %s with its id', (_label, file) => {
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'CONN_ENDPOINT_MISSING', edgeId: expect.any(String) })
    expect(found.message).toContain('Connection 1')
  })

  it('reports every connection to a missing step', () => {
    const file = withEdges(['plan', 'ghost'], ['ghost', 'plan'], ['idea', 'plan'])
    expect(problemsOf(file).map((p) => p.edgeId)).toEqual(['edge-0', 'edge-1'])
  })

  it('reports a step connected to itself and names the step', () => {
    const found = onlyProblem(withEdges(['build', 'build']))
    expect(found).toMatchObject({
      code: 'CONN_SELF',
      edgeId: 'edge-0',
      stepId: 'build',
      untrusted: { title: 'Build' },
    })
    expect(found.message).toContain('Step "Build" (#3)')
  })

  it('reports the same connection twice', () => {
    const found = onlyProblem(withEdges(['idea', 'plan'], ['idea', 'plan']))
    expect(found).toMatchObject({ code: 'CONN_DUPLICATE', edgeId: 'edge-1' })
    expect(found).not.toHaveProperty('stepId')
  })

  it.each([
    ['a three-step loop', withEdges(['idea', 'plan'], ['plan', 'build'], ['build', 'idea'])],
    ['a two-step loop', withEdges(['plan', 'build'], ['build', 'plan'])],
  ])('reports %s on the connection that closes it', (_label, file) => {
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'CONN_LOOP', edgeId: file.edges.at(-1).id })
    expect(found).not.toHaveProperty('stepId')
  })

  it('reports every rejected connection, not the first', () => {
    const file = withEdges(['plan', 'plan'], ['idea', 'plan'], ['idea', 'plan'], ['plan', 'idea'])
    expect(problemsOf(file).map((p) => [p.code, p.edgeId])).toEqual([
      ['CONN_SELF', 'edge-0'],
      ['CONN_DUPLICATE', 'edge-2'],
      ['CONN_LOOP', 'edge-3'],
    ])
  })

  it.each([
    ['no connections', { ...validFile(), edges: [] }],
    ['no steps', { ...validFile(), nodes: [], edges: [] }],
    ['a branch', withEdges(['idea', 'plan'], ['idea', 'build'])],
    ['a join', withEdges(['idea', 'build'], ['plan', 'build'])],
  ])('accepts %s', (_label, file) => {
    expect(validateProjectFile(file)).toEqual({ ok: true, problems: [] })
  })
})

describe('validateProjectFile: phase 2 only checks items that passed phase 1', () => {
  it('does not compare ids of a step that already has a problem', () => {
    const file = withoutEdges(
      withStep(3, (node) => ({ ...node, id: 'plan', data: { label: 'Build', pt: -1 } })),
    )
    expect(problemsOf(file).map((p) => p.code)).toEqual(['STEP_COUNT_INVALID'])
  })

  it('does not run relational rules on a connection with no id', () => {
    const file = withEdge(2, (edge) => ({ ...withoutKey(edge, 'id'), target: 'ghost' }))
    expect(problemsOf(file).map((p) => p.code)).toEqual(['CONN_ID_MISSING'])
  })

  it('does not treat a step that has another problem as a missing endpoint', () => {
    const file = withData(2, { pt: -1 })
    expect(problemsOf(file).map((p) => p.code)).toEqual(['STEP_COUNT_INVALID'])
  })

  it('does not report a missing step as a self-connection', () => {
    expect(problemsOf(withEdges(['ghost', 'ghost'])).map((p) => p.code)).toEqual([
      'CONN_ENDPOINT_MISSING',
    ])
  })
})

describe('validateProjectFile: untrusted input', () => {
  it('reports a null step as a missing id, position and label by number', () => {
    const file = withoutEdges(withStep(2, () => null))
    const problems = problemsOf(file)
    expect(problems.map((p) => p.code)).toEqual([
      'STEP_ID_MISSING',
      'STEP_POSITION_MISSING',
      'STEP_LABEL_MISSING',
    ])
    expect(problems.filter((p) => !p.message.startsWith('Step #2 '))).toEqual([])
  })

  it('reports a null connection by number without an edge id', () => {
    const file = withEdge(2, () => null)
    const found = onlyProblem(file)
    expect(found).toMatchObject({ code: 'CONN_ID_MISSING' })
    expect(found.message).toContain('Connection 2')
    expect(found).not.toHaveProperty('edgeId')
  })

  it('lists a problem for a null connection and for a connection from a missing step to itself', () => {
    const file = {
      ...validFile(),
      edges: [null, { id: 'ghost-loop', source: 'ghost', target: 'ghost' }],
    }
    const problems = problemsOf(file)
    expect(problems).toMatchObject([
      { code: 'CONN_ID_MISSING' },
      { code: 'CONN_ENDPOINT_MISSING', edgeId: 'ghost-loop' },
    ])
  })

  const ALL_STEP_FIELDS = ['STEP_ID_MISSING', 'STEP_POSITION_MISSING', 'STEP_LABEL_MISSING']

  it.each([
    ['null', null, ALL_STEP_FIELDS],
    ['a number', 5, ALL_STEP_FIELDS],
    ['a string', 'x', ALL_STEP_FIELDS],
    ['an array', [], ALL_STEP_FIELDS],
    ['an object with only data', { data: 7 }, ALL_STEP_FIELDS],
    [
      'an object with an array position and null data',
      { id: 'a', position: [], data: null },
      ['STEP_POSITION_MISSING', 'STEP_LABEL_MISSING'],
    ],
  ])('does not throw for a step that is %s', (_label, garbage, codes) => {
    const file = { ...validFile(), nodes: [garbage], edges: [] }
    expect(validateProjectFile(file)).toMatchObject({
      ok: false,
      problems: codes.map((code) => ({ code })),
    })
  })

  it.each([
    ['null', null, 'CONN_ID_MISSING'],
    ['a number', 5, 'CONN_ID_MISSING'],
    ['a string', 'x', 'CONN_ID_MISSING'],
    ['an array', [], 'CONN_ID_MISSING'],
    [
      'an object with object endpoints',
      { id: 'e', source: {}, target: [] },
      'CONN_ENDPOINT_MISSING',
    ],
  ])('does not throw for a connection that is %s', (_label, garbage, code) => {
    const file = { ...validFile(), edges: [garbage] }
    expect(validateProjectFile(file)).toMatchObject({ ok: false, problems: [{ code }] })
  })

  it.each([
    ['an empty object', {}, 'FILE_NOT_A_PROJECT'],
    ['a deep object', { a: { b: { c: [1, { d: null }] } } }, 'FILE_NOT_A_PROJECT'],
    [
      'a step data array',
      withStep(2, (node) => ({ ...node, data: ['Plan'] })),
      'STEP_LABEL_MISSING',
    ],
    ['data null', withStep(2, (node) => ({ ...node, data: null })), 'STEP_LABEL_MISSING'],
  ])('does not throw for %s', (_label, file, code) => {
    expect(validateProjectFile(file)).toMatchObject({ ok: false, problems: [{ code }] })
  })

  it.each([
    ['an invalid file', withEdges(['plan', 'build'], ['build', 'plan'])],
    ['a valid, deep-frozen file', deepFreeze(validFile())],
  ])('does not change %s', (_label, file) => {
    const before = structuredClone(file)
    validateProjectFile(file)
    expect(file).toEqual(before)
  })
})

describe('validateProjectFile: messages and codes', () => {
  const brokenEverywhere = {
    ...validFile(),
    nodes: [
      step('idea', 'Idea', 0),
      { id: 'plan', position: {}, data: { label: 'Plan', queue: 1.5 }, type: 'group' },
      step('plan', 'Dup', 2),
      null,
    ],
    edges: [
      { source: 'idea', target: 'plan' },
      { id: 'a', source: 'idea', target: 'ghost' },
      { id: 'a', source: 'idea', target: 'plan' },
      { id: 'self', source: 'idea', target: 'idea' },
      { id: 'again', source: 'idea', target: 'plan' },
      null,
    ],
  }

  it('names the step or the connection in every per-item problem', () => {
    const problems = problemsOf(brokenEverywhere)
    const perItem = problems.filter((p) => /^(STEP|CONN)_/.test(p.code))
    expect(perItem.map((p) => p.code)).toEqual([
      'STEP_POSITION_MISSING',
      'STEP_TYPE_UNKNOWN',
      'STEP_COUNT_INVALID',
      'STEP_ID_MISSING',
      'STEP_POSITION_MISSING',
      'STEP_LABEL_MISSING',
      'CONN_ID_MISSING',
      'CONN_ID_MISSING',
      'CONN_ID_DUPLICATE',
      'CONN_ENDPOINT_MISSING',
      'CONN_SELF',
      'CONN_DUPLICATE',
    ])
    expect(perItem.filter((p) => !/^(Step|Connection) /.test(p.message))).toEqual([])
  })

  it('names the step by title and position, falling back to the position', () => {
    const messages = problemsOf(brokenEverywhere)
      .filter((p) => p.code === 'STEP_POSITION_MISSING')
      .map((p) => p.message)
    expect(messages[0]).toContain('Step "Plan" (#2)')
    expect(messages[1]).toContain('Step #4')
  })

  it('shortens a long title in the message and keeps it whole in untrusted', () => {
    const title = 'A'.repeat(200)
    const found = onlyProblem(withData(2, { label: title, pt: -1 }))
    expect(found.message).toBe(
      `Step "${'A'.repeat(79)}…" (#2): process time (pt) must be a whole number, 0 or more.`,
    )
    expect(found.untrusted).toEqual({ title })
  })

  it.each([
    ['keeps an 80-character title whole', 80, `Step "${'A'.repeat(80)}" (#2)`],
    ['shortens an 81-character title', 81, `Step "${'A'.repeat(79)}…" (#2)`],
  ])('%s', (_label, length, named) => {
    expect(onlyProblem(withData(2, { label: 'A'.repeat(length), pt: -1 })).message).toContain(
      `${named}:`,
    )
  })

  it('shortens a long repeated connection id in the message and keeps it whole in untrusted', () => {
    const id = 'x'.repeat(200)
    const found = onlyProblem(
      withEdge(
        2,
        (edge) => ({ ...edge, id }),
        withEdge(1, (edge) => ({ ...edge, id })),
      ),
    )
    expect(found.message).toContain(`"${'x'.repeat(79)}…"`)
    expect(found.untrusted).toEqual({ id })
  })

  it('shortens a long repeated step id in the message', () => {
    const id = 'x'.repeat(200)
    const file = withoutEdges(
      withStep(
        3,
        (node) => ({ ...node, id }),
        withStep(2, (node) => ({ ...node, id })),
      ),
    )
    expect(onlyProblem(file).message).toContain(`"${'x'.repeat(79)}…"`)
  })

  it('states the field with its key in a step problem', () => {
    expect(problemsOf(withData(2, { queue: -1 }))[0].message).toContain('queue (queue)')
  })

  it('gives every problem a severity, message and fix from the catalog', () => {
    const problems = problemsOf(brokenEverywhere)
    expect(problems.filter((p) => !(p.severity && p.message && p.fix))).toEqual([])
  })

  it('emits only catalog codes, one broken file per rule', () => {
    const brokenFiles = {
      FILE_NOT_A_PROJECT: null,
      FILE_PROJECT_NAME_EMPTY: withProject({ name: '' }),
      FILE_PROJECT_ID_MISSING: withProject({ id: '' }),
      STEP_ID_MISSING: withoutEdges(withStep(2, (node) => ({ ...node, id: 7 }))),
      STEP_ID_DUPLICATE: withoutEdges(withStep(3, (node) => ({ ...node, id: 'plan' }))),
      STEP_POSITION_MISSING: withStep(2, (node) => withoutKey(node, 'position')),
      STEP_LABEL_MISSING: withData(2, { label: 5 }),
      STEP_TYPE_UNKNOWN: withStep(2, (node) => ({ ...node, type: 'group' })),
      STEP_COUNT_INVALID: withData(2, { pt: -1 }),
      STEP_PERCENT_INVALID: withData(2, { ca: 101 }),
      MARK_NOT_AN_OBJECT: withMark(null),
      MARK_TOOL_INVALID: withMark({ tool: '', at: validMark().at }),
      MARK_TIME_INVALID: withMark({ tool: 'aie-mcp', at: 'soon' }),
      CONN_ID_MISSING: withEdge(2, (edge) => withoutKey(edge, 'id')),
      CONN_ID_DUPLICATE: withEdge(2, (edge) => ({ ...edge, id: 'idea->plan' })),
      CONN_ENDPOINT_MISSING: withEdges(['plan', 'ghost']),
      CONN_SELF: withEdges(['build', 'build']),
      CONN_DUPLICATE: withEdges(['idea', 'plan'], ['idea', 'plan']),
      CONN_LOOP: withEdges(['plan', 'build'], ['build', 'plan']),
    }
    const emitted = Object.entries(brokenFiles).map(([code, file]) => [
      code,
      problemsOf(file).map((p) => p.code),
    ])
    expect(emitted.filter(([code, codes]) => codes.length !== 1 || codes[0] !== code)).toEqual([])
    const emittedCodes = emitted.flatMap(([, codes]) => codes)
    expect(emittedCodes.filter((code) => !isCatalogCode(code))).toEqual([])
    expect([...new Set(emittedCodes)].sort()).toEqual([
      'CONN_DUPLICATE',
      'CONN_ENDPOINT_MISSING',
      'CONN_ID_DUPLICATE',
      'CONN_ID_MISSING',
      'CONN_LOOP',
      'CONN_SELF',
      'FILE_NOT_A_PROJECT',
      'FILE_PROJECT_ID_MISSING',
      'FILE_PROJECT_NAME_EMPTY',
      'MARK_NOT_AN_OBJECT',
      'MARK_TIME_INVALID',
      'MARK_TOOL_INVALID',
      'STEP_COUNT_INVALID',
      'STEP_ID_DUPLICATE',
      'STEP_ID_MISSING',
      'STEP_LABEL_MISSING',
      'STEP_PERCENT_INVALID',
      'STEP_POSITION_MISSING',
      'STEP_TYPE_UNKNOWN',
    ])
  })
})

describe('validateProjectFile: starter map', () => {
  it('accepts the starter steps and connections', () => {
    const file = { ...validFile(), nodes: initialNodes, edges: initialEdges }
    expect(validateProjectFile(file)).toEqual({ ok: true, problems: [] })
  })
})
