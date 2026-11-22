// Runs before every Vitest test: captures console.error, console.warn and console.info, resets the
// diagnostics sink, and fails the test when it wrote anything the gate does not allow, or when it
// left a replacement console method in place and so hid console output from the gate. The
// decisions about console text live in src/flow/diagnostics/gate.js; this file only wires them to
// the test lifecycle.
//
// The capture is installed by plain assignment, not vi.spyOn, so vi.restoreAllMocks() and
// mockRestore() inside a test cannot unhook it. A test's own spy that it restores puts the
// capture back, which is fine; any other replacement left in place fails the test.

import { afterEach, beforeEach, vi } from 'vitest'
import { resetDiagnostics } from './src/shell/diagnostics.js'
import { captureConsole, finishCapture, startCapture } from './src/testHelpers.js'

const CAPTURED_LEVELS = ['error', 'warn', 'info']

let installed = []

const install = (level) => {
  const original = globalThis.console[level]
  const capture = (...args) => captureConsole(level, args)
  globalThis.console[level] = capture
  return { level, original, capture }
}

beforeEach(() => {
  startCapture()
  resetDiagnostics()
  installed = CAPTURED_LEVELS.map(install)
})

afterEach(() => {
  const replaced = installed
    .filter(({ level, capture }) => globalThis.console[level] !== capture)
    .map(({ level }) => `console.${level} spy replaced: use expectDiagnostics or inject a console`)
  // Undo any spy a test left behind (a failing test may never reach its own restore), so it
  // cannot leak into later tests in the file, then put the real console methods back.
  vi.restoreAllMocks()
  installed.forEach(({ level, original }) => {
    globalThis.console[level] = original
  })
  const failures = [...finishCapture(), ...replaced]
  if (failures.length > 0) throw new Error(failures.join('\n'))
})
