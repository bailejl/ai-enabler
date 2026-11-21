import { describe, expect, it } from 'vitest'
import { applyCommand } from './index.js'

const newId = () => 'step-1'

const empty = Object.freeze({ project: { id: 'p-1', name: 'Checkout' }, nodes: [], edges: [] })

const node = (id, label, data = {}) => ({
  id,
  type: 'step',
  position: { x: 0, y: 0 },
  data: { label, ...data },
})

const projectWith = (nodes, edges = []) => ({ ...empty, nodes, edges })

const run = (project, name, args) => applyCommand(project, { name, args }, { newId })

const onlyProblem = (result) => {
  expect(result.ok).toBe(false)
  expect(result.problems).toHaveLength(1)
  return result.problems[0]
}

describe('add_step', () => {
  it('adds the step and gives its id', () => {
    const result = run(empty, 'add_step', { name: 'Build' })
    expect(result.ok).toBe(true)
    expect(result.created).toBe('step-1')
    expect(result.project.nodes).toEqual([node('step-1', 'Build')])
    expect(result.summary).toBe('Added step "Build" (step-1)')
    expect(empty.nodes).toEqual([])
  })

  it('keeps the metrics given with the name', () => {
    const result = run(empty, 'add_step', { name: 'Build', pt: 30, ca: 90 })
    expect(result.project.nodes[0].data).toEqual({ label: 'Build', pt: 30, ca: 90 })
  })

  it.each([undefined, '', '   ', 7, null])('rejects the name %j', (name) => {
    const result = run(empty, 'add_step', { name })
    const found = onlyProblem(result)
    expect(found.code).toBe('STEP_NAME_EMPTY')
    expect(found.field).toBe('name')
    expect(found.message).toBe('The new step: the name (name) must be text that is not empty.')
    expect(result.project).toBe(empty)
  })

  it('does not add a step with an invalid value, naming the step and field', () => {
    const result = run(empty, 'add_step', { name: 'Build', pt: -1 })
    const found = onlyProblem(result)
    expect(found.code).toBe('STEP_COUNT_INVALID')
    expect(found.field).toBe('pt')
    expect(found.message).toContain('"Build"')
    expect(result.project).toBe(empty)
    expect(result.project.nodes).toHaveLength(0)
  })

  it('does not accept a position', () => {
    const problem = onlyProblem(run(empty, 'add_step', { name: 'Build', x: 100, y: 50 }))
    expect(problem.code).toBe('CMD_ARGUMENT_UNKNOWN')
    expect(problem.message).toContain('x, y')
  })

  it('cuts a long name in the summary but keeps it whole in the project', () => {
    const name = 'n'.repeat(200)
    const result = run(empty, 'add_step', { name })
    expect(result.summary).toBe(`Added step "${'n'.repeat(79)}…" (step-1)`)
    expect(result.project.nodes[0].data.label).toBe(name)
  })

  it('rejects an id the project already uses', () => {
    const result = run(projectWith([node('step-1', 'Idea')]), 'add_step', { name: 'Build' })
    expect(onlyProblem(result).code).toBe('STEP_ID_DUPLICATE')
  })
})

const build = node('build', 'Build', { queue: 4 })

describe('update_step', () => {
  it('renames the step and nothing else', () => {
    const before = projectWith([node('idea', 'Idea'), build])
    const result = run(before, 'update_step', { stepId: 'build', name: 'Build and test' })
    expect(result.ok).toBe(true)
    expect(result.project.nodes).toEqual([
      node('idea', 'Idea'),
      node('build', 'Build and test', { queue: 4 }),
    ])
    expect(result.summary).toBe('Renamed step "Build" (build) to "Build and test"')
    expect(before.nodes[1].data.label).toBe('Build')
  })

  it.each([undefined, '  ', 3])('rejects the name %j and names the step', (name) => {
    const before = projectWith([build])
    const result = run(before, 'update_step', { stepId: 'build', name })
    const found = onlyProblem(result)
    expect(found.code).toBe('STEP_NAME_EMPTY')
    expect(found.message).toContain('"Build"')
    expect(result.project).toBe(before)
  })

  it('reports a missing step and a blank name together', () => {
    const result = run(projectWith([build]), 'update_step', { stepId: 'ghost', name: '' })
    expect(result.problems.map(({ code }) => code)).toEqual(['STEP_NOT_FOUND', 'STEP_NAME_EMPTY'])
    expect(result.problems[1].message).toContain('The step: the name (name)')
  })

  it('does not accept a position', () => {
    const before = projectWith([build])
    const result = run(before, 'update_step', { stepId: 'build', x: 100, y: 50 })
    const found = onlyProblem(result)
    expect(found.code).toBe('CMD_ARGUMENT_UNKNOWN')
    expect(found.message).toContain('does not accept x, y')
    expect(result.project).toBe(before)
  })
})

describe('set_step_metrics', () => {
  it.each([
    ['pt', 120],
    ['lt', 600],
    ['ca', 80],
    ['queue', 6],
    ['batch', 3],
  ])('sets %s to %d and leaves the queue alone unless it was the field set', (field, value) => {
    const result = run(projectWith([build]), 'set_step_metrics', {
      stepId: 'build',
      [field]: value,
    })
    expect(result.ok).toBe(true)
    expect(result.project.nodes[0].data).toEqual({
      label: 'Build',
      queue: 4,
      [field]: value,
    })
    expect(result.summary).toBe(`Set ${field}=${value} on step "Build" (build)`)
  })

  it('sets several metrics in one command', () => {
    const result = run(projectWith([build]), 'set_step_metrics', {
      stepId: 'build',
      pt: 30,
      ca: 95,
    })
    expect(result.project.nodes[0].data).toEqual({ label: 'Build', queue: 4, pt: 30, ca: 95 })
    expect(result.summary).toBe('Set pt=30, ca=95 on step "Build" (build)')
  })

  it('accepts the metric fields but not the title or a position', () => {
    const before = projectWith([build])
    const result = run(before, 'set_step_metrics', { stepId: 'build', label: 'X', x: 1 })
    const found = onlyProblem(result)
    expect(found.code).toBe('CMD_ARGUMENT_UNKNOWN')
    expect(found.message).toBe(
      'set_step_metrics does not accept label, x. Accepted arguments: stepId, pt, lt, ca, queue, batch.',
    )
    expect(result.project).toBe(before)
  })

  it('reports every invalid metric and leaves the project unchanged', () => {
    const before = projectWith([build])
    const result = run(before, 'set_step_metrics', { stepId: 'build', pt: -1, ca: 150 })
    expect(result.ok).toBe(false)
    expect(result.problems).toHaveLength(2)
    expect(result.problems.map(({ field }) => field)).toEqual(['pt', 'ca'])
    result.problems.forEach((found) => {
      expect(found.message).toContain('"Build"')
      expect(found.stepId).toBe('build')
    })
    expect(result.project).toBe(before)
  })

  it('changes nothing and says so when no metric is given', () => {
    const result = run(projectWith([build]), 'set_step_metrics', { stepId: 'build' })
    expect(result.ok).toBe(true)
    expect(result.project.nodes).toEqual([build])
    expect(result.summary).toBe('Set no metrics on step "Build" (build)')
  })

  it('never requires a metric: a step with no data other than its title is valid', () => {
    const result = run(projectWith([node('note', 'Note')]), 'set_step_metrics', { stepId: 'note' })
    expect(result.ok).toBe(true)
  })
})

describe('remove_step', () => {
  const line = projectWith(
    [node('idea', 'Idea'), build, node('release', 'Release')],
    [
      { id: 'e1', source: 'idea', target: 'build' },
      { id: 'e2', source: 'build', target: 'release' },
    ],
  )

  it('removes the step and the connections to and from it, counting them', () => {
    const result = run(line, 'remove_step', { stepId: 'build' })
    expect(result.ok).toBe(true)
    expect(result.project.nodes.map(({ id }) => id)).toEqual(['idea', 'release'])
    expect(result.project.edges).toEqual([])
    expect(result.summary).toBe('Removed step "Build" (build) and 2 connections')
    expect(line.nodes).toHaveLength(3)
    expect(line.edges).toHaveLength(2)
  })

  it('keeps connections that do not touch the step', () => {
    const result = run(line, 'remove_step', { stepId: 'release' })
    expect(result.project.edges).toEqual([{ id: 'e1', source: 'idea', target: 'build' }])
    expect(result.summary).toBe('Removed step "Release" (release) and 1 connection')
  })

  it('says 0 connections were removed for an unconnected step', () => {
    const result = run(projectWith([node('note', 'Note')]), 'remove_step', { stepId: 'note' })
    expect(result.project.nodes).toEqual([])
    expect(result.summary).toBe('Removed step "Note" (note) and 0 connections')
  })
})

describe('a command on a missing step', () => {
  const two = projectWith([node('idea', 'Idea'), node('build', 'Build')])

  it.each([
    ['update_step', { stepId: 'ghost', name: 'X' }],
    ['set_step_metrics', { stepId: 'ghost', pt: 1 }],
    ['remove_step', { stepId: 'ghost' }],
  ])('%s says the step does not exist and lists the valid steps', (name, args) => {
    const result = run(two, name, args)
    const found = onlyProblem(result)
    expect(found.code).toBe('STEP_NOT_FOUND')
    expect(found.message).toBe(
      'The step with id "ghost" does not exist. Valid steps: "Idea" (idea), "Build" (build).',
    )
    expect(found.field).toBe('stepId')
    expect(found.untrusted).toEqual({
      id: 'ghost',
      steps: [
        { id: 'idea', title: 'Idea' },
        { id: 'build', title: 'Build' },
      ],
    })
    expect(result.project).toBe(two)
  })

  it('says there are no steps to name when the project has none', () => {
    const found = onlyProblem(run(empty, 'remove_step', { stepId: 'ghost' }))
    expect(found.message).toBe('The step with id "ghost" does not exist. Valid steps: none.')
  })

  it.each([undefined, 5, null])('asks for the step id when stepId is %j', (stepId) => {
    const found = onlyProblem(run(two, 'remove_step', { stepId }))
    expect(found.code).toBe('STEP_TARGET_INVALID')
    expect(found.message).toBe(
      'This command needs the id of a step (stepId). Valid steps: "Idea" (idea), "Build" (build).',
    )
    expect(found.untrusted).toEqual({
      steps: [
        { id: 'idea', title: 'Idea' },
        { id: 'build', title: 'Build' },
      ],
    })
  })

  it('cuts a long id and long titles in the message but keeps them whole in untrusted', () => {
    const id = 'g'.repeat(200)
    const title = 't'.repeat(200)
    const found = onlyProblem(run(projectWith([node('s', title)]), 'remove_step', { stepId: id }))
    expect(found.message).not.toContain('g'.repeat(81))
    expect(found.message).not.toContain('t'.repeat(81))
    expect(found.message).toContain(`${'g'.repeat(79)}…`)
    expect(found.untrusted).toEqual({ id, steps: [{ id: 's', title }] })
  })

  it('keeps the requested id out of code, fix and field', () => {
    const found = onlyProblem(run(two, 'remove_step', { stepId: 'x<script>' }))
    expect(`${found.code} ${found.fix} ${found.field}`).not.toContain('script')
  })
})
