import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'
import vitestConfig from '../vitest.config.js'
import { runCommands, runsOnPullRequest } from './ci-workflow.js'

const WORKFLOW = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

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

  test.each(['unit', 'e2e'])('the %s job does not tolerate a failing step', (name) => {
    const block = jobBlock(name)
    expect(block).not.toBe('')
    expect(block).not.toMatch(/continue-on-error:\s*true/)
  })
})

describe('runsOnPullRequest', () => {
  test.each([
    ['an event name', 'pull_request'],
    ['a list of events', ['push', 'pull_request']],
    ['a map of events', { push: { branches: ['main'] }, pull_request: null }],
  ])('is true for %s', (_label, on) => {
    expect(runsOnPullRequest({ on })).toBe(true)
  })

  test.each([
    ['another event name', 'push'],
    ['a list without it', ['push', 'workflow_dispatch']],
    ['a map without it', { push: { branches: ['main'] } }],
    ['pull_request_target', { pull_request_target: null }],
    ['no triggers', undefined],
  ])('is false for %s', (_label, on) => {
    expect(runsOnPullRequest({ on })).toBe(false)
  })
})

describe('runCommands', () => {
  test('lists each step command, trimmed, in job and step order', () => {
    const workflow = {
      jobs: {
        a: { steps: [{ uses: 'x' }, { run: 'npm test\n' }, { run: 'npm run lint' }] },
        b: { steps: [{ run: ' npm run test:e2e ' }] },
      },
    }

    expect(runCommands(workflow)).toEqual(['npm test', 'npm run lint', 'npm run test:e2e'])
  })

  test('is empty for a workflow with no jobs or steps', () => {
    expect(runCommands({})).toEqual([])
    expect(runCommands({ jobs: { a: {} } })).toEqual([])
  })
})

describe('the gates run in CI (AC12)', () => {
  const workflow = parse(WORKFLOW)

  test('the workflow runs on pull_request', () => {
    expect(runsOnPullRequest(workflow)).toBe(true)
  })

  test.each(['npm test', 'npm run test:e2e'])('the workflow runs %s', (command) => {
    expect(runCommands(workflow)).toContain(command)
  })

  test('vitest.config.js runs vitest.setup.js before every test', () => {
    expect(vitestConfig.test.setupFiles).toContain('./vitest.setup.js')
  })

  test('npm test is vitest run and npm run test:e2e is playwright test', () => {
    expect(PACKAGE.scripts.test).toBe('vitest run')
    expect(PACKAGE.scripts['test:e2e']).toBe('playwright test')
  })
})
