import { describe, expect, it } from 'vitest'
import { validateProjectFile } from '../schema/validate.js'
import { MAX_ECHOED_TEXT, shorten } from '../text.js'
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
  it('reports a step with no data with every gate field', () => {
    const [review] = dataComplete(projectOf(step('s-1', 'Review')))
    expect(review.message).toBe('"Review" is missing pt, lt, ca, queue.')
  })

  it('reports only the missing fields of a partly filled step', () => {
    const [build] = dataComplete(projectOf(step('s-2', 'Build', { pt: 1, lt: 2, ca: 3 })))
    expect(build.message).toBe('"Build" is missing queue.')
  })

  it('reports one problem per incomplete step and skips complete ones', () => {
    const problems = dataComplete(
      projectOf(step('s-1', 'Review'), step('s-2', 'Plan', FULL), step('s-3', 'Build')),
    )
    expect(problems.map((found) => found.stepId)).toEqual(['s-1', 's-3'])
  })

  it('gives the step problem its code, step id and fix', () => {
    const [found] = dataComplete(projectOf(step('s-2', 'Build', { pt: 1 })))
    expect(found.code).toBe('GATE_STEP_DATA_MISSING')
    expect(found.stepId).toBe('s-2')
    expect(found.fix).toContain('set_step_metrics')
  })

  it('keeps the raw title in untrusted, not in the code, fix or field', () => {
    const title = 'x'.repeat(200)
    const [found] = dataComplete(projectOf(step('s-1', title)))
    expect(found.untrusted).toEqual({ title })
    expect(found.message).toContain(shorten(title))
    expect(found.message).not.toContain('x'.repeat(MAX_ECHOED_TEXT))
    expect(found.code).toBe('GATE_STEP_DATA_MISSING')
    expect(found.fix).not.toContain('xxx')
    expect(found.field).toBeUndefined()
  })

  it('leaves an incomplete project unchanged and its steps valid input', () => {
    const project = projectOf(step('s-1', 'Review'), step('s-2', 'Build', { pt: 1 }))
    const before = structuredClone(project)
    expect(dataComplete(project)).toHaveLength(2)
    expect(project).toEqual(before)
    expect(validateProjectFile(project).problems).toEqual([])
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
