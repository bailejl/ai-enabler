import { describe, it, expect } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  RELEASED_SCHEMA_VERSIONS,
  parseSemver,
  compareSemver,
} from './version.js'

describe('parseSemver', () => {
  it.each([
    ['0.0.0', [0, 0, 0]],
    ['1.12.3', [1, 12, 3]],
    ['999999.0.0', [999999, 0, 0]],
    ['9007199254740991.0.0', [Number.MAX_SAFE_INTEGER, 0, 0]],
  ])('parses %j as %j', (value, expected) => {
    expect(parseSemver(value)).toEqual(expected)
  })

  it.each([
    ['a number', 1],
    ['null', null],
    ['undefined', undefined],
    ['an array', [1, 0, 0]],
    ['two parts', '1.0'],
    ['four parts', '1.0.0.0'],
    ['a v prefix', 'v1.0.0'],
    ['a prerelease', '1.0.0-b'],
    ['a leading zero in major', '01.0.0'],
    ['a leading zero in minor', '1.00.0'],
    ['a leading zero in patch', '1.0.00'],
    ['build metadata', '1.0.0+b'],
    ['an empty string', ''],
    ['surrounding whitespace', ' 1.0.0 '],
    ['a trailing newline', '1.0.0\n'],
    ['a negative part', '-1.0.0'],
    ['a part beyond safe integers', '99999999999999999999.0.0'],
    ['a part one past the largest safe integer', '9007199254740992.0.0'],
  ])('rejects %s', (_label, value) => {
    expect(parseSemver(value)).toBeNull()
  })

  it('returns a frozen tuple', () => {
    expect(Object.isFrozen(parseSemver('1.2.3'))).toBe(true)
  })
})

describe('compareSemver', () => {
  it.each([
    ['0.9.0', '0.10.0', -1],
    ['0.10.0', '0.9.0', 1],
    ['1.0.0', '0.99.99', 1],
    ['0.99.99', '1.0.0', -1],
    ['1.2.3', '1.2.4', -1],
    ['1.3.0', '1.2.9', 1],
    ['1.2.3', '1.2.3', 0],
    ['0.0.0', '0.0.0', 0],
  ])('compares %s with %s as %i', (left, right, expected) => {
    expect(compareSemver(left, right)).toBe(expected)
  })

  it.each([
    ['left', 'v1.0.0', '1.0.0'],
    ['right', '1.0.0', '1.0'],
  ])('throws when the %s side is not SemVer', (_side, left, right) => {
    expect(() => compareSemver(left, right)).toThrow(TypeError)
  })
})

describe('schema versions', () => {
  it('starts at 0.0.0', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe('0.0.0')
    expect(RELEASED_SCHEMA_VERSIONS).toEqual(['0.0.0'])
  })

  it('has only valid, unique released versions', () => {
    expect(RELEASED_SCHEMA_VERSIONS.every((version) => parseSemver(version) !== null)).toBe(true)
    expect(new Set(RELEASED_SCHEMA_VERSIONS).size).toBe(RELEASED_SCHEMA_VERSIONS.length)
  })

  it('has a current version that is the maximum released version', () => {
    const maximum = [...RELEASED_SCHEMA_VERSIONS].sort(compareSemver).at(-1)
    expect(CURRENT_SCHEMA_VERSION).toBe(maximum)
  })
})
