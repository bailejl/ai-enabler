import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'
import vitestConfig from '../vitest.config.js'
import { runCommands, runsOnPullRequest } from './ci-workflow.js'

const WORKFLOW_TEXT = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const workflow = parse(WORKFLOW_TEXT)

const GUARD_COMMAND = 'node scripts/schema-fixture-guard-cli.js origin/main'
const UNIT_TEST_COMMAND = 'npm test'
const E2E_TEST_COMMAND = 'npm run test:e2e'
const PLUGIN_CHECK_COMMAND = 'npm run check:plugin'

const jobCommands = (jobName) => runCommands({ jobs: { [jobName]: workflow.jobs[jobName] } })

// `continue-on-error` can be a boolean or the string 'true', on the job or on any of its steps.
const toleratesFailure = (job) =>
  [job, ...(job.steps ?? [])].some((part) => String(part['continue-on-error']) === 'true')

describe('CI workflow', () => {
  test('the unit job runs the schema fixture guard against origin/main', () => {
    expect(jobCommands('unit')).toContain(GUARD_COMMAND)
  })

  test('the unit job runs the fixture guard before the unit tests', () => {
    const commands = jobCommands('unit')
    const guard = commands.indexOf(GUARD_COMMAND)
    const unitTests = commands.indexOf(UNIT_TEST_COMMAND)
    expect(guard).toBeGreaterThanOrEqual(0)
    expect(unitTests).toBeGreaterThanOrEqual(0)
    expect(guard).toBeLessThan(unitTests)
  })

  test('the unit job checks the committed plugin bundle is current', () => {
    expect(jobCommands('unit')).toContain(PLUGIN_CHECK_COMMAND)
  })

  test('the e2e job runs the Playwright suite', () => {
    expect(jobCommands('e2e')).toContain(E2E_TEST_COMMAND)
  })

  test.each(['unit', 'e2e'])('the %s job does not tolerate a failing step', (jobName) => {
    expect(workflow.jobs[jobName]).toBeDefined()
    expect(toleratesFailure(workflow.jobs[jobName])).toBe(false)
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
  test('the workflow runs on pull_request', () => {
    expect(runsOnPullRequest(workflow)).toBe(true)
  })

  test.each([UNIT_TEST_COMMAND, E2E_TEST_COMMAND])('the workflow runs %s', (command) => {
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
