// The only place an e2e file gets Playwright's `test`. Every test runs through the diagnostics
// gate: console output and page errors are collected from before the first navigation, and when
// the test ends `checkDiagnostics` fails it on anything the test did not declare with
// `diagnostics.expect`. There is no other way to let a code or console text pass.

import { test as base, expect } from '@playwright/test'
import { checkDiagnostics } from '../src/flow/diagnostics/gate.js'
import { collectConsole, flushConsole } from './console.js'

export { expect }

// Playwright names the `warn` method's messages `warning`; the gate uses the method names.
const CONSOLE_LEVEL = Object.freeze({ warning: 'warn' })
const toLevel = (type) => CONSOLE_LEVEL[type] ?? type

// What a test may do to the gate: declare the codes it expects, and nothing else.
export const createDiagnostics = (capture) => ({
  expect: (codes) => capture.expected.push(...codes),
})

// Playwright's fixture callback is conventionally named `use`; `provide` keeps the React hooks
// lint rule from reading it as a hook.
export const test = base.extend({
  // What this test's page wrote to the console, the errors it raised, and the codes the test
  // declared: `{ messages, pageErrors, expected }`.
  capture: async ({ page }, provide) => {
    await provide({ ...collectConsole(page), expected: [] })
  },

  diagnostics: async ({ capture }, provide) => {
    await provide(createDiagnostics(capture))
  },

  gate: [
    async ({ page, capture }, provide, testInfo) => {
      await provide()
      // A test that already failed reports its own failure; the gate adds nothing to it.
      if (testInfo.errors.length > 0) return
      if (!page.isClosed()) await flushConsole(page)
      const failures = checkDiagnostics({
        entries: capture.messages.map(({ type, text }) => ({ level: toLevel(type), text })),
        pageErrors: capture.pageErrors,
        expected: capture.expected,
      })
      if (failures.length > 0) throw new Error(failures.join('\n'))
    },
    { auto: true },
  ],
})
