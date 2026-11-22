import { describe, expect, it } from 'vitest'
import { MAX_LISTED_PROBLEMS, toProblemsView } from './problemsView.js'

const HEADING = 'Import rejected'

const problemOf = (index) => ({
  code: 'TEST_PROBLEM',
  severity: 'error',
  message: `Problem ${index}.`,
  fix: `Fix ${index}.`,
})
const manyProblems = (count) => Array.from({ length: count }, (_, index) => problemOf(index + 1))

describe('toProblemsView', () => {
  it('keeps the heading and gives each problem its message and fix, with no "more" line', () => {
    const view = toProblemsView('Import rejected: 2 problems', manyProblems(2))

    expect(view).toEqual({
      heading: 'Import rejected: 2 problems',
      items: [
        { code: 'TEST_PROBLEM', message: 'Problem 1.', fix: 'Fix 1.' },
        { code: 'TEST_PROBLEM', message: 'Problem 2.', fix: 'Fix 2.' },
      ],
      more: null,
    })
  })

  it('lists exactly 10 problems with no "more" line', () => {
    const view = toProblemsView(HEADING, manyProblems(10))

    expect(MAX_LISTED_PROBLEMS).toBe(10)
    expect(view.items).toHaveLength(10)
    expect(view.more).toBeNull()
  })

  it('lists the first 10 of 11 problems and says "and 1 more"', () => {
    const view = toProblemsView(HEADING, manyProblems(11))

    expect(view.items).toHaveLength(10)
    expect(view.more).toBe('and 1 more')
  })

  it('lists the first 10 of 14 problems in order and says "and 4 more"', () => {
    const view = toProblemsView(HEADING, manyProblems(14))

    expect(view.items.map(({ message }) => message)).toEqual(
      manyProblems(10).map(({ message }) => message),
    )
    expect(view.more).toBe('and 4 more')
  })

  it('keeps the code, step id, connection id and field, and drops untrusted text', () => {
    const detailed = {
      ...problemOf(1),
      stepId: 'build',
      edgeId: 'plan->build',
      field: 'position',
      untrusted: { label: 'attacker words' },
    }

    const [item] = toProblemsView(HEADING, [detailed]).items

    expect(item).toEqual({
      code: 'TEST_PROBLEM',
      message: 'Problem 1.',
      fix: 'Fix 1.',
      stepId: 'build',
      edgeId: 'plan->build',
      field: 'position',
    })
    expect(item).not.toHaveProperty('untrusted')
  })

  it('leaves out detail keys a problem does not have', () => {
    const [item] = toProblemsView(HEADING, [problemOf(1)]).items

    expect(Object.keys(item).sort()).toEqual(['code', 'fix', 'message'])
  })

  it('does not keep severity or other fields on an item', () => {
    const [item] = toProblemsView(HEADING, [{ ...problemOf(1), extra: 'x' }]).items

    expect(item).not.toHaveProperty('severity')
    expect(item).not.toHaveProperty('extra')
  })
})
