import { describe, expect, it } from 'vitest'
import { applyCommand, applyCommands, COMMANDS, rejectCommand, replacesProject } from './index.js'
import { MAX_ECHOED_TEXT } from '../text.js'
import { makeRun, onlyProblem } from './testHelpers.js'

const newId = () => 'project-1'
const run = makeRun(newId)

const existing = Object.freeze({
  project: { id: 'p-0', name: 'Existing' },
  nodes: [],
  edges: [],
})

describe('create_project', () => {
  it('succeeds with a named project, no steps and no connections', () => {
    const result = run(null, 'create_project', { name: 'Checkout' })
    expect(result.ok).toBe(true)
    expect(result.project).toEqual({
      project: { id: 'project-1', name: 'Checkout' },
      nodes: [],
      edges: [],
    })
    expect(result.problems).toEqual([])
    expect(result.summary).toContain('Checkout')
    expect(result).not.toHaveProperty('created')
  })

  it.each(['', '  ', undefined, null, 7])(
    'fails with the empty-name problem for the name %j',
    (name) => {
      const problem = onlyProblem(run(null, 'create_project', { name }))
      expect(problem.code).toBe('FILE_PROJECT_NAME_EMPTY')
    },
  )

  it('returns no project when creation fails', () => {
    expect(run(null, 'create_project', { name: '  ' }).project).toBeNull()
  })

  it('fails when the generated id is empty', () => {
    const problem = onlyProblem(makeRun(() => '')(null, 'create_project', { name: 'Checkout' }))
    expect(problem.code).toBe('FILE_PROJECT_ID_MISSING')
  })
})

describe('applyCommand argument checks', () => {
  it('rejects an unknown command, naming it and the valid commands', () => {
    const result = run(existing, 'drop_database', {})
    const problem = onlyProblem(result)
    expect(problem.code).toBe('CMD_UNKNOWN')
    expect(problem.message).toBe(
      `Unknown command drop_database. The commands are: ${Object.keys(COMMANDS).join(', ')}.`,
    )
    expect(problem.untrusted).toEqual({ command: 'drop_database' })
    expect(result.project).toBe(existing)
  })

  it.each([
    undefined,
    null,
    { name: undefined },
    { name: '' },
    { name: '   ' },
    { name: 5 },
    { name: 'toString' },
    { name: { toString: 1 } },
  ])('rejects the malformed command %j without throwing, calling it "(no name)"', (command) => {
    const result = applyCommand(existing, command, { newId })
    const problem = onlyProblem(result)
    expect(problem.code).toBe('CMD_UNKNOWN')
    expect(problem.message).toMatch(/^Unknown command (\(no name\)|toString)\. The commands are:/)
    expect(result.summary).toMatch(
      /^Rejected (\(no name\)|toString): nothing changed \(1 problem\)$/,
    )
  })

  it('says "(no name)" in both the message and the summary when the name is not text', () => {
    const result = applyCommand(existing, { name: 5 }, { newId })
    expect(result.problems[0].message).toMatch(/^Unknown command \(no name\)\./)
    expect(result.summary).toBe('Rejected (no name): nothing changed (1 problem)')
  })

  it('cuts a long command name in the message but keeps it whole in untrusted', () => {
    const name = 'x'.repeat(200)
    const problem = onlyProblem(applyCommand(existing, { name }, { newId }))
    expect(problem.message).not.toContain(name)
    expect(problem.message).toContain(`${'x'.repeat(79)}…`)
    expect(problem.untrusted).toEqual({ command: name })
  })

  it('rejects arguments that are not accepted, naming each and the accepted ones', () => {
    const result = run(existing, 'create_project', { name: 'A', x: 100, y: 50 })
    const problem = onlyProblem(result)
    expect(problem.code).toBe('CMD_ARGUMENT_UNKNOWN')
    expect(problem.message).toBe('create_project does not accept x, y. Accepted arguments: name.')
    expect(problem.untrusted).toEqual({ arguments: ['x', 'y'] })
    expect(result.project).toBe(existing)
  })

  it('lists the first 10 unknown arguments in the message and all of them in untrusted', () => {
    const keys = Array.from({ length: 1000 }, (_, i) => `k${i}`)
    const args = Object.fromEntries(keys.map((key) => [key, 1]))
    const problem = onlyProblem(run(existing, 'create_project', args))
    expect(problem.message).toBe(
      `create_project does not accept ${keys.slice(0, 10).join(', ')}, and 990 more. Accepted arguments: name.`,
    )
    expect(problem.untrusted).toEqual({ arguments: keys })
  })

  it('lists exactly 10 unknown arguments without a count of more', () => {
    const args = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, 1]))
    const { message } = onlyProblem(run(existing, 'create_project', args))
    expect(message).toBe(
      'create_project does not accept k0, k1, k2, k3, k4, k5, k6, k7, k8, k9. Accepted arguments: name.',
    )
  })

  it('keeps unknown argument names out of code, fix and field', () => {
    const problem = onlyProblem(run(existing, 'create_project', { 'x<script>': 1 }))
    expect(problem).not.toHaveProperty('field')
    expect(`${problem.code} ${problem.fix}`).not.toContain('script')
  })

  it.each([null, 'Checkout', 7, ['name']])('rejects arguments that are %j', (args) => {
    const problem = onlyProblem(run(existing, 'create_project', args))
    expect(problem.code).toBe('CMD_ARGUMENTS_INVALID')
    expect(problem.message).toBe(
      'The arguments for create_project must be an object of named values.',
    )
  })

  it('treats missing arguments as none, so the command itself reports what is missing', () => {
    const problem = onlyProblem(applyCommand(existing, { name: 'create_project' }, { newId }))
    expect(problem.code).toBe('FILE_PROJECT_NAME_EMPTY')
  })
})

describe('applyCommand results', () => {
  it('returns the same project object when the candidate is rejected', () => {
    const result = run(existing, 'create_project', { name: ' ' })
    expect(result.ok).toBe(false)
    expect(result.project).toBe(existing)
    expect(result.problems[0].code).toBe('FILE_PROJECT_NAME_EMPTY')
    expect(result.summary).toBe('Rejected create_project: nothing changed (1 problem)')
  })

  it('counts several problems in the summary', () => {
    const result = applyCommand(
      existing,
      { name: 'create_project', args: { name: '' } },
      { newId: () => '' },
    )
    expect(result.problems).toHaveLength(2)
    expect(result.summary).toBe('Rejected create_project: nothing changed (2 problems)')
  })

  it('does not change the project it was given when it succeeds', () => {
    const before = structuredClone(existing)
    const result = run(existing, 'create_project', { name: 'New' })
    expect(result.ok).toBe(true)
    expect(result.project).not.toBe(existing)
    expect(existing).toEqual(before)
  })
})

describe('applyCommand with no project open', () => {
  const NEEDS_PROJECT = [
    ['add_step', { name: 'Build' }],
    ['update_step', { stepId: 'a', name: 'B' }],
    ['set_step_metrics', { stepId: 'a', pt: 1 }],
    ['remove_step', { stepId: 'a' }],
    ['connect', { sourceId: 'a', targetId: 'b' }],
    ['disconnect', { sourceId: 'a', targetId: 'b' }],
    ['move_step', { stepId: 'a', x: 1, y: 2 }],
  ]

  it.each(NEEDS_PROJECT)('rejects %s with CMD_NO_PROJECT instead of throwing', (name, args) => {
    const result = run(null, name, args)
    expect(onlyProblem(result)).toMatchObject({
      code: 'CMD_NO_PROJECT',
      message: 'No project is open. Call open_project or create_project first.',
    })
    expect(result.project).toBeNull()
    expect(result.summary).toBe(`Rejected ${name}: nothing changed (1 problem)`)
  })

  it('rejects an undefined project the same way', () => {
    expect(onlyProblem(run(undefined, 'remove_step', { stepId: 'a' })).code).toBe('CMD_NO_PROJECT')
  })

  it('reports the missing project before an argument it does not accept', () => {
    expect(onlyProblem(run(null, 'add_step', { name: 'A', x: 1 })).code).toBe('CMD_NO_PROJECT')
  })

  it('still creates a project', () => {
    expect(run(null, 'create_project', { name: 'Checkout' }).ok).toBe(true)
  })
})

describe('applyCommand with values that are not text', () => {
  const open = Object.freeze({
    project: { id: 'p-1', name: 'Checkout' },
    nodes: [
      { id: 'idea', type: 'step', position: { x: 0, y: 0 }, data: { label: 'Idea' } },
      { id: 'build', type: 'step', position: { x: 0, y: 0 }, data: { label: 'Build' } },
    ],
    edges: [{ id: 'e1', source: 'idea', target: 'build' }],
  })

  // JSON can carry these where an id, a name or a number belongs.
  const HOSTILE = [{ toString: 1 }, {}, [], [{ toString: 1 }]]

  const CASES = [
    ['create_project', 'name', {}],
    ['add_step', 'name', {}],
    ['add_step', 'pt', { name: 'A' }],
    ['update_step', 'stepId', { name: 'A' }],
    ['update_step', 'name', { stepId: 'idea' }],
    ['set_step_metrics', 'stepId', { pt: 1 }],
    ['set_step_metrics', 'pt', { stepId: 'idea' }],
    ['remove_step', 'stepId', {}],
    ['connect', 'sourceId', { targetId: 'build' }],
    ['connect', 'targetId', { sourceId: 'idea' }],
    ['disconnect', 'sourceId', { targetId: 'build' }],
    ['disconnect', 'targetId', { sourceId: 'idea' }],
    ['move_step', 'stepId', { x: 1, y: 2 }],
    ['move_step', 'x', { stepId: 'idea', y: 2 }],
    ['move_step', 'y', { stepId: 'idea', x: 1 }],
  ]

  it.each(CASES.flatMap((entry) => HOSTILE.map((value) => [entry[0], entry[1], value, entry[2]])))(
    '%s rejects %s %j with problems and never throws',
    (name, key, value, others) => {
      const result = run(open, name, { ...others, [key]: value })
      expect(result.ok).toBe(false)
      expect(result.problems.length).toBeGreaterThan(0)
      expect(result.project).toBe(open)
      expect(result.summary).toMatch(/^Rejected \w+: nothing changed/)
    },
  )
})

describe('replacesProject', () => {
  it('is true for create_project only', () => {
    expect(replacesProject({ name: 'create_project', args: { name: 'A' } })).toBe(true)
    expect(replacesProject({ name: 'add_step', args: { name: 'A' } })).toBe(false)
    expect(replacesProject({ name: 'connect' })).toBe(false)
  })

  it.each([
    null,
    undefined,
    {},
    { name: 5 },
    { name: 'nope' },
    { name: 'toString' },
    { name: '__proto__' },
    { name: { toString: () => 'create_project' } },
  ])('is false for the command %j', (command) => {
    expect(replacesProject(command)).toBe(false)
  })
})

describe('rejectCommand', () => {
  it('returns the problems and a summary that says nothing changed, and no project', () => {
    const problems = [{ code: 'A' }, { code: 'B' }]
    expect(rejectCommand('create_project', problems)).toEqual({
      ok: false,
      problems,
      summary: 'Rejected create_project: nothing changed (2 problems)',
    })
  })

  it('cuts a long command name short in the summary', () => {
    const { summary } = rejectCommand('x'.repeat(200), [])
    expect(summary).not.toContain('x'.repeat(MAX_ECHOED_TEXT + 1))
    expect(summary).toMatch(/^Rejected x+.*: nothing changed \(0 problems\)$/)
  })
})

describe('applyCommands', () => {
  const plan = { id: 'plan', type: 'step', position: { x: 0, y: 0 }, data: { label: 'Plan' } }
  const build = { id: 'build', type: 'step', position: { x: 0, y: 0 }, data: { label: 'Build' } }
  const test = { id: 'test', type: 'step', position: { x: 0, y: 0 }, data: { label: 'Test' } }
  const edge = (source, target) => ({ id: `${source}-${target}`, source, target })
  const line = Object.freeze({
    project: { id: 'p-1', name: 'Delivery' },
    nodes: [plan, build, test],
    edges: [edge('plan', 'build'), edge('build', 'test')],
  })
  const counter = () => {
    let count = 0
    return () => `id-${++count}`
  }
  const apply = (project, commands) => applyCommands(project, commands, { newId: counter() })

  it('applies every command in order and returns the last project', () => {
    const result = apply(line, [
      { name: 'disconnect', args: { sourceId: 'plan', targetId: 'build' } },
      { name: 'remove_step', args: { stepId: 'test' } },
    ])
    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.problems).toEqual([])
    expect(result.project.nodes.map(({ id }) => id)).toEqual(['plan', 'build'])
    expect(result.project.edges).toEqual([])
    expect(result.summary).toBe(
      'Disconnected "Plan" from "Build"; Removed step "Test" (test); 1 connection was removed',
    )
    expect(line.nodes).toHaveLength(3)
    expect(line.edges).toHaveLength(2)
  })

  it('lets a later command see what an earlier one made', () => {
    const result = apply(line, [
      { name: 'add_step', args: { name: 'Ship' } },
      { name: 'connect', args: { sourceId: 'test', targetId: 'id-1' } },
    ])
    expect(result.ok).toBe(true)
    expect(result.project.nodes.at(-1).id).toBe('id-1')
    expect(result.project.edges.at(-1)).toMatchObject({ source: 'test', target: 'id-1' })
  })

  it('gives ids from newId in command order', () => {
    const result = apply(line, [
      { name: 'add_step', args: { name: 'A' } },
      { name: 'add_step', args: { name: 'B' } },
    ])
    expect(result.project.nodes.slice(3).map(({ id }) => id)).toEqual(['id-1', 'id-2'])
  })

  it('stops at the first rejected command: only its problems, the original project, no later run', () => {
    const result = apply(line, [
      { name: 'remove_step', args: { stepId: 'build' } },
      { name: 'remove_step', args: { stepId: 'Nope' } },
      { name: 'remove_step', args: { stepId: 'Gone' } },
    ])
    expect(result.ok).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.project).toBe(line)
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0].code).toBe('STEP_NOT_FOUND')
    expect(result.problems[0].untrusted.id).toBe('Nope')
    expect(result.summary).toBe('Rejected remove_step: nothing changed (1 problem)')
  })

  it('rejects an unknown command in the middle and keeps the original project', () => {
    const result = apply(line, [
      { name: 'remove_step', args: { stepId: 'plan' } },
      { name: 'fly', args: {} },
    ])
    expect(onlyProblem(result).code).toBe('CMD_UNKNOWN')
    expect(result.project).toBe(line)
  })

  it('treats an empty list as an accepted edit that changes nothing', () => {
    const result = apply(line, [])
    expect(result).toMatchObject({ ok: true, changed: false, problems: [], summary: '' })
    expect(result.project).toBe(line)
  })

  it('does not need an open project for an empty list', () => {
    const result = apply(null, [])
    expect(result.ok).toBe(true)
    expect(result.project).toBeNull()
  })

  it('rejects the first command when no project is open', () => {
    const result = apply(null, [{ name: 'remove_step', args: { stepId: 'plan' } }])
    expect(onlyProblem(result).code).toBe('CMD_NO_PROJECT')
    expect(result.project).toBeNull()
  })
})
