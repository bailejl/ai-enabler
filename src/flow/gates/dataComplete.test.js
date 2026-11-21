import { describe, expect, it } from 'vitest'
import { dataComplete, GATE_STEP_FIELDS } from './dataComplete.js'

const step = (id, label, data = {}) => ({
  id,
  type: 'step',
  position: { x: 0, y: 0 },
  data: { label, ...data },
})

const FULL = { pt: 1, lt: 2, ca: 3, queue: 4 }

const projectOf = (...nodes) => ({ project: { id: 'p-1', name: 'Checkout' }, nodes, edges: [] })

describe('GATE_STEP_FIELDS', () => {
  it('is pt, lt, ca and queue, in that order', () => {
    expect(GATE_STEP_FIELDS).toEqual(['pt', 'lt', 'ca', 'queue'])
  })
})

describe('dataComplete', () => {
  it('reports each incomplete step with only its missing fields', () => {
    const problems = dataComplete(
      projectOf(step('s-1', 'Review'), step('s-2', 'Build', { pt: 1, lt: 2, ca: 3 })),
    )
    expect(problems).toHaveLength(2)
    const [review, build] = problems
    expect(review.code).toBe('GATE_STEP_DATA_MISSING')
    expect(review.stepId).toBe('s-1')
    expect(review.message).toBe('"Review" is missing pt, lt, ca, queue.')
    expect(build.stepId).toBe('s-2')
    expect(build.message).toBe('"Build" is missing queue.')
    expect(build.fix).toContain('set_step_metrics')
    expect(problems.every((found) => !/\{\w+\}/.test(found.message))).toBe(true)
  })

  it('keeps the raw title in untrusted, not in the code, fix or field', () => {
    const title = 'x'.repeat(200)
    const [found] = dataComplete(projectOf(step('s-1', title)))
    expect(found.untrusted).toEqual({ title })
    expect(found.message).toContain('x'.repeat(79))
    expect(found.message).not.toContain('x'.repeat(80))
    expect(found.field).toBeUndefined()
  })

  it('names a step with a blank title by its position', () => {
    const problems = dataComplete(projectOf(step('s-1', 'Plan', FULL), step('s-2', '   ')))
    expect(problems).toHaveLength(1)
    expect(problems[0].message).toBe('Step #2 is missing pt, lt, ca, queue.')
  })

  it('counts zero as present', () => {
    const zero = { pt: 0, lt: 0, ca: 0, queue: 0 }
    expect(dataComplete(projectOf(step('s-1', 'Build', zero)))).toEqual([])
  })

  it('treats a null value as missing', () => {
    const [found] = dataComplete(projectOf(step('s-1', 'Build', { ...FULL, ca: null })))
    expect(found.message).toBe('"Build" is missing ca.')
  })

  it('does not require a batch size', () => {
    expect(dataComplete(projectOf(step('s-1', 'Build', FULL)))).toEqual([])
  })

  it('reports one problem for a project with no steps', () => {
    const problems = dataComplete(projectOf())
    expect(problems).toHaveLength(1)
    expect(problems[0].code).toBe('GATE_PROJECT_EMPTY')
    expect(problems[0].message).toBe('The project has no steps.')
  })
})
