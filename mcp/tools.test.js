import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { COMMANDS } from '../src/flow/commands/index.js'
import { problem } from '../src/flow/diagnostics/problem.js'
import { parseImport } from '../src/flow/importFile.js'
import { toProjectFile, withContentHash } from '../src/flow/projectFile.js'
import { CURRENT_SCHEMA_VERSION } from '../src/flow/schema/version.js'
import { TOOLS, createToolHost, toCallResult } from './tools.js'

const NOW = new Date('2026-11-21T10:30:00.000Z')
const EXPORTED = new Date('2026-11-14T12:00:00.000Z')

const TOOL_NAMES = [
  'create_project',
  'add_step',
  'update_step',
  'remove_step',
  'set_step_metrics',
  'connect',
  'disconnect',
  'open_project',
  'save_project',
  'discard_changes',
  'get_project',
  'list_problems',
]

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/

const step = (id, label, data = {}) => ({
  id,
  type: 'step',
  position: { x: 0, y: 0 },
  data: { label, ...data },
})

const COMPLETE = { pt: 30, lt: 60, ca: 90, queue: 4 }

// The text of a saved project file, as the app would export it.
const fileText = async (nodes, { name = 'Checkout', edges = [] } = {}) =>
  JSON.stringify(
    await withContentHash(
      toProjectFile({ project: { id: 'p1', name }, nodes, edges, now: EXPORTED }),
    ),
  )

// A fake projects folder with the store's contract: a plain .json name, mustBeNew refuses a taken
// name, and a failed write changes nothing. `hold` makes reads wait, to interleave calls.
// double-waiver: B1 — the real store does file I/O; mcp/store.test.js covers it against a temp dir
const fakeStore = (initial = {}) => {
  const files = new Map(Object.entries(initial))
  const writes = []
  const state = { failWrites: false, hold: undefined, onRead: undefined }
  const notAllowed = (name) => ({
    ok: false,
    problems: [
      problem('FILE_NAME_NOT_ALLOWED', typeof name === 'string' ? { untrusted: { name } } : {}),
    ],
  })
  return {
    files,
    writes,
    state,
    read: async (name) => {
      state.onRead?.()
      await state.hold
      if (typeof name !== 'string' || !NAME_PATTERN.test(name)) return notAllowed(name)
      if (!files.has(name)) return { ok: false, problems: [problem('FILE_NOT_FOUND')] }
      return { ok: true, text: files.get(name) }
    },
    write: async (name, text, { mustBeNew = false } = {}) => {
      if (typeof name !== 'string' || !NAME_PATTERN.test(name)) return notAllowed(name)
      if (state.failWrites) return { ok: false, problems: [problem('FILE_SAVE_FAILED')] }
      if (mustBeNew && files.has(name)) return { ok: false, problems: [problem('FILE_NAME_TAKEN')] }
      files.set(name, text)
      writes.push({ name, text, mustBeNew })
      return { ok: true }
    },
  }
}

const makeHost = (initial) => {
  const store = fakeStore(initial)
  const lines = []
  let count = 0
  const host = createToolHost({
    store,
    now: () => NOW,
    newId: () => {
      count += 1
      return `step-${count}`
    },
    log: (line) => lines.push(line),
  })
  return { store, lines, call: host.callTool }
}

// A host with "team.json" open: Plan (complete) and Build (no queue).
const withOpenProject = async (extra = {}) => {
  const text = await fileText([step('a', 'Plan', COMPLETE), step('b', 'Build', { pt: 30 })], {
    edges: [{ id: 'e1', source: 'a', target: 'b' }],
  })
  const harness = makeHost({ 'team.json': text, ...extra })
  const opened = await harness.call('open_project', { name: 'team.json' })
  expect(opened.isError).toBe(false)
  harness.lines.length = 0
  return harness
}

const codes = (result) => result.content.problems.map(({ code }) => code)

describe('TOOLS', () => {
  it('offers exactly the project tools', () => {
    expect(TOOLS.map(({ name }) => name).toSorted()).toEqual(TOOL_NAMES.toSorted())
  })

  it('has no input named path, file, dir, url or command', () => {
    const inputs = TOOLS.flatMap(({ inputSchema }) => Object.keys(inputSchema.properties))
    expect(
      inputs.filter((input) => ['path', 'file', 'dir', 'url', 'command'].includes(input)),
    ).toEqual([])
  })

  it('gives each tool a short description', () => {
    for (const { name, description } of TOOLS) {
      expect(description, name).toMatch(/\S/)
      expect(description.length, name).toBeLessThan(100)
    }
  })

  it('gives each command in the table its tool, with its arguments as the schema properties', () => {
    for (const [name, { args }] of Object.entries(COMMANDS)) {
      const tool = TOOLS.find((candidate) => candidate.name === name)
      expect(tool, name).toBeDefined()
      expect(Object.keys(tool.inputSchema.properties), name).toEqual(args)
    }
  })

  it('types every argument and publishes object schemas that take no other argument', () => {
    for (const { name, inputSchema } of TOOLS) {
      expect(inputSchema.type, name).toBe('object')
      expect(inputSchema.additionalProperties, name).toBe(false)
      for (const [argument, schema] of Object.entries(inputSchema.properties)) {
        expect(schema.type, `${name}.${argument}`).toMatch(/^(string|number|integer)$/)
      }
    }
  })

  it('publishes the whole-number rule for pt, lt, queue and batch and the percent range for ca', () => {
    const { properties } = TOOLS.find(({ name }) => name === 'set_step_metrics').inputSchema
    for (const metric of ['pt', 'lt', 'queue', 'batch']) {
      expect(properties[metric], metric).toEqual({ type: 'integer', minimum: 0 })
    }
    expect(properties.ca).toEqual({ type: 'number', minimum: 0, maximum: 100 })
  })

  it('publishes the same schema for an argument in every tool that takes it', () => {
    const schemas = new Map()
    for (const { name, inputSchema } of TOOLS) {
      for (const [argument, schema] of Object.entries(inputSchema.properties)) {
        expect(schema, `${name}.${argument}`).toEqual(schemas.get(argument) ?? schema)
        schemas.set(argument, schema)
      }
    }
  })

  it('marks the names and step ids required and leaves the metrics and gate optional', () => {
    const required = Object.fromEntries(
      TOOLS.map(({ name, inputSchema }) => [name, inputSchema.required ?? []]),
    )
    expect(required).toEqual({
      create_project: ['name'],
      add_step: ['name'],
      update_step: ['stepId', 'name'],
      remove_step: ['stepId'],
      set_step_metrics: ['stepId'],
      connect: ['sourceId', 'targetId'],
      disconnect: ['sourceId', 'targetId'],
      open_project: ['name'],
      save_project: [],
      discard_changes: [],
      get_project: [],
      list_problems: [],
    })
    expect(TOOLS.find(({ name }) => name === 'get_project').inputSchema).not.toHaveProperty(
      'required',
    )
  })
})

describe('building a project from empty', () => {
  it('creates, edits and saves a project the app can import with the AI mark', async () => {
    const { call, store } = makeHost()
    const results = []
    results.push(await call('create_project', { name: 'Demo' }))
    const added = []
    for (const name of ['Plan', 'Build', 'Ship']) {
      const result = await call('add_step', { name })
      results.push(result)
      added.push(result.content.created)
    }
    results.push(await call('connect', { sourceId: added[0], targetId: added[1] }))
    results.push(await call('connect', { sourceId: added[1], targetId: added[2] }))
    results.push(
      await call('set_step_metrics', { stepId: added[0], pt: 5, lt: 10, ca: 95, queue: 2 }),
    )
    results.push(await call('save_project', { name: 'demo.json' }))

    expect(results.map(({ isError }) => isError)).toEqual(results.map(() => false))
    expect(store.writes).toHaveLength(1)
    const imported = await parseImport(store.files.get('demo.json'))
    expect(imported.ok).toBe(true)
    expect(imported.edited).toBe(false)
    expect(imported.changedBy).toEqual({ tool: 'aie-mcp', at: NOW.toISOString() })
    expect(imported.file.nodes.map(({ data }) => data.label)).toEqual(['Plan', 'Build', 'Ship'])
    expect(imported.file.edges).toHaveLength(2)
  })
})

describe('a failed command', () => {
  it('names the step, field and rule, and a follow-up call fixes it', async () => {
    const { call } = await withOpenProject()
    const failed = await call('set_step_metrics', { stepId: 'b', pt: -5 })
    expect(failed.isError).toBe(true)
    expect(failed.content.ok).toBe(false)
    expect(failed.content.problems).toHaveLength(1)
    const [found] = failed.content.problems
    expect(found).toMatchObject({ code: 'STEP_COUNT_INVALID', stepId: 'b', field: 'pt' })
    expect(found.message).toContain('"Build"')
    expect(found.message).toContain('0 or more')
    const fixed = await call('set_step_metrics', { stepId: 'b', pt: 30 })
    expect(fixed.isError).toBe(false)
    expect(fixed.content).toMatchObject({ ok: true, problems: [], total: 0 })
  })

  it('leaves the project as it was', async () => {
    const { call } = await withOpenProject()
    await call('set_step_metrics', { stepId: 'b', pt: -5 })
    const { content } = await call('get_project')
    expect(content.project.nodes[1].data).toEqual({ label: 'Build', pt: 30 })
    expect((await call('discard_changes')).content.summary).toBe('Discarded 0 changes')
  })
})

describe('bad arguments', () => {
  it('rejects add_step with no name, naming the name argument', async () => {
    const { call } = await withOpenProject()
    const result = await call('add_step', {})
    expect(result.isError).toBe(true)
    expect(result.content).toMatchObject({ ok: false, total: 1 })
    expect(result.content.problems[0]).toMatchObject({ code: 'STEP_NAME_EMPTY', field: 'name' })
    expect(result.content.summary).toMatch(/^Rejected add_step: nothing changed/)
  })

  it('treats missing arguments as an empty object', async () => {
    const { call } = await withOpenProject()
    expect(codes(await call('add_step'))).toEqual(['STEP_NAME_EMPTY'])
  })

  it.each([
    ['a string', 'Build'],
    ['null', null],
    ['an array', []],
    ['a number', 5],
  ])('rejects %s as the arguments for every tool', async (_label, args) => {
    const { call } = await withOpenProject()
    for (const { name } of TOOLS) {
      const result = await call(name, args)
      expect(result.isError, name).toBe(true)
      expect(codes(result), name).toEqual(['CMD_ARGUMENTS_INVALID'])
      expect(result.content.summary, name).toEqual(expect.any(String))
    }
  })

  it.each([
    ['add_step', { name: 'Build', x: 10 }],
    ['open_project', { name: 'team.json', path: '/etc/passwd' }],
    ['save_project', { name: 'a.json', dir: '..' }],
    ['get_project', { file: 'a.json' }],
    ['discard_changes', { force: true }],
    ['list_problems', { gate: 'data-complete', url: 'http://example.com' }],
  ])('rejects an unknown argument for %s', async (tool, args) => {
    const { call } = await withOpenProject()
    const result = await call(tool, args)
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['CMD_ARGUMENT_UNKNOWN'])
  })

  it('says a tool that takes no arguments accepts none', async () => {
    const { call } = await withOpenProject()
    const result = await call('get_project', { file: 'a.json' })
    expect(result.content.problems[0].message).toBe(
      'get_project does not accept file. Accepted arguments: none.',
    )
  })

  it('does not apply a command that has an unknown argument', async () => {
    const { call, lines } = await withOpenProject()
    await call('add_step', { name: 'Build', x: 10 })
    expect(lines).toEqual([])
    expect((await call('get_project')).content.project.nodes).toHaveLength(2)
  })

  it('answers an unknown tool with a problem listing the tools, never a throw', async () => {
    const { call } = makeHost()
    for (const name of ['nope', 'toString', '__proto__', '', undefined, 7]) {
      const result = await call(name, {})
      expect(result.isError).toBe(true)
      expect(codes(result)).toEqual(['CMD_TOOL_UNKNOWN'])
      expect(result.content.problems[0].message).toContain(
        `The tools are: ${TOOLS.map(({ name: tool }) => tool).join(', ')}.`,
      )
    }
  })

  it('keeps an unknown tool name out of the code, fix and field', async () => {
    const { call } = makeHost()
    const result = await call('rm -rf', {})
    const [found] = result.content.problems
    expect(found.untrusted).toEqual({ tool: 'rm -rf' })
    expect(found.code).toBe('CMD_TOOL_UNKNOWN')
    expect(found.fix).not.toContain('rm')
  })
})

describe('the result shape', () => {
  it('has ok, problems, total and summary for every tool, success and failure', async () => {
    const { call } = await withOpenProject()
    const calls = [
      ['get_project', {}],
      ['list_problems', {}],
      ['open_project', { name: 'team.json' }],
      ['save_project', {}],
      ['discard_changes', {}],
      ['set_step_metrics', { stepId: 'b', pt: -5 }],
    ]
    for (const [tool, args] of calls) {
      const { isError, content } = await call(tool, args)
      expect(typeof isError, tool).toBe('boolean')
      expect(typeof content.ok, tool).toBe('boolean')
      expect(content.ok, tool).toBe(!isError)
      expect(Array.isArray(content.problems), tool).toBe(true)
      expect(content.total, tool).toBe(content.problems.length)
      expect(content.summary, tool).toMatch(/\S/)
    }
  })

  it('puts the project only in get_project', async () => {
    const { call } = await withOpenProject()
    const results = {
      get_project: await call('get_project'),
      list_problems: await call('list_problems'),
      add_step: await call('add_step', { name: 'Ship' }),
      save_project: await call('save_project'),
      discard_changes: await call('discard_changes'),
      open_project: await call('open_project', { name: 'team.json' }),
    }
    for (const [tool, { content }] of Object.entries(results)) {
      expect('project' in content, tool).toBe(tool === 'get_project')
    }
    const { project } = results.get_project.content
    expect(project.project).toEqual({ id: 'p1', name: 'Checkout' })
    expect(project.nodes.map(({ id }) => id)).toEqual(['a', 'b'])
    expect(project.edges).toEqual([{ id: 'e1', source: 'a', target: 'b' }])
    expect(results.get_project.content.summary).toBe('Project "Checkout": 2 steps, 1 connection')
  })

  it('returns the new step id from add_step and the connection id from connect', async () => {
    const { call } = await withOpenProject()
    const added = await call('add_step', { name: 'Ship' })
    expect(added.content.created).toBe('step-1')
    const connected = await call('connect', { sourceId: 'b', targetId: 'step-1' })
    expect(connected.content.created).toBe('step-2')
    expect((await call('update_step', { stepId: 'a', name: 'Design' })).content).not.toHaveProperty(
      'created',
    )
  })
})

describe('list_problems', () => {
  it('names the step and field missing from a gate', async () => {
    const { call } = await withOpenProject()
    const result = await call('list_problems', { gate: 'data-complete' })
    expect(result.isError).toBe(false)
    expect(result.content.ok).toBe(true)
    expect(result.content.total).toBe(1)
    const [found] = result.content.problems
    expect(found).toMatchObject({ code: 'GATE_STEP_DATA_MISSING', stepId: 'b' })
    expect(found.message).toContain('"Build"')
    expect(found.message).toContain('queue')
    expect(result.content.summary).toBe('Gate "data-complete": 1 problem')
  })

  it('returns the gate problems and no structural problems when no gate is given', async () => {
    const { call } = await withOpenProject()
    const result = await call('list_problems')
    expect(result.isError).toBe(false)
    expect(codes(result)).toEqual(['GATE_STEP_DATA_MISSING'])
    expect(result.content.summary).toBe('All checks: 1 problem')
  })

  it('returns no problems for a valid, complete project', async () => {
    const { call } = makeHost({ 'full.json': await fileText([step('a', 'Plan', COMPLETE)]) })
    await call('open_project', { name: 'full.json' })
    const result = await call('list_problems')
    expect(result.content).toMatchObject({ ok: true, problems: [], total: 0 })
    expect(result.content.summary).toBe('All checks: 0 problems')
  })

  it('rejects an unknown gate and lists the known ones', async () => {
    const { call } = await withOpenProject()
    const result = await call('list_problems', { gate: 'nope' })
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['GATE_UNKNOWN'])
    expect(result.content.problems[0].message).toContain('data-complete')
  })

  it.each([null, 5, '', {}, ['data-complete'], [], 'toString', '__proto__', 'constructor'])(
    'rejects the gate %j as unknown',
    async (gate) => {
      const { call } = await withOpenProject()
      const result = await call('list_problems', { gate })
      expect(result.isError).toBe(true)
      expect(codes(result)).toEqual(['GATE_UNKNOWN'])
    },
  )

  it('returns 20 problems and a total of 25 when 25 steps are missing data', async () => {
    const nodes = Array.from({ length: 25 }, (_, i) => step(`s${i}`, `Step ${i}`))
    const { call } = makeHost({ 'big.json': await fileText(nodes) })
    await call('open_project', { name: 'big.json' })
    const result = await call('list_problems', { gate: 'data-complete' })
    expect(result.content.problems).toHaveLength(20)
    expect(result.content.total).toBe(25)
    expect(result.content.problems.map(({ stepId }) => stepId)).toEqual(
      nodes.slice(0, 20).map(({ id }) => id),
    )
    expect(result.content.summary).toBe('Gate "data-complete": 25 problems')
  })

  it('does not cap a list of exactly 20', async () => {
    const nodes = Array.from({ length: 20 }, (_, i) => step(`s${i}`, `Step ${i}`))
    const { call } = makeHost({ 'twenty.json': await fileText(nodes) })
    await call('open_project', { name: 'twenty.json' })
    const result = await call('list_problems', { gate: 'data-complete' })
    expect(result.content.problems).toHaveLength(20)
    expect(result.content.total).toBe(20)
  })

  it('caps the problems of a rejected call too', async () => {
    const nodes = Array.from({ length: 25 }, (_, i) => step(`s${i}`, `Step ${i}`, { pt: -1 }))
    const { call } = makeHost({ 'bad.json': await fileText(nodes) })
    const result = await call('open_project', { name: 'bad.json' })
    expect(result.isError).toBe(true)
    expect(result.content.problems).toHaveLength(20)
    expect(result.content.total).toBe(25)
    expect(new Set(codes(result))).toEqual(new Set(['STEP_COUNT_INVALID']))
  })
})

describe('a rejected call', () => {
  it.each([
    ['open_project', { name: 'missing.json' }],
    ['open_project', { name: 'bad.json' }],
    ['save_project', { name: '../x.json' }],
    ['save_project', { name: 'bad.json' }],
    ['list_problems', { gate: 'nope' }],
    ['add_step', {}],
  ])('says in its summary that %s changed nothing', async (tool, args) => {
    const { call } = await withOpenProject({ 'bad.json': 'not json' })
    const result = await call(tool, args)
    expect(result.isError).toBe(true)
    expect(result.content.summary).toMatch(
      new RegExp(`^Rejected ${tool}: nothing changed \\(\\d+ problems?\\)$`),
    )
  })

  it('says it for a save refused because the project has no name yet', async () => {
    const { call } = makeHost()
    await call('create_project', { name: 'Demo' })
    expect((await call('save_project')).content.summary).toMatch(/^Rejected save_project: /)
  })

  it('says it for a file that is not a valid project', async () => {
    const { call } = makeHost({ 'bad.json': await fileText([step('a', 'Plan', { pt: -1 })]) })
    expect((await call('open_project', { name: 'bad.json' })).content.summary).toMatch(
      /^Rejected open_project: /,
    )
  })

  it('says it for a failed write', async () => {
    const { call, store } = await withOpenProject()
    store.state.failWrites = true
    expect((await call('save_project')).content.summary).toMatch(/^Rejected save_project: /)
  })
})

describe('with no open project', () => {
  it.each(['add_step', 'get_project', 'list_problems', 'save_project', 'discard_changes'])(
    '%s is an error that names open_project and create_project',
    async (tool) => {
      const { call, store, lines } = makeHost()
      const result = await call(tool, {})
      expect(result.isError).toBe(true)
      expect(result.content.ok).toBe(false)
      expect(codes(result)).toEqual(['CMD_NO_PROJECT'])
      expect(result.content.problems[0].message).toContain('open_project')
      expect(result.content.problems[0].message).toContain('create_project')
      expect(store.writes).toEqual([])
      expect(lines).toEqual([])
    },
  )

  it('checks the arguments before the project', async () => {
    const { call } = makeHost()
    expect(codes(await call('get_project', { path: 'x' }))).toEqual(['CMD_ARGUMENT_UNKNOWN'])
  })

  it('checks the arguments of a command that needs a project after the project, once', async () => {
    const { call } = makeHost()
    expect(codes(await call('add_step', { name: 'Build', path: 'x' }))).toEqual(['CMD_NO_PROJECT'])
    expect(codes(await call('create_project', { name: 'Demo', path: 'x' }))).toEqual([
      'CMD_ARGUMENT_UNKNOWN',
    ])
  })
})

describe('the log', () => {
  it('logs one line for each applied command with the tool and its summary', async () => {
    const { call, lines } = await withOpenProject()
    await call('add_step', { name: 'Ship' })
    expect(lines).toEqual(['add_step: Added step "Ship" (step-1)'])
    await call('connect', { sourceId: 'b', targetId: 'step-1' })
    expect(lines).toEqual([
      'add_step: Added step "Ship" (step-1)',
      'connect: Connected "Build" to "Ship" (step-2)',
    ])
  })

  it('logs create_project', async () => {
    const { call, lines } = makeHost()
    await call('create_project', { name: 'Demo' })
    expect(lines).toEqual(['create_project: Created project "Demo"'])
  })

  it('escapes control characters so a step name stays on one line', async () => {
    const { call, lines } = await withOpenProject()
    await call('add_step', { name: 'Build\nInjected' })
    expect(lines).toEqual(['add_step: Added step "Build\\nInjected" (step-1)'])
    await call('add_step', { name: 'a\rb\tc\u0000d\u001be\u007ff\u0085g\u2028h' })
    expect(lines[1]).toBe(
      'add_step: Added step "a\\rb\\tc\\u0000d\\u001be\\u007ff\\u0085g\\u2028h" (step-2)',
    )
  })

  it('still returns the summary unescaped to the caller', async () => {
    const { call } = await withOpenProject()
    const result = await call('add_step', { name: 'Build\nInjected' })
    expect(result.content.summary).toBe('Added step "Build\nInjected" (step-1)')
  })

  it('logs nothing for a rejected command', async () => {
    const { call, lines } = await withOpenProject()
    await call('add_step', {})
    await call('set_step_metrics', { stepId: 'b', pt: -5 })
    await call('nope')
    await call('add_step', { name: 'Build', x: 1 })
    expect(lines).toEqual([])
  })

  it('logs nothing for a create_project that unsaved changes block', async () => {
    const { call, lines } = await withOpenProject()
    await call('add_step', { name: 'Ship' })
    lines.length = 0
    const blocked = await call('create_project', { name: 'Other' })
    expect(blocked.isError).toBe(true)
    expect(lines).toEqual([])
  })

  // Each starts from a project with one unsaved change, and a cleared log.
  it.each([
    ['get_project', undefined],
    ['list_problems', undefined],
    ['list_problems', { gate: 'data-complete' }],
    ['save_project', undefined],
    ['discard_changes', undefined],
    ['open_project', { name: 'missing.json' }],
  ])('logs nothing for %s %j', async (tool, args) => {
    const { call, lines } = await withOpenProject()
    await call('add_step', { name: 'Ship' })
    lines.length = 0
    const result = await call(tool, args)
    expect(result.content.summary).toBeTypeOf('string')
    expect(lines).toEqual([])
  })

  it('logs nothing for open_project of a saved file', async () => {
    const { call, lines } = await withOpenProject()
    lines.length = 0
    expect((await call('open_project', { name: 'team.json' })).isError).toBe(false)
    expect(lines).toEqual([])
  })
})

describe('open_project', () => {
  it('opens a saved file and says how many steps it has', async () => {
    const { call } = await withOpenProject()
    const reopened = await call('open_project', { name: 'team.json' })
    expect(reopened.content.summary).toBe('Opened "team.json": 2 steps')
    expect(reopened.content.problems).toEqual([])
    expect((await call('get_project')).content.project.project.name).toBe('Checkout')
  })

  it('returns the schemaVersion the file was written at', async () => {
    const { call } = await withOpenProject()
    const reopened = await call('open_project', { name: 'team.json' })
    expect(reopened.content.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('returns the original schemaVersion of an older file it upgraded on open', async () => {
    const older = await readFile(new URL('../src/flow/schema/fixtures/0.0.0.json', import.meta.url))
    const { call } = makeHost({ 'old.json': older.toString() })
    const opened = await call('open_project', { name: 'old.json' })
    expect(opened.isError).toBe(false)
    expect(opened.content.schemaVersion).toBe('0.0.0')
  })

  it('reads through the store and passes its problems on for a path-like name', async () => {
    const { call, store } = makeHost()
    const result = await call('open_project', { name: '../secret.json' })
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['FILE_NAME_NOT_ALLOWED'])
    expect(result.content.problems[0].untrusted).toEqual({ name: '../secret.json' })
    expect(store.writes).toEqual([])
  })

  it('needs a name', async () => {
    const { call } = makeHost()
    const result = await call('open_project', {})
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['FILE_NAME_NOT_ALLOWED'])
  })

  it.each([
    ['missing.json', {}, 'FILE_NOT_FOUND'],
    ['broken.json', { 'broken.json': 'not json' }, 'FILE_NOT_JSON'],
  ])('fails for %s and leaves no project open', async (name, files, code) => {
    const { call } = makeHost(files)
    const result = await call('open_project', { name })
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual([code])
    expect(codes(await call('get_project'))).toEqual(['CMD_NO_PROJECT'])
  })

  it('refuses a file with a negative pt and leaves no project open', async () => {
    const { call } = makeHost({ 'bad.json': await fileText([step('a', 'Plan', { pt: -1 })]) })
    const result = await call('open_project', { name: 'bad.json' })
    expect(codes(result)).toEqual(['STEP_COUNT_INVALID'])
    expect(codes(await call('get_project'))).toEqual(['CMD_NO_PROJECT'])
  })

  it('is blocked by unsaved changes and keeps the open project', async () => {
    const { call } = await withOpenProject({ 'other.json': await fileText([step('z', 'Other')]) })
    await call('add_step', { name: 'Ship' })
    const result = await call('open_project', { name: 'other.json' })
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['CMD_UNSAVED_CHANGES'])
    expect(result.content.problems[0].message).toContain('save_project')
    expect(result.content.problems[0].message).toContain('discard_changes')
    expect((await call('get_project')).content.project.nodes).toHaveLength(3)
  })

  it.each([
    ['a file that does not exist', 'missing.json'],
    ['a file that is not JSON', 'junk.json'],
  ])('is blocked by unsaved changes before it reads %s', async (_label, name) => {
    const { call, store } = await withOpenProject({ 'junk.json': 'not json {' })
    await call('add_step', { name: 'Ship' })
    let reads = 0
    store.state.onRead = () => {
      reads += 1
    }
    const result = await call('open_project', { name })
    expect(codes(result)).toEqual(['CMD_UNSAVED_CHANGES'])
    expect(result.content.summary).toBe('Rejected open_project: nothing changed (1 problem)')
    expect(reads).toBe(0)
  })
})

describe('unsaved changes', () => {
  it('block create_project and keep the open project', async () => {
    const { call } = await withOpenProject()
    await call('add_step', { name: 'Ship' })
    const result = await call('create_project', { name: 'Other' })
    expect(codes(result)).toEqual(['CMD_UNSAVED_CHANGES'])
    expect((await call('get_project')).content.project.project.name).toBe('Checkout')
  })

  it('do not come from a rejected command', async () => {
    const { call } = await withOpenProject()
    await call('add_step', {})
    expect((await call('create_project', { name: 'Other' })).isError).toBe(false)
  })

  it('are dropped by discard_changes, which says how many and allows another file', async () => {
    const { call } = await withOpenProject({ 'other.json': await fileText([step('z', 'Other')]) })
    await call('add_step', { name: 'Ship' })
    await call('add_step', { name: 'Test' })
    const result = await call('discard_changes')
    expect(result.isError).toBe(false)
    expect(result.content.summary).toBe('Discarded 2 changes')
    expect((await call('get_project')).content.project.nodes).toHaveLength(2)
    expect((await call('open_project', { name: 'other.json' })).isError).toBe(false)
  })

  it('are kept by save_project, which allows another file', async () => {
    const { call } = await withOpenProject({ 'other.json': await fileText([step('z', 'Other')]) })
    await call('add_step', { name: 'Ship' })
    expect((await call('save_project')).isError).toBe(false)
    expect((await call('open_project', { name: 'other.json' })).isError).toBe(false)
  })

  it('make discard_changes empty a created project that was never saved', async () => {
    const { call } = makeHost()
    await call('create_project', { name: 'Demo' })
    expect((await call('discard_changes')).content.summary).toBe('Discarded 1 change')
    expect(codes(await call('get_project'))).toEqual(['CMD_NO_PROJECT'])
  })
})

describe('save_project', () => {
  it('writes nothing until it is called', async () => {
    const { call, store } = await withOpenProject()
    await call('add_step', { name: 'Ship' })
    await call('get_project')
    expect(store.writes).toEqual([])
  })

  it('writes the laid-out project with the AI mark over the file it was opened from', async () => {
    const { call, store } = await withOpenProject()
    await call('add_step', { name: 'Ship' })
    const result = await call('save_project')
    expect(result.content.summary).toBe('Saved "team.json"')
    expect(store.writes).toHaveLength(1)
    expect(store.writes[0]).toMatchObject({ name: 'team.json', mustBeNew: false })
    const saved = JSON.parse(store.writes[0].text)
    expect(saved.modifiedBy).toEqual({ tool: 'aie-mcp', at: NOW.toISOString() })
    expect(saved.nodes.map(({ data }) => data.label)).toEqual(['Plan', 'Build', 'Ship'])
    expect(saved.nodes[0].position.x).toBeLessThan(saved.nodes[1].position.x)
  })

  it('needs a name for a project that was never saved', async () => {
    const { call, store } = makeHost()
    await call('create_project', { name: 'Demo' })
    const result = await call('save_project')
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['FILE_NAME_REQUIRED'])
    expect(store.writes).toEqual([])
  })

  it('writes a new project as a new file, then later saves overwrite it', async () => {
    const { call, store } = makeHost()
    await call('create_project', { name: 'Demo' })
    expect((await call('save_project', { name: 'demo.json' })).isError).toBe(false)
    expect(store.writes[0]).toMatchObject({ name: 'demo.json', mustBeNew: true })
    await call('add_step', { name: 'Plan' })
    expect((await call('save_project')).isError).toBe(false)
    expect(store.writes[1]).toMatchObject({ name: 'demo.json', mustBeNew: false })
    expect(JSON.parse(store.files.get('demo.json')).nodes).toHaveLength(1)
  })

  it('refuses a new project under a name that is taken, leaving that file unchanged', async () => {
    const { call, store } = makeHost({ 'team.json': 'original' })
    await call('create_project', { name: 'Demo' })
    const result = await call('save_project', { name: 'team.json' })
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['FILE_NAME_TAKEN'])
    expect(store.files.get('team.json')).toBe('original')
    expect(codes(await call('create_project', { name: 'Again' }))).toEqual(['CMD_UNSAVED_CHANGES'])
  })

  it('writes an opened project under a different name only as a new file', async () => {
    const { call, store } = await withOpenProject({ 'taken.json': 'original' })
    await call('add_step', { name: 'Ship' })
    expect(codes(await call('save_project', { name: 'taken.json' }))).toEqual(['FILE_NAME_TAKEN'])
    expect(store.files.get('taken.json')).toBe('original')
    expect((await call('save_project', { name: 'copy.json' })).isError).toBe(false)
    expect(store.writes.at(-1)).toMatchObject({ name: 'copy.json', mustBeNew: true })
    await call('add_step', { name: 'Test' })
    await call('save_project')
    expect(store.writes.at(-1)).toMatchObject({ name: 'copy.json', mustBeNew: false })
  })

  it.each(['../secret.json', '..', 'a/b.json', '', 'notes.txt', 5])(
    'passes the store problem on for the name %j',
    async (name) => {
      const { call, store } = await withOpenProject()
      await call('add_step', { name: 'Ship' })
      const result = await call('save_project', { name })
      expect(result.isError).toBe(true)
      expect(codes(result)).toEqual(['FILE_NAME_NOT_ALLOWED'])
      expect(store.writes).toEqual([])
    },
  )

  it('treats a null name like no name: it saves over the file the project came from', async () => {
    const { call, store } = await withOpenProject()
    await call('add_step', { name: 'Ship' })
    const result = await call('save_project', { name: null })
    expect(result.isError).toBe(false)
    expect(result.content.summary).toBe('Saved "team.json"')
    expect(store.writes).toHaveLength(1)
    expect(store.writes[0]).toMatchObject({ name: 'team.json', mustBeNew: false })
  })

  it('still needs a name for a never-saved project when the name is null', async () => {
    const { call, store } = makeHost()
    await call('create_project', { name: 'Demo' })
    const result = await call('save_project', { name: null })
    expect(codes(result)).toEqual(['FILE_NAME_REQUIRED'])
    expect(store.writes).toEqual([])
  })

  it('keeps the project open with its unsaved changes when the write fails', async () => {
    const { call, store } = await withOpenProject({
      'other.json': await fileText([step('z', 'Z')]),
    })
    await call('add_step', { name: 'Ship' })
    store.state.failWrites = true
    const failed = await call('save_project')
    expect(failed.isError).toBe(true)
    expect(codes(failed)).toEqual(['FILE_SAVE_FAILED'])
    expect((await call('get_project')).content.project.nodes).toHaveLength(3)
    expect(codes(await call('open_project', { name: 'other.json' }))).toEqual([
      'CMD_UNSAVED_CHANGES',
    ])
    store.state.failWrites = false
    expect((await call('save_project')).isError).toBe(false)
  })
})

describe('serialising calls', () => {
  it('runs a call only after the call before it has finished, so no change is lost', async () => {
    const { call, store } = await withOpenProject({
      'other.json': await fileText([step('z', 'Zed')], { name: 'Other' }),
    })
    let release
    store.state.hold = new Promise((resolve) => {
      release = resolve
    })
    // Resolves once the open's read is waiting on the hold, so the second call is queued behind it.
    const reading = new Promise((resolve) => {
      store.state.onRead = resolve
    })
    const opening = call('open_project', { name: 'other.json' })
    let added
    const adding = call('add_step', { name: 'Ship' }).then((result) => {
      added = result
      return result
    })
    await reading
    // One turn of the event loop lets every ready continuation run, without waiting on a clock.
    await new Promise((resolve) => setImmediate(resolve))
    expect(added).toBeUndefined()
    release()
    const [opened, addedResult] = await Promise.all([opening, adding])
    expect(opened.isError).toBe(false)
    expect(addedResult.isError).toBe(false)
    const { content } = await call('get_project')
    expect(content.project.project.name).toBe('Other')
    expect(content.project.nodes.map(({ data }) => data.label)).toEqual(['Zed', 'Ship'])
    expect(codes(await call('create_project', { name: 'Next' }))).toEqual(['CMD_UNSAVED_CHANGES'])
  })

  it('keeps the applied change and its summary when the log throws', async () => {
    const host = createToolHost({
      store: fakeStore(),
      now: () => NOW,
      newId: () => 'id',
      log: () => {
        throw new Error('stderr closed')
      },
    })
    const created = await host.callTool('create_project', { name: 'Demo' })
    expect(created.isError).toBe(false)
    expect(created.content.summary).toBe('Created project "Demo"')
    const added = await host.callTool('add_step', { name: 'Build' })
    expect(added.isError).toBe(false)
    expect(added.content.created).toBe('id')
    const { content } = await host.callTool('get_project')
    expect(content.project.nodes.map(({ data }) => data.label)).toEqual(['Build'])
  })
})

describe('a tool that throws unexpectedly', () => {
  const throwing = async (breakStore) => {
    const store = fakeStore({ 'team.json': await fileText([step('a', 'Plan')]) })
    const host = createToolHost({ store, now: () => NOW, newId: () => 'id', log: () => {} })
    breakStore(store)
    return { store, host }
  }

  it('is answered with CMD_INTERNAL_ERROR and no project change, never a throw', async () => {
    const { host } = await throwing((store) => {
      store.read = async () => {
        throw new Error('disk gone')
      }
    })
    const result = await host.callTool('open_project', { name: 'team.json' })
    expect(result.isError).toBe(true)
    expect(codes(result)).toEqual(['CMD_INTERNAL_ERROR'])
    expect(result.content).toMatchObject({ ok: false, total: 1 })
    expect(result.content.summary).toBe('Rejected open_project: nothing changed (1 problem)')
    expect(JSON.stringify(result)).not.toContain('disk gone')
  })

  it('keeps the open project and answers the next call when a save throws', async () => {
    const { store, host } = await throwing(() => {})
    await host.callTool('open_project', { name: 'team.json' })
    await host.callTool('add_step', { name: 'Ship' })
    const write = store.write
    store.write = () => {
      throw new Error('disk gone')
    }
    const failed = await host.callTool('save_project')
    expect(codes(failed)).toEqual(['CMD_INTERNAL_ERROR'])
    store.write = write
    const { content } = await host.callTool('get_project')
    expect(content.project.nodes.map(({ data }) => data.label)).toEqual(['Plan', 'Ship'])
    expect((await host.callTool('save_project')).isError).toBe(false)
  })

  it('does not stop the calls queued behind it', async () => {
    const { store, host } = await throwing((broken) => {
      broken.read = async () => {
        throw new Error('disk gone')
      }
    })
    const first = host.callTool('open_project', { name: 'team.json' })
    const second = host.callTool('get_project')
    expect((await first).isError).toBe(true)
    expect(codes(await second)).toEqual(['CMD_NO_PROJECT'])
    expect(store.files.size).toBe(1)
  })

  it('does not log the failed call', async () => {
    const lines = []
    const store = fakeStore()
    store.read = async () => {
      throw new Error('disk gone')
    }
    const host = createToolHost({
      store,
      now: () => NOW,
      newId: () => 'id',
      log: (line) => lines.push(line),
    })
    await host.callTool('open_project', { name: 'team.json' })
    expect(lines).toEqual([])
  })
})

describe('toCallResult', () => {
  it('carries the content as JSON text and as structured content, with its error flag', () => {
    const content = { ok: false, problems: [{ code: 'X' }], total: 1, summary: 'Rejected x' }
    const result = toCallResult({ isError: true, content })
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify(content) }],
      structuredContent: content,
      isError: true,
    })
  })

  it('maps a host result end to end, with isError false for an applied call', async () => {
    const { call } = makeHost()
    const result = toCallResult(await call('create_project', { name: 'Demo' }))
    expect(result.isError).toBe(false)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
    expect(result.structuredContent.summary).toBe('Created project "Demo"')
  })
})
