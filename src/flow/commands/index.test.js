import { describe, expect, it } from 'vitest'
import { applyCommand, createProject } from './index.js'

const newId = () => 'project-1'

const existing = Object.freeze({
  project: { id: 'p-0', name: 'Existing' },
  nodes: [],
  edges: [],
})

const onlyProblem = (result) => {
  expect(result.ok).toBe(false)
  expect(result.problems).toHaveLength(1)
  return result.problems[0]
}

describe('createProject', () => {
  it('succeeds with a named project, no steps and no connections', () => {
    const result = createProject({ name: 'Checkout' }, { newId })
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
      const problem = onlyProblem(createProject({ name }, { newId }))
      expect(problem.code).toBe('FILE_PROJECT_NAME_EMPTY')
    },
  )

  it('returns no project when creation fails', () => {
    expect(createProject({ name: '  ' }, { newId }).project).toBeNull()
  })

  it('fails when the generated id is empty', () => {
    const problem = onlyProblem(createProject({ name: 'Checkout' }, { newId: () => '' }))
    expect(problem.code).toBe('FILE_PROJECT_ID_MISSING')
  })
})

describe('applyCommand argument checks', () => {
  it('rejects an unknown command, naming it and the valid commands', () => {
    const result = applyCommand(existing, { name: 'drop_database', args: {} }, { newId })
    const problem = onlyProblem(result)
    expect(problem.code).toBe('CMD_UNKNOWN')
    expect(problem.message).toContain('drop_database')
    expect(problem.message).toContain('create_project')
    expect(problem.untrusted).toEqual({ command: 'drop_database' })
    expect(result.project).toBe(existing)
  })

  it.each([undefined, null, { name: undefined }, { name: 5 }, { name: 'toString' }])(
    'rejects the malformed command %j without throwing',
    (command) => {
      expect(onlyProblem(applyCommand(existing, command, { newId })).code).toBe('CMD_UNKNOWN')
    },
  )

  it('cuts a long command name in the message but keeps it whole in untrusted', () => {
    const name = 'x'.repeat(200)
    const problem = onlyProblem(applyCommand(existing, { name }, { newId }))
    expect(problem.message).not.toContain(name)
    expect(problem.message).toContain(`${'x'.repeat(79)}…`)
    expect(problem.untrusted).toEqual({ command: name })
  })

  it('rejects arguments that are not accepted, naming each and the accepted ones', () => {
    const result = applyCommand(
      existing,
      { name: 'create_project', args: { name: 'A', x: 100, y: 50 } },
      { newId },
    )
    const problem = onlyProblem(result)
    expect(problem.code).toBe('CMD_ARGUMENT_UNKNOWN')
    expect(problem.message).toBe('create_project does not accept x, y. Accepted arguments: name.')
    expect(problem.untrusted).toEqual({ arguments: ['x', 'y'] })
    expect(result.project).toBe(existing)
  })

  it('keeps unknown argument names out of code, fix and field', () => {
    const problem = onlyProblem(
      applyCommand(existing, { name: 'create_project', args: { 'x<script>': 1 } }, { newId }),
    )
    expect(problem).not.toHaveProperty('field')
    expect(`${problem.code} ${problem.fix}`).not.toContain('script')
  })

  it.each([null, 'Checkout', 7, ['name']])('rejects arguments that are %j', (args) => {
    const problem = onlyProblem(applyCommand(existing, { name: 'create_project', args }, { newId }))
    expect(problem.code).toBe('CMD_ARGUMENTS_INVALID')
  })

  it('treats missing arguments as none, so the command itself reports what is missing', () => {
    const problem = onlyProblem(applyCommand(existing, { name: 'create_project' }, { newId }))
    expect(problem.code).toBe('FILE_PROJECT_NAME_EMPTY')
  })
})

describe('applyCommand results', () => {
  it('returns the same project object when the candidate is rejected', () => {
    const result = applyCommand(
      existing,
      { name: 'create_project', args: { name: ' ' } },
      { newId },
    )
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
    const result = applyCommand(
      existing,
      { name: 'create_project', args: { name: 'New' } },
      { newId },
    )
    expect(result.ok).toBe(true)
    expect(result.project).not.toBe(existing)
    expect(existing).toEqual(before)
  })
})
