// Runs before every Vitest test: captures console.error, console.warn and console.info, resets the
// diagnostics sink, and fails the test when it wrote anything the gate does not allow, or when it
// replaced a gate spy and so hid console output from the gate. The decisions about console text
// live in src/flow/diagnostics/gate.js; this file only wires them to the test lifecycle.

import { afterEach, beforeEach, vi } from 'vitest'
import { resetDiagnostics } from './src/shell/diagnostics.js'
import { captureConsole, finishCapture, startCapture } from './src/testHelpers.js'

const CAPTURED_LEVELS = ['error', 'warn', 'info']

let gateSpies = []

const installGateSpy = (level) => {
  const capture = (...args) => captureConsole(level, args)
  const spy = vi.spyOn(console, level).mockImplementation(capture)
  return { level, spy, capture }
}

// A restored console is fine (the real one is back); a mock that is not the gate's own is not.
const isReplaced = ({ level, spy, capture }) => {
  const current = globalThis.console[level]
  return vi.isMockFunction(current) && (current !== spy || spy.getMockImplementation() !== capture)
}

beforeEach(() => {
  startCapture()
  resetDiagnostics()
  gateSpies = CAPTURED_LEVELS.map(installGateSpy)
})

afterEach(() => {
  const replaced = gateSpies
    .filter(isReplaced)
    .map(({ level }) => `console.${level} spy replaced: use expectDiagnostics or inject a console`)
  gateSpies.forEach(({ spy }) => spy.mockRestore())
  const failures = [...finishCapture(), ...replaced]
  if (failures.length > 0) throw new Error(failures.join('\n'))
})
