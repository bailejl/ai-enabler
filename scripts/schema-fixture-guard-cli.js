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

// Fails closed: any git failure is a failure, never a silent pass.
export const runGuard = ({ run = runGit, base = DEFAULT_BASE } = {}) => {
  const result = run(['diff', '--name-status', '--no-renames', `${base}...HEAD`])
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
