/* eslint-disable no-console -- the fixture writes to the console on purpose */
// Self-test fixture, run by gate.test.js through vitest.selftest.config.js. Never part of the suite.
// The tests run in order: "passes because the rate limit was reset" needs the test before it to
// use up the limit, and "fails on an uncoded error after mocks were restored" needs the test
// before it to restore every mock. gate.test.js checks both earlier tests passed.
import { describe, it, vi } from 'vitest'
import { RATE_LIMIT } from '../rateLimit.js'
import { report } from '../../../shell/diagnostics.js'
import { expectDiagnostics } from '../../../testHelpers.js'

describe('state between tests', () => {
  it('passes after using up the rate limit for the code', () => {
    expectDiagnostics(['FILE_NOT_JSON'])
    Array.from({ length: RATE_LIMIT }).forEach(() => report({ code: 'FILE_NOT_JSON' }))
  })

  it('passes because the rate limit was reset', () => {
    expectDiagnostics(['FILE_NOT_JSON'])
    report({ code: 'FILE_NOT_JSON' })
  })

  it('fails because the declared code was cleared', () => {
    report({ code: 'FILE_NOT_JSON' })
  })

  it('passes while restoring every mock', () => {
    vi.restoreAllMocks()
  })

  it('fails on an uncoded error after mocks were restored', () => {
    console.error('after restore')
  })
})
