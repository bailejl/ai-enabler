/* eslint-disable no-console -- the fixture writes to the console on purpose */
// Self-test fixture, run by gate.test.js through vitest.selftest.config.js. Never part of the suite.
// Each test replaces a console spy the gate installed; the gate must fail it.
import { describe, expect, it, vi } from 'vitest'

describe('replacing the gate console spies', () => {
  it('fails when console.error gets its own implementation', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    console.error('hidden from the gate')
  })

  it('fails when console.warn gets its own implementation', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('fails when console.info is restored and spied again', () => {
    vi.restoreAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('passes when the test only reads the gate spy', () => {
    expect(vi.mocked(console.error).mock.calls).toEqual([])
  })
})
