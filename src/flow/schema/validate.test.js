import { describe, it, expect } from 'vitest'
import { validateProjectFile } from './validate.js'
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

const withProject = (patch) => ({ ...validFile(), project: { ...validFile().project, ...patch } })

const deepFreeze = (value) => {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const fail = (message) => ({ ok: false, message })

describe('validateProjectFile: whole file', () => {
  it('accepts a valid file', () => {
    expect(validateProjectFile(validFile())).toEqual({ ok: true })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 7],
    ['a string', 'project'],
    ['a boolean', true],
    ['an array', []],
  ])('reports %s as not a project file', (_label, value) => {
    expect(validateProjectFile(value)).toEqual(
      fail('This is not a project file. Choose a file exported from AI Enabler.'),
    )
  })

  it.each([
    ['a whitespace-only name', withProject({ name: '   ' }), 'The project name is empty.'],
    ['an empty name', withProject({ name: '' }), 'The project name is empty.'],
    ['a non-string name', withProject({ name: 7 }), 'The project name is empty.'],
    ['no project', { ...validFile(), project: undefined }, 'The project name is empty.'],
    ['a null project', { ...validFile(), project: null }, 'The project name is empty.'],
    ['nodes missing', { ...validFile(), nodes: undefined }, 'The file has no list of steps.'],
    ['nodes an object', { ...validFile(), nodes: {} }, 'The file has no list of steps.'],
    ['edges null', { ...validFile(), edges: null }, 'The file has no list of connections.'],
    ['edges a string', { ...validFile(), edges: 'none' }, 'The file has no list of connections.'],
  ])('rejects %s', (_label, file, message) => {
    expect(validateProjectFile(file)).toEqual(fail(message))
  })
})

describe('validateProjectFile: steps', () => {
  it.each([
    ['pt -1', withData(2, { pt: -1 }), 'Step "Plan" (#2) has an invalid process time.'],
    ['pt 1.5', withData(2, { pt: 1.5 }), 'Step "Plan" (#2) has an invalid process time.'],
    ['pt a string', withData(2, { pt: '5' }), 'Step "Plan" (#2) has an invalid process time.'],
    ['pt null', withData(3, { pt: null }), 'Step "Build" (#3) has an invalid process time.'],
    ['lt -1', withData(3, { lt: -1 }), 'Step "Build" (#3) has an invalid lead time.'],
    ['queue -1', withData(2, { queue: -1 }), 'Step "Plan" (#2) has an invalid queue.'],
    ['queue 1.5', withData(2, { queue: 1.5 }), 'Step "Plan" (#2) has an invalid queue.'],
    ['batch -2', withData(3, { batch: -2 }), 'Step "Build" (#3) has an invalid batch size.'],
    ['%C&A 100.5', withData(3, { ca: 100.5 }), 'Step "Build" (#3) has an invalid %C&A.'],
    ['%C&A -0.5', withData(2, { ca: -0.5 }), 'Step "Plan" (#2) has an invalid %C&A.'],
    ['%C&A a string', withData(2, { ca: '90' }), 'Step "Plan" (#2) has an invalid %C&A.'],
  ])('rejects %s', (_label, file, message) => {
    expect(validateProjectFile(file)).toEqual(fail(message))
  })

  // A field added to STEP_DATA_FIELDS without a validator rule fails here.
  it.each(STEP_DATA_FIELDS.filter((field) => field !== 'label'))(
    'rejects an optional field "%s" holding a string that is not a number',
    (field) => {
      expect(validateProjectFile(withData(2, { [field]: 'not a number' })).ok).toBe(false)
    },
  )

  it.each([
    [
      'type "group"',
      withStep(3, (node) => ({ ...node, type: 'group' })),
      'Step "Build" (#3) has an unknown type.',
    ],
    [
      'an id missing',
      withStep(2, (node) => withoutKey(node, 'id')),
      'Step "Plan" (#2) is missing an id.',
    ],
    [
      'a numeric id',
      withStep(2, (node) => ({ ...node, id: 7 })),
      'Step "Plan" (#2) is missing an id.',
    ],
    [
      'a position missing',
      withStep(3, (node) => withoutKey(node, 'position')),
      'Step "Build" (#3) is missing a position.',
    ],
    [
      'position y missing',
      withStep(2, (node) => ({ ...node, position: { x: 0 } })),
      'Step "Plan" (#2) is missing a position.',
    ],
    [
      'position x a string',
      withStep(2, (node) => ({ ...node, position: { x: '0', y: 0 } })),
      'Step "Plan" (#2) is missing a position.',
    ],
    [
      'a label missing',
      withStep(3, (node) => ({ ...node, data: {} })),
      'Step #3 is missing a label.',
    ],
    ['a numeric label', withData(2, { label: 5 }), 'Step #2 is missing a label.'],
    ['data null', withStep(2, (node) => ({ ...node, data: null })), 'Step #2 is missing a label.'],
    ['a null step', withStep(2, () => null), 'Step #2 is missing an id.'],
    [
      'a blank label on a bad step',
      withData(2, { label: ' ', pt: -1 }),
      'Step #2 has an invalid process time.',
    ],
  ])('rejects a step with %s', (_label, file, message) => {
    expect(validateProjectFile(file)).toEqual(fail(message))
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
    expect(validateProjectFile(file)).toEqual({ ok: true })
  })
})

describe('validateProjectFile: ids and connections', () => {
  it.each([
    [
      'two steps with id "plan"',
      withStep(3, (node) => ({ ...node, id: 'plan' })),
      'Two steps share the id "plan".',
    ],
    [
      'a connection to a missing step',
      withEdges(['plan', 'ghost']),
      'A connection points to a step that is not there.',
    ],
    [
      'a connection from a missing step',
      withEdges(['ghost', 'plan']),
      'A connection points to a step that is not there.',
    ],
    [
      'a step connected to itself',
      withEdges(['plan', 'plan']),
      'Step "Plan" (#2) connects to itself.',
    ],
    [
      'the same connection twice',
      withEdges(['idea', 'plan'], ['idea', 'plan']),
      'A connection appears twice.',
    ],
    [
      'a loop',
      withEdges(['idea', 'plan'], ['plan', 'build'], ['build', 'idea']),
      'The connections form a loop.',
    ],
    [
      'a two-step loop',
      withEdges(['plan', 'build'], ['build', 'plan']),
      'The connections form a loop.',
    ],
    [
      'a connection with no id',
      withEdge(2, (edge) => withoutKey(edge, 'id')),
      'Connection 2 is missing an id.',
    ],
    [
      'a connection with the numeric id 42',
      withEdge(2, (edge) => ({ ...edge, id: 42 })),
      'Connection 2 is missing an id.',
    ],
    [
      'a connection with an empty id',
      withEdge(2, (edge) => ({ ...edge, id: '' })),
      'Connection 2 is missing an id.',
    ],
    [
      'a null connection before the endpoint check',
      withEdge(2, () => null),
      'Connection 2 is missing an id.',
    ],
    [
      'two connections with id "idea->plan"',
      withEdge(2, (edge) => ({ ...edge, id: 'idea->plan' })),
      'Two connections share the id "idea->plan".',
    ],
    ['an empty project id', withProject({ id: '' }), 'The project id is missing.'],
    ['a numeric project id', withProject({ id: 7 }), 'The project id is missing.'],
    ['a missing project id', withProject({ id: undefined }), 'The project id is missing.'],
  ])('rejects %s', (_label, file, message) => {
    expect(validateProjectFile(file)).toEqual(fail(message))
  })

  it.each([
    ['no connections', { ...validFile(), edges: [] }],
    ['no steps', { ...validFile(), nodes: [], edges: [] }],
    ['a branch', withEdges(['idea', 'plan'], ['idea', 'build'])],
    ['a join', withEdges(['idea', 'build'], ['plan', 'build'])],
    ['a whitespace-only project id', withProject({ id: ' ' })],
  ])('accepts %s', (_label, file) => {
    expect(validateProjectFile(file)).toEqual({ ok: true })
  })

  it('names a self-connection at step #3', () => {
    const file = withEdges(['build', 'build'])
    expect(validateProjectFile(file)).toEqual(fail('Step "Build" (#3) connects to itself.'))
  })
})

describe('validateProjectFile: first problem wins', () => {
  const duplicateNodeAndEdgeId = withEdge(
    2,
    (edge) => ({ ...edge, id: 'idea->plan' }),
    withStep(3, (node) => ({ ...node, id: 'plan' })),
  )
  const missingEdgeIdAndEndpoint = withEdge(1, (edge) => ({
    ...withoutKey(edge, 'id'),
    target: 'ghost',
  }))
  const duplicateEdgeIdAndEndpoint = withEdge(2, (edge) => ({
    ...edge,
    id: 'idea->plan',
    target: 'ghost',
  }))

  const missingPositionAndLoop = {
    ...withStep(3, (node) => withoutKey(node, 'position')),
    edges: withEdges(['idea', 'plan'], ['plan', 'build'], ['build', 'idea']).edges,
  }

  it.each([
    [
      'a duplicate step id and a duplicate connection id',
      duplicateNodeAndEdgeId,
      'Two steps share the id "plan".',
    ],
    [
      'a missing connection id and a connection to a missing step',
      missingEdgeIdAndEndpoint,
      'Connection 1 is missing an id.',
    ],
    [
      'a duplicate connection id and a connection to a missing step',
      duplicateEdgeIdAndEndpoint,
      'Two connections share the id "idea->plan".',
    ],
    [
      'a missing position and a loop',
      missingPositionAndLoop,
      'Step "Build" (#3) is missing a position.',
    ],
    [
      'an empty name and a bad process time',
      { ...withData(2, { pt: -1 }), project: { id: 'p', name: '' } },
      'The project name is empty.',
    ],
    [
      'a bad queue on step 2 and a bad process time on step 3 (the earlier rule wins on a later step)',
      withData(2, { queue: -1 }, withData(3, { pt: -1 })),
      'Step "Build" (#3) has an invalid process time.',
    ],
    [
      'two bad steps with the same problem',
      withData(2, { pt: -1 }, withData(3, { pt: -1 })),
      'Step "Plan" (#2) has an invalid process time.',
    ],
    [
      'a self-connection before a duplicate',
      withEdges(['plan', 'plan'], ['idea', 'plan'], ['idea', 'plan']),
      'Step "Plan" (#2) connects to itself.',
    ],
    [
      'a duplicate before a self-connection',
      withEdges(['idea', 'plan'], ['idea', 'plan'], ['plan', 'plan']),
      'A connection appears twice.',
    ],
    [
      'a missing position on step 2 and a missing id on step 3',
      withStep(
        2,
        (node) => withoutKey(node, 'position'),
        withStep(3, (node) => withoutKey(node, 'id')),
      ),
      'Step "Build" (#3) is missing an id.',
    ],
    [
      'a missing label on step 2 and a missing position on step 3',
      withStep(
        2,
        (node) => ({ ...node, data: {} }),
        withStep(3, (node) => withoutKey(node, 'position')),
      ),
      'Step "Build" (#3) is missing a position.',
    ],
    [
      'an unknown type on step 2 and a missing label on step 3',
      withStep(
        2,
        (node) => ({ ...node, type: 'group' }),
        withStep(3, (node) => ({ ...node, data: {} })),
      ),
      'Step #3 is missing a label.',
    ],
    [
      'a bad process time on step 2 and an unknown type on step 3',
      withData(
        2,
        { pt: -1 },
        withStep(3, (node) => ({ ...node, type: 'group' })),
      ),
      'Step "Build" (#3) has an unknown type.',
    ],
    [
      'a duplicate id and a bad %C&A on step 3',
      withData(
        3,
        { ca: -1 },
        withStep(3, (node) => ({ ...node, id: 'plan' })),
      ),
      'Step "Build" (#3) has an invalid %C&A.',
    ],
    [
      'a missing step and a duplicate id',
      {
        ...withStep(3, (node) => ({ ...node, id: 'plan' })),
        edges: withEdges(['plan', 'ghost']).edges,
      },
      'Two steps share the id "plan".',
    ],
    [
      'a self-connection and a missing step',
      withEdges(['plan', 'plan'], ['plan', 'ghost']),
      'A connection points to a step that is not there.',
    ],
    [
      'a missing step and an empty project id',
      { ...withEdges(['plan', 'ghost']), project: { id: '', name: 'Delivery' } },
      'A connection points to a step that is not there.',
    ],
    [
      'a loop and an empty project id',
      { ...withEdges(['plan', 'build'], ['build', 'plan']), project: { id: '', name: 'Delivery' } },
      'The connections form a loop.',
    ],
  ])('reports %s as the first problem', (_label, file, message) => {
    expect(validateProjectFile(file)).toEqual(fail(message))
  })
})

describe('validateProjectFile: untrusted input', () => {
  const MISSING_ID = 'Step #1 is missing an id.'
  const NO_PROJECT_NAME = 'The project name is empty.'
  const MISSING_ENDPOINT = 'A connection points to a step that is not there.'
  const MISSING_CONNECTION_ID = 'Connection 1 is missing an id.'

  it.each([
    ['null first', null, MISSING_ID],
    ['a number first', 5, MISSING_ID],
    ['a string first', 'x', MISSING_ID],
    ['an array first', [], MISSING_ID],
    ['an object with only data first', { data: 7 }, MISSING_ID],
    [
      'an object with an array position and null data first',
      { id: 'a', position: [], data: null },
      'Step #1 is missing a position.',
    ],
  ])('returns a failure instead of throwing for steps with %s', (_label, garbage, message) => {
    expect(validateProjectFile({ ...validFile(), nodes: [garbage] })).toEqual(fail(message))
  })

  it.each([
    ['null first', null, MISSING_CONNECTION_ID],
    ['a number first', 5, MISSING_CONNECTION_ID],
    ['a string first', 'x', MISSING_CONNECTION_ID],
    ['an array first', [], MISSING_CONNECTION_ID],
    [
      'an object with object endpoints first',
      { id: 'e', source: {}, target: [] },
      MISSING_ENDPOINT,
    ],
  ])(
    'returns a failure instead of throwing for connections with %s',
    (_label, garbage, message) => {
      expect(validateProjectFile({ ...validFile(), edges: [garbage] })).toEqual(fail(message))
    },
  )

  it.each([
    ['a string project', { ...validFile(), project: 'Delivery' }, NO_PROJECT_NAME],
    ['an array project', { ...validFile(), project: [] }, NO_PROJECT_NAME],
    ['an empty object', {}, NO_PROJECT_NAME],
    ['a deep object', { a: { b: { c: [1, { d: null }] } } }, NO_PROJECT_NAME],
    [
      'a step data array',
      withStep(2, (node) => ({ ...node, data: ['Plan'] })),
      'Step #2 is missing a label.',
    ],
    [
      'a null position',
      withStep(2, (node) => ({ ...node, position: null })),
      'Step "Plan" (#2) is missing a position.',
    ],
    ['an object project id', withProject({ id: {} }), 'The project id is missing.'],
  ])('returns a failure instead of throwing for %s', (_label, file, message) => {
    expect(validateProjectFile(file)).toEqual(fail(message))
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

describe('validateProjectFile: starter map', () => {
  it('accepts the starter steps and connections', () => {
    const file = { ...validFile(), nodes: initialNodes, edges: initialEdges }
    expect(validateProjectFile(file)).toEqual({ ok: true })
  })
})
