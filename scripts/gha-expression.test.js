import { describe, expect, test } from 'vitest'
import { evaluate, evaluateTemplate, evaluateValue, tokenize } from './gha-expression.js'

const context = { a: { b: 'x' }, yes: 'y', empty: '' }

describe('evaluateValue', () => {
  test.each([
    ["'lit'", 'lit'],
    ['a.b', 'x'],
    ['a.missing.deep', null],
    ["a.b == 'x'", true],
    ["a.b == 'X'", true],
    ["a.b != 'x'", false],
    ["empty || 'fallback'", 'fallback'],
    ["yes || 'fallback'", 'y'],
    ["yes && 'then'", 'then'],
    ["empty && 'then'", ''],
  ])('%s evaluates to %j', (source, value) => {
    expect(evaluateValue(source, context)).toBe(value)
  })

  test('&& binds tighter than ||', () => {
    expect(evaluate('yes || empty && empty', context)).toBe(true)
    expect(evaluate('(yes || empty) && empty', context)).toBe(false)
  })

  test.each([
    ['a.b ==', 'Unexpected end of expression'],
    ['(a.b', 'Missing )'],
    ['a.b a.b', 'Unparsed tokens: a.b'],
    ['a.b > 1', 'Unsupported expression syntax near:  > 1'],
    ['a.b == true', 'Unsupported literal: true'],
  ])('%j is rejected', (source, message) => {
    expect(() => evaluateValue(source, context)).toThrow(message)
  })
})

test('tokenize splits operators, strings and paths', () => {
  expect(tokenize("(a.b=='x')||yes")).toEqual(['(', 'a.b', '==', "'x'", ')', '||', 'yes'])
})

describe('evaluateTemplate', () => {
  test('a ${{ }} field is evaluated', () => {
    expect(evaluateTemplate("${{ empty || 'pages' }}", context)).toBe('pages')
  })

  test('a plain field is returned as written', () => {
    expect(evaluateTemplate('pages', context)).toBe('pages')
  })
})
