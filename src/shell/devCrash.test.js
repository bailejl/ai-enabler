import { describe, expect, test } from 'vitest'
import { CRASH_KIND, parseCrashKind } from './devCrash.js'

describe('parseCrashKind', () => {
  test.each(Object.values(CRASH_KIND))('names the kind %s', (kind) => {
    expect(parseCrashKind(kind)).toBe(kind)
  })

  test.each([undefined, null, '', 'Render', 'other', 1, {}, ['render']])(
    'returns null for %j',
    (detail) => {
      expect(parseCrashKind(detail)).toBeNull()
    },
  )

  test('lists exactly the render, error and rejection kinds, frozen', () => {
    expect(CRASH_KIND).toEqual({ render: 'render', error: 'error', rejection: 'rejection' })
    expect(Object.isFrozen(CRASH_KIND)).toBe(true)
  })
})
