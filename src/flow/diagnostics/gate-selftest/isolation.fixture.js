// Self-test fixture, run by gate.test.js through vitest.selftest.config.js. Never part of the suite.
// The tests run in order: "passes because the rate limit was reset" needs the test before it to
// use up the limit. gate.test.js checks the earlier test passed.
import { describe, it, vi } from 'vitest'
import { MAX_RECORDS_PER_WINDOW } from '../rateLimit.js'
import { report } from '../../../shell/diagnostics.js'
import { expectDiagnostics } from '../../../testHelpers.js'

describe('state between tests', () => {
  it('passes after using up the rate limit for the code', () => {
    expectDiagnostics(['FILE_NOT_JSON'])
    Array.from({ length: MAX_RECORDS_PER_WINDOW }).forEach(() => report({ code: 'FILE_NOT_JSON' }))
  })

  it('passes because the rate limit was reset', () => {
    expectDiagnostics(['FILE_NOT_JSON'])
    report({ code: 'FILE_NOT_JSON' })
  })

  it('fails because the declared code was cleared', () => {
    report({ code: 'FILE_NOT_JSON' })
  })

  it('fails on an uncoded error after restoring every mock', () => {
    vi.restoreAllMocks()
    console.error('x')
  })
})
