import { describe, expect, test } from 'vitest'
import { crashKind } from './devCrash.js'

describe('crashKind', () => {
  test.each(['render', 'error', 'rejection'])('names the kind %s', (kind) => {
    expect(crashKind(kind)).toBe(kind)
  })

  test.each([undefined, null, '', 'Render', 'other', 1, {}, ['render']])(
    'returns null for %j',
    (detail) => {
      expect(crashKind(detail)).toBeNull()
    },
  )
})
