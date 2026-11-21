import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { parse } from 'yaml'
import { evaluate, evaluateTemplate } from './gha-expression.js'

const workflow = parse(
  readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'),
)
const ci = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'))
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { check, build, deploy, refuse } = workflow.jobs

const CHECK_IF =
  "(github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push') || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')"
const REFUSE_IF = "github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'"
const BUILD_IF = "needs.check.outputs.current == 'true'"

const workflowRun = (conclusion, event) => ({
  github: {
    event_name: 'workflow_run',
    ref: 'refs/heads/main',
    run_id: 101,
    event: { workflow_run: { conclusion, event } },
  },
})
const dispatch = (ref) => ({
  github: { event_name: 'workflow_dispatch', ref, run_id: 202, event: {} },
})

describe('deploy workflow triggers', () => {
  test('it runs after CI completes on main, or by hand', () => {
    expect(workflow.on.workflow_run).toEqual({
      workflows: ['CI'],
      types: ['completed'],
      branches: ['main'],
    })
    expect(workflow.on).toHaveProperty('workflow_dispatch')
  })

  test('the CI workflow it waits for still exists under that name and runs on push to main', () => {
    expect(ci.name).toBe(workflow.on.workflow_run.workflows[0])
    expect(ci.on.push.branches).toContain('main')
  })

  test('a push or a pull request never triggers it directly', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['workflow_dispatch', 'workflow_run'])
  })
})

describe('job conditions', () => {
  test('the conditions are pinned, so any edit updates the table below', () => {
    expect(check.if).toBe(CHECK_IF)
    expect(refuse.if).toBe(REFUSE_IF)
    expect(build.if).toBe(BUILD_IF)
  })

  test.each([
    ['green CI on a push to main', workflowRun('success', 'push'), true, false],
    ['failed CI on main', workflowRun('failure', 'push'), false, false],
    ['cancelled CI on main', workflowRun('cancelled', 'push'), false, false],
    ['timed-out CI on main', workflowRun('timed_out', 'push'), false, false],
    [
      'green CI on a pull request from a branch named main',
      workflowRun('success', 'pull_request'),
      false,
      false,
    ],
    ['a manual run on main', dispatch('refs/heads/main'), true, false],
    ['a manual run on another branch', dispatch('refs/heads/feat/x'), false, true],
  ])('%s', (_, context, proceeds, refuses) => {
    expect(evaluate(check.if, context)).toBe(proceeds)
    expect(evaluate(refuse.if, context)).toBe(refuses)
  })

  test.each([
    ['true', true],
    ['false', false],
  ])('the build runs only when the tip check reports %s', (current, builds) => {
    expect(evaluate(build.if, { needs: { check: { outputs: { current } } } })).toBe(builds)
  })

  test('build waits for the check, and deploy waits for the build', () => {
    expect(build.needs).toBe('check')
    expect(deploy.needs).toBe('build')
    // No condition on deploy, so a skipped build always skips it.
    expect(deploy.if).toBeUndefined()
  })
})

describe('permissions', () => {
  test('the workflow can only read contents by default', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })

  test('only the deploy job can write Pages and mint an id token', () => {
    expect(deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' })
    for (const job of [check, build, refuse]) expect(job.permissions).toBeUndefined()
  })

  test('the privileged job runs no project code', () => {
    expect(deploy.steps).toEqual([{ id: 'deployment', uses: 'actions/deploy-pages@v5' }])
  })
})

describe('concurrency', () => {
  const group = (context) => evaluateTemplate(workflow.concurrency.group, context)

  test('deploys queue and are never cancelled midway', () => {
    expect(workflow.concurrency['cancel-in-progress']).toBe(false)
  })

  test.each([
    ['green CI on a push to main', workflowRun('success', 'push')],
    ['a manual run on main', dispatch('refs/heads/main')],
  ])('%s joins the pages queue', (_, context) => {
    expect(group(context)).toBe('pages')
  })

  test('a manual run off main gets its own group, so it cannot displace a pending deploy', () => {
    expect(group(dispatch('refs/heads/feat/x'))).toBe(202)
  })
})

describe('tip check', () => {
  const [tip] = check.steps

  test('it compares the CI commit with the tip of main and reports the result', () => {
    expect(check.outputs.current).toBe('${{ steps.tip.outputs.current }}')
    expect(tip.id).toBe('tip')
    expect(tip.env.HEAD_SHA).toBe('${{ github.event.workflow_run.head_sha }}')
    expect(tip.env.REPO_URL).toBe('https://github.com/${{ github.repository }}')
    expect(tip.run).toContain('git ls-remote "$REPO_URL" refs/heads/main')
    expect(tip.run).not.toMatch(/\borigin\b/)
    expect(tip.run).toContain('[ "$tip" = "$HEAD_SHA" ]')
    expect(tip.run).toContain('::notice::')
  })

  test('it never runs project code', () => {
    expect(check.steps).toHaveLength(1)
  })

  test('it passes the event name to the script', () => {
    expect(tip.env.EVENT).toBe('${{ github.event_name }}')
  })

  // Runs the step's script the way Actions does, with a stub `git` that reports the tip.
  describe('when run', () => {
    const CI_SHA = 'a'.repeat(40)
    const NEWER_SHA = 'b'.repeat(40)
    const dir = mkdtempSync(path.join(tmpdir(), 'deploy-tip-'))
    const stubGit = path.join(dir, 'git')
    writeFileSync(
      stubGit,
      '#!/bin/sh\n[ -n "$STUB_TIP" ] && printf "%s\\trefs/heads/main\\n" "$STUB_TIP"\nexit 0\n',
    )
    chmodSync(stubGit, 0o755)
    afterAll(() => rmSync(dir, { recursive: true, force: true }))

    const runTip = ({ event, stubTip }) => {
      const output = path.join(dir, `output-${event}-${stubTip || 'none'}`)
      writeFileSync(output, '')
      const result = spawnSync(
        'bash',
        ['--noprofile', '--norc', '-eo', 'pipefail', '-c', tip.run],
        {
          encoding: 'utf8',
          env: {
            PATH: `${dir}:${process.env.PATH}`,
            GITHUB_OUTPUT: output,
            EVENT: event,
            HEAD_SHA: event === 'workflow_run' ? CI_SHA : '',
            REPO_URL: 'https://github.com/owner/repo',
            STUB_TIP: stubTip ?? '',
          },
        },
      )
      return { status: result.status, stdout: result.stdout, output: readFileSync(output, 'utf8') }
    }

    test('the CI commit that is still the tip deploys', () => {
      expect(runTip({ event: 'workflow_run', stubTip: CI_SHA })).toEqual({
        status: 0,
        stdout: '',
        output: 'current=true\n',
      })
    })

    test('an older CI commit is skipped with a notice', () => {
      const result = runTip({ event: 'workflow_run', stubTip: NEWER_SHA })
      expect(result.status).toBe(0)
      expect(result.output).toBe('current=false\n')
      expect(result.stdout).toContain(`::notice::Skipping ${CI_SHA}: main is now at ${NEWER_SHA}`)
    })

    test('an unreadable tip fails the job instead of deploying', () => {
      const result = runTip({ event: 'workflow_run', stubTip: '' })
      expect(result.status).not.toBe(0)
      expect(result.output).toBe('')
    })

    test('a manual run skips the comparison and deploys', () => {
      expect(runTip({ event: 'workflow_dispatch' })).toEqual({
        status: 0,
        stdout: '',
        output: 'current=true\n',
      })
    })
  })
})

describe('build steps', () => {
  const stepUsing = (action) => build.steps.find((step) => step.uses?.startsWith(action))

  test('checkout builds the commit CI tested', () => {
    const checkout = stepUsing('actions/checkout')
    expect(checkout.with.ref).toBe('${{ github.event.workflow_run.head_sha || github.sha }}')
    expect(checkout.with['persist-credentials']).toBe(false)
  })

  test('it builds and uploads dist', () => {
    expect(build.steps.map((step) => step.run).filter(Boolean)).toEqual(['npm run build'])
    expect(stepUsing('actions/upload-pages-artifact').with.path).toBe('dist')
  })
})

test('deploy publishes to the github-pages environment', () => {
  expect(deploy.environment).toEqual({
    name: 'github-pages',
    url: '${{ steps.deployment.outputs.page_url }}',
  })
})

test('a manual run off main fails with its reason', () => {
  const [step] = refuse.steps
  expect(step.run).toContain('::error::Deploys run from main only')
  expect(step.run).toMatch(/exit 1\s*$/)
})

test('lint:ci validates the deploy workflow', () => {
  expect(packageJson.scripts['lint:ci']).toContain('action-validator .github/workflows/deploy.yml')
})
