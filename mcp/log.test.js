import { describe, expect, it } from 'vitest'
import { escapeControls } from './log.js'

describe('escapeControls', () => {
  it('leaves text with no control characters as it is', () => {
    expect(escapeControls('Added step "Ship" (step-1)')).toBe('Added step "Ship" (step-1)')
  })

  it.each([
    ['a newline', '\n', '\\n'],
    ['a carriage return', '\r', '\\r'],
    ['a tab', '\t', '\\t'],
  ])('writes %s as a short escape', (_label, char, escaped) => {
    expect(escapeControls(`a${char}b`)).toBe(`a${escaped}b`)
  })

  it.each([
    ['NUL', '\u0000', '\\u0000'],
    ['escape', '\u001b', '\\u001b'],
    ['delete', '\u007f', '\\u007f'],
    ['next line', '\u0085', '\\u0085'],
    ['line separator', '\u2028', '\\u2028'],
    ['paragraph separator', '\u2029', '\\u2029'],
  ])('writes %s as a four-digit unicode escape', (_label, char, escaped) => {
    expect(escapeControls(`a${char}b`)).toBe(`a${escaped}b`)
  })

  it('escapes every control character in the text', () => {
    expect(escapeControls('\n\n\u0000')).toBe('\\n\\n\\u0000')
  })
})
