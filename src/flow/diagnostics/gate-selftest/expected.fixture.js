// Self-test fixture, run by gate.test.js through vitest.selftest.config.js. Never part of the suite.
import { describe, it } from 'vitest'
import { report } from '../../../shell/diagnostics.js'
import { expectDiagnostics } from '../../../testHelpers.js'

describe('declared codes', () => {
  it('passes when the declared code is written', () => {
    expectDiagnostics(['FILE_NOT_JSON'])
    report({ code: 'FILE_NOT_JSON' })
  })

  it('fails when the declared code is never written', () => {
    expectDiagnostics(['FILE_NOT_JSON'])
  })
})
