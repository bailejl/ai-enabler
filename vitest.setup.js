// Runs before every Vitest test: captures console.error, console.warn and console.info, resets the
// diagnostics sink, and fails the test when it wrote anything the gate does not allow. The decisions
// live in src/flow/diagnostics/gate.js; this file only wires them to the test lifecycle.

import { afterEach, beforeEach, vi } from 'vitest'
import { resetDiagnostics } from './src/shell/diagnostics.js'
import { captureConsole, finishCapture, startCapture } from './src/testHelpers.js'

const CAPTURED_LEVELS = ['error', 'warn', 'info']

let spies = []

beforeEach(() => {
  startCapture()
  resetDiagnostics()
  spies = CAPTURED_LEVELS.map((level) =>
    vi.spyOn(console, level).mockImplementation((...args) => captureConsole(level, args)),
  )
})

afterEach(() => {
  spies.forEach((spy) => spy.mockRestore())
  const failures = finishCapture()
  if (failures.length > 0) throw new Error(failures.join('\n'))
})
