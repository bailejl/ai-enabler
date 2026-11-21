import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const workflow = parse(
  readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'),
)
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { check, build, deploy, refuse } = workflow.jobs

const CHECK_IF =
  "(github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push') || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')"
const REFUSE_IF = "github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'"
const BUILD_IF = "needs.check.outputs.current == 'true'"

// A tiny evaluator for the subset of GitHub expressions the job conditions use:
// context paths, quoted strings, ==, !=, &&, || and parentheses.
const TOKEN_SOURCE = String.raw`\s*(\(|\)|&&|\|\||==|!=|'[^']*'|[A-Za-z_][\w.]*)`

const tokenize = (source, at = 0) => {
  if (source.slice(at).trim() === '') return []
  const token = new RegExp(TOKEN_SOURCE, 'y')
  token.lastIndex = at
  const match = token.exec(source)
  if (!match) throw new Error(`Unsupported expression syntax near: ${source.slice(at)}`)
  return [match[1], ...tokenize(source, token.lastIndex)]
}

const lookup = (context, path) => path.split('.').reduce((value, key) => value?.[key], context)

// Each parser takes a token index and returns [value, nextIndex].
const evaluate = (source, context) => {
  const tokens = tokenize(source)
  const primary = (at) => {
    const token = tokens[at]
    if (token === '(') {
      const [value, next] = or(at + 1)
      if (tokens[next] !== ')') throw new Error('Missing )')
      return [value, next + 1]
    }
    if (token.startsWith("'")) return [token.slice(1, -1), at + 1]
    return [lookup(context, token), at + 1]
  }
  const comparison = (at) => {
    const [left, next] = primary(at)
    const op = tokens[next]
    if (op !== '==' && op !== '!=') return [left, next]
    const [right, after] = primary(next + 1)
    return [op === '==' ? left === right : left !== right, after]
  }
  // Folds `operand (operator operand)*` left to right.
  const chain = (operator, operand, combine) => {
    const rest = (value, at) => {
      if (tokens[at] !== operator) return [value, at]
      const [right, next] = operand(at + 1)
      return rest(combine(value, right), next)
    }
    return (at) => rest(...operand(at))
  }
  const and = chain('&&', comparison, (a, b) => Boolean(a) && Boolean(b))
  const or = chain('||', and, (a, b) => Boolean(a) || Boolean(b))
  const [value, end] = or(0)
  if (end !== tokens.length) throw new Error(`Unparsed tokens: ${tokens.slice(end).join(' ')}`)
  return Boolean(value)
}

const workflowRun = (conclusion, event) => ({
  github: {
    event_name: 'workflow_run',
    ref: 'refs/heads/main',
    event: { workflow_run: { conclusion, event, head_branch: 'main' } },
  },
})
const dispatch = (ref) => ({ github: { event_name: 'workflow_dispatch', ref, event: {} } })

describe('deploy workflow triggers', () => {
  test('it runs after CI completes on main, or by hand', () => {
    expect(workflow.on.workflow_run).toEqual({
      workflows: ['CI'],
      types: ['completed'],
      branches: ['main'],
    })
    expect(workflow.on).toHaveProperty('workflow_dispatch')
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

test('deploys queue and are never cancelled midway', () => {
  expect(workflow.concurrency).toEqual({ group: 'pages', 'cancel-in-progress': false })
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

  test('it passes the event and commit to the script', () => {
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
