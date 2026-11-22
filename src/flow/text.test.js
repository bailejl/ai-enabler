import { describe, expect, it } from 'vitest'
import { formatCount, hasText, MAX_ECHOED_TEXT, nameLabel, quoted, shorten } from './text.js'

describe('shorten', () => {
  it('keeps text of exactly the limit whole', () => {
    const text = 'x'.repeat(MAX_ECHOED_TEXT)
    expect(shorten(text)).toBe(text)
  })

  it('cuts longer text to the limit, ending with an ellipsis', () => {
    const result = shorten('x'.repeat(MAX_ECHOED_TEXT + 1))
    expect(result).toBe(`${'x'.repeat(MAX_ECHOED_TEXT - 1)}…`)
    expect(result).toHaveLength(MAX_ECHOED_TEXT)
  })

  it('turns a value that is not text into text', () => {
    expect(shorten(7)).toBe('7')
    expect(shorten(undefined)).toBe('undefined')
  })

  it.each([
    ['an object whose toString is not a function', { toString: 1 }],
    ['an object with no prototype', Object.create(null)],
    ['an array holding such an object', [{ toString: 1 }]],
  ])('does not throw for %s', (_label, value) => {
    expect(shorten(value)).toMatch(/^\[object \w+\]$/)
  })
})

describe('hasText', () => {
  it.each(['a', ' a '])('is true for the text %j', (value) => {
    expect(hasText(value)).toBe(true)
  })

  it.each(['', '   ', '\t\n', undefined, null, 7, {}])('is false for %j', (value) => {
    expect(hasText(value)).toBe(false)
  })
})

describe('nameLabel', () => {
  it('returns text as it is', () => {
    expect(nameLabel('add_step')).toBe('add_step')
  })

  it('cuts text to the echo limit', () => {
    expect(nameLabel('x'.repeat(MAX_ECHOED_TEXT + 1))).toBe(
      shorten('x'.repeat(MAX_ECHOED_TEXT + 1)),
    )
  })

  it.each(['', '   ', undefined, null, 7, {}])('calls %j "(no name)"', (value) => {
    expect(nameLabel(value)).toBe('(no name)')
  })
})

describe('quoted', () => {
  it('wraps the shortened text in double quotes', () => {
    expect(quoted('Build')).toBe('"Build"')
    expect(quoted('x'.repeat(200))).toBe(`"${'x'.repeat(MAX_ECHOED_TEXT - 1)}…"`)
  })
})

describe('formatCount', () => {
  it.each([
    [0, '0 steps'],
    [1, '1 step'],
    [2, '2 steps'],
  ])('counts %d as "%s"', (count, expected) => {
    expect(formatCount(count, 'step')).toBe(expected)
  })
})
