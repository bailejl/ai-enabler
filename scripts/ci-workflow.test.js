import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const WORKFLOW = parse(
  readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
)

const GUARD_STEP = 'node scripts/schema-fixture-guard-cli.js origin/main'
const PLUGIN_CHECK_STEP = 'npm run check:plugin'
const UNIT_TEST_STEP = 'npm test'
const E2E_TEST_STEP = 'npm run test:e2e'

const { jobs } = WORKFLOW

const runSteps = (name) => jobs[name].steps.flatMap((step) => (step.run ? [step.run.trim()] : []))

describe('CI workflow', () => {
  test('the unit job runs the schema fixture guard against origin/main', () => {
    expect(runSteps('unit')).toContain(GUARD_STEP)
  })

  test('the unit job runs the fixture guard before the unit tests', () => {
    const steps = runSteps('unit')
    const guard = steps.indexOf(GUARD_STEP)
    const unitTests = steps.indexOf(UNIT_TEST_STEP)
    expect(guard).toBeGreaterThanOrEqual(0)
    expect(unitTests).toBeGreaterThanOrEqual(0)
    expect(guard).toBeLessThan(unitTests)
  })

  test('the unit job checks the committed plugin bundle is current', () => {
    expect(runSteps('unit')).toContain(PLUGIN_CHECK_STEP)
  })

  test('the e2e job runs the Playwright suite', () => {
    expect(runSteps('e2e')).toContain(E2E_TEST_STEP)
  })

  test.each(['unit', 'e2e'])('the %s job does not tolerate a failing step', (name) => {
    const { steps, ...job } = jobs[name]
    expect(steps.length).toBeGreaterThan(0)
    expect(
      [job, ...steps].filter((entry) => String(entry['continue-on-error']) === 'true'),
    ).toEqual([])
  })
})
