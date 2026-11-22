// The only place an e2e file gets Playwright's `test`. Every test runs through the diagnostics
// gate: console output and page errors are collected from before the first navigation, and when
// the test ends `checkDiagnostics` fails it on any record or uncoded error or warning the test did
// not declare with `diagnostics.expect`. There is no other way to let a code or an uncoded error or
// warning pass. Uncoded info and log text is not checked.

import { test as base, expect } from '@playwright/test'
import { checkDiagnostics } from '../src/flow/diagnostics/gate.js'
import { collectConsole, flushConsole } from './console.js'
import { createDiagnostics } from './diagnostics-api.js'

export { expect }

// Playwright's ConsoleMessage.type() reports the `warn` method as `warning`; the gate uses the
// method names.
const CONSOLE_LEVEL = Object.freeze({ warning: 'warn' })
const toLevel = (type) => CONSOLE_LEVEL[type] ?? type

/**
 * The gate's failure lines for what `page` wrote since `ledger` began collecting, given the codes
 * the test declared: `ledger` is `{ messages, pageErrors, expected }`. The auto fixture below
 * throws them at the end of every test; `gate.spec.js` calls this on a spare page to assert the
 * exact lines.
 */
export const gateFailures = async (page, ledger) => {
  try {
    await flushConsole(page)
  } catch (error) {
    // A page that closed mid-flush has nothing more to deliver.
    if (!page.isClosed()) throw error
  }
  return checkDiagnostics({
    entries: ledger.messages.map(({ type, text }) => ({ level: toLevel(type), text })),
    pageErrors: ledger.pageErrors,
    expected: ledger.expected,
  })
}

// Playwright's fixture callback is conventionally named `use`; `provide` keeps the React hooks
// lint rule from reading it as a hook.
export const test = base.extend({
  // What this test's page wrote to the console and the errors it raised, for tests that assert on
  // them: `{ messages, pageErrors }`. The gate keeps its own copy, so changing this one cannot
  // change the verdict.
  capture: async ({ page }, provide) => {
    await provide(collectConsole(page))
  },

  // The gate's own record of the page and the codes the test declared. Specs do not use it.
  diagnosticsLedger: async ({ page }, provide) => {
    await provide({ ...collectConsole(page), expected: [] })
  },

  diagnostics: async ({ diagnosticsLedger }, provide) => {
    await provide(createDiagnostics(diagnosticsLedger.expected))
  },

  gate: [
    async ({ page, diagnosticsLedger }, provide, testInfo) => {
      await provide()
      // A test that already failed reports its own failure; the gate adds nothing to it.
      if (testInfo.errors.length > 0) return
      const failures = await gateFailures(page, diagnosticsLedger)
      if (failures.length > 0) throw new Error(failures.join('\n'))
    },
    { auto: true },
  ],
})
