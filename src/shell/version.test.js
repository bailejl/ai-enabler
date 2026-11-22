import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { APP_VERSION } from './version.js'

const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version

describe('APP_VERSION', () => {
  test('equals the package.json version', () => {
    expect(APP_VERSION).toBe(PACKAGE_VERSION)
  })

  test('is 0.1.0', () => {
    expect(APP_VERSION).toBe('0.1.0')
  })
})
