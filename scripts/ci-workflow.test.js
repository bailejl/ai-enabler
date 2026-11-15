import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const WORKFLOW = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

const GUARD_STEP = 'node scripts/schema-fixture-guard-cli.js origin/main'
const UNIT_TEST_STEP = 'npm test'
const E2E_TEST_STEP = 'npm run test:e2e'

// Reads one job's block, from its two-space key to the next top-level job key.
const jobBlock = (name) => {
  const lines = WORKFLOW.split('\n')
  const start = lines.indexOf(`  ${name}:`)
  if (start === -1) return ''
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^ {2}\S/.test(line))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n')
}

const runSteps = (name) =>
  [...jobBlock(name).matchAll(/^\s+(?:- )?run: (.+)$/gm)].map((match) => match[1].trim())

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

  test('the e2e job runs the Playwright suite', () => {
    expect(runSteps('e2e')).toContain(E2E_TEST_STEP)
  })

  test('neither job tolerates a failing step', () => {
    expect(jobBlock('unit')).not.toMatch(/continue-on-error:\s*true/)
    expect(jobBlock('e2e')).not.toMatch(/continue-on-error:\s*true/)
  })
})
