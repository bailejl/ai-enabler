import { describe, expect, it } from 'vitest'
import { MAX_ECHOED_TEXT, shorten } from './text.js'

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
})
