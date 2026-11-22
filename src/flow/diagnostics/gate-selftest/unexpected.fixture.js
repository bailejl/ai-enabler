/* eslint-disable no-console -- the fixture writes to the console on purpose */
// Self-test fixture, run by gate.test.js through vitest.selftest.config.js. Never part of the suite.
import { it } from 'vitest'
import catalog from '../catalog.json' with { type: 'json' }
import { report } from '../../../shell/diagnostics.js'

// The catalog has no hint code yet, so this fixture file adds one for its own run only.
const HINT_CODE = 'SELFTEST_HINT'
catalog[HINT_CODE] = { code: HINT_CODE, severity: 'hint', fix: 'Do the hinted thing.' }

it('fails on an undeclared error record', () => {
  report({ code: 'STEP_ID_MISSING' })
})

it('fails on an undeclared hint record', () => {
  report({ code: HINT_CODE })
})

it('fails on a record whose code is not in the catalog', () => {
  console.error(JSON.stringify({ source: 'aie', code: 'NOT_IN_CATALOG', severity: 'error' }))
})
