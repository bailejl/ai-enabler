import { describe, expect, it } from 'vitest'
import { findStep, stepDisplayName } from './step.js'

const node = (id, label) => ({ id, data: { label } })

describe('stepDisplayName', () => {
  it('quotes the title, shortened', () => {
    expect(stepDisplayName(node('a', 'Build'), 0)).toBe('"Build"')
    expect(stepDisplayName(node('a', 'T'.repeat(200)), 0)).toBe(`"${'T'.repeat(79)}…"`)
  })

  it.each(['', '   ', undefined, 7])('names a step with the title %j by its position', (label) => {
    expect(stepDisplayName(node('a', label), 2)).toBe('Step #3')
  })
})

describe('findStep', () => {
  const nodes = [node('idea', 'Idea'), node('build', 'Build')]

  it('returns the step and its place in the list', () => {
    expect(findStep(nodes, 'build')).toEqual({ step: nodes[1], index: 1 })
  })

  it.each(['ghost', undefined, 5, { toString: 1 }])('returns null for the id %j', (id) => {
    expect(findStep(nodes, id)).toBeNull()
  })
})
