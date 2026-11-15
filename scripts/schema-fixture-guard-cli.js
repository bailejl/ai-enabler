import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { findFixtureViolations, violationMessage } from './schema-fixture-guard.js'

export const DEFAULT_BASE = 'origin/main'
const SUCCESS = 0
const FAILURE = 1

const runGit = (args) => spawnSync('git', args, { encoding: 'utf8' })

const gitFailureMessage = (base, result) => {
  const detail = result.error?.message ?? result.stderr?.trim() ?? ''
  return `Schema fixture guard could not diff against ${base}: ${detail || `git exited ${result.status}`}`
}

const OPTION_PREFIX = '-'

// core.quotePath=false keeps non-ASCII paths unquoted so they still match the fixture pattern.
const diffArgs = (base) => [
  '-c',
  'core.quotePath=false',
  'diff',
  '--name-status',
  '--no-renames',
  `${base}...HEAD`,
]

// Fails closed: any git failure is a failure, never a silent pass. A base that starts with "-"
// would be read by git as an option, so it is rejected before git runs.
export const runGuard = ({ run = runGit, base = DEFAULT_BASE } = {}) => {
  if (base.startsWith(OPTION_PREFIX)) {
    return {
      exitCode: FAILURE,
      message: `Schema fixture guard: base "${base}" looks like an option, not a ref.`,
    }
  }
  const result = run(diffArgs(base))
  if (result.error || result.status !== SUCCESS) {
    return { exitCode: FAILURE, message: gitFailureMessage(base, result) }
  }
  const violations = findFixtureViolations(result.stdout)
  if (violations.length > 0) return { exitCode: FAILURE, message: violationMessage(violations) }
  return {
    exitCode: SUCCESS,
    message: `Schema fixture guard: no released fixtures changed vs ${base}.`,
  }
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint) {
  const { exitCode, message } = runGuard({ base: process.argv[2] ?? DEFAULT_BASE })
  const stream = exitCode === SUCCESS ? process.stdout : process.stderr
  stream.write(`${message}\n`)
  process.exitCode = exitCode
}
