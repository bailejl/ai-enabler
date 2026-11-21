import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'

const workflow = parse(
  readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'),
)
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { deploy, refuse } = workflow.jobs

const DEPLOY_IF =
  "(github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push') || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')"
const REFUSE_IF = "github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'"
const TIP_GATE = "steps.tip.outputs.current == 'true'"

// A tiny evaluator for the subset of GitHub expressions the job conditions use:
// context paths, quoted strings, ==, !=, &&, || and parentheses.
const TOKEN = /\s*(\(|\)|&&|\|\||==|!=|'[^']*'|[A-Za-z_][\w.]*)/y

const tokenize = (source, at = 0) => {
  if (source.slice(at).trim() === '') return []
  TOKEN.lastIndex = at
  const match = TOKEN.exec(source)
  if (!match) throw new Error(`Unsupported expression syntax near: ${source.slice(at)}`)
  return [match[1], ...tokenize(source, TOKEN.lastIndex)]
}

const lookup = (context, path) => path.split('.').reduce((value, key) => value?.[key], context)

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
  const chain = (operator, operand, combine) => (at) => {
    const step = ([value, next]) =>
      tokens[next] === operator
        ? step(((right) => [combine(value, right[0]), right[1]])(operand(next + 1)))
        : [value, next]
    return step(operand(at))
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
    expect(deploy.if).toBe(DEPLOY_IF)
    expect(refuse.if).toBe(REFUSE_IF)
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
  ])('%s', (_, context, deploys, refuses) => {
    expect(evaluate(deploy.if, context)).toBe(deploys)
    expect(evaluate(refuse.if, context)).toBe(refuses)
  })
})

describe('permissions', () => {
  test('the workflow can only read contents by default', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })

  test('only the deploy job can write Pages and mint an id token', () => {
    expect(deploy.permissions).toEqual({ contents: 'read', pages: 'write', 'id-token': 'write' })
    expect(refuse.permissions).toBeUndefined()
  })
})

test('deploys queue and are never cancelled midway', () => {
  expect(workflow.concurrency).toEqual({ group: 'pages', 'cancel-in-progress': false })
})

describe('deploy steps', () => {
  const [tip, ...rest] = deploy.steps
  const stepUsing = (action) => deploy.steps.find((step) => step.uses?.startsWith(action))

  test('the tip check runs first and compares the CI commit with the tip of main', () => {
    expect(tip.id).toBe('tip')
    expect(tip.env.HEAD_SHA).toBe('${{ github.event.workflow_run.head_sha }}')
    expect(tip.env.REPO_URL).toBe('https://github.com/${{ github.repository }}')
    expect(tip.run).toContain('git ls-remote "$REPO_URL" refs/heads/main')
    expect(tip.run).not.toMatch(/\borigin\b/)
    expect(tip.run).toContain('[ "$tip" = "$HEAD_SHA" ]')
    expect(tip.run).toContain('::notice::')
  })

  test('every later step is gated on the tip check', () => {
    expect(rest.length).toBeGreaterThan(0)
    for (const step of rest) expect(step.if).toBe(TIP_GATE)
  })

  test('checkout builds the commit CI tested', () => {
    const checkout = stepUsing('actions/checkout')
    expect(checkout.with.ref).toBe('${{ github.event.workflow_run.head_sha || github.sha }}')
    expect(checkout.with['persist-credentials']).toBe(false)
  })

  test('it builds, uploads dist and deploys to the github-pages environment', () => {
    expect(deploy.steps.map((step) => step.run).filter(Boolean)).toContain('npm run build')
    expect(stepUsing('actions/upload-pages-artifact').with.path).toBe('dist')
    expect(stepUsing('actions/deploy-pages').id).toBe('deployment')
    expect(deploy.environment).toEqual({
      name: 'github-pages',
      url: '${{ steps.deployment.outputs.page_url }}',
    })
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
