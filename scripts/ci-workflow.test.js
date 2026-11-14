import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const WORKFLOW = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

const unitJobSteps = () => {
  const unitJob = WORKFLOW.split(/^ {2}e2e:$/m)[0]
  return [...unitJob.matchAll(/^ {6}- run: (.+)$/gm)].map((match) => match[1].trim())
}

describe('CI workflow', () => {
  test('the unit job runs the schema fixture guard against origin/main', () => {
    expect(unitJobSteps()).toContain('node scripts/schema-fixture-guard-cli.js origin/main')
  })

  test('the unit job runs the fixture guard before the unit tests', () => {
    const steps = unitJobSteps()
    expect(steps.indexOf('node scripts/schema-fixture-guard-cli.js origin/main')).toBeLessThan(
      steps.indexOf('npm test'),
    )
  })
})
