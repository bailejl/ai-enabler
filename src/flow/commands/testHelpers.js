import { expect } from 'vitest'
import { applyCommand } from './index.js'

// Test-only helpers shared by the command tests. Nothing in the app imports this file.

/** The one problem a rejected result carries; its message has no unfilled `{placeholder}`. */
export const onlyProblem = (result) => {
  expect(result.ok).toBe(false)
  expect(result.problems).toHaveLength(1)
  expect(result.problems[0].message).not.toMatch(/\{\w+\}/)
  return result.problems[0]
}

/** A `run(project, name, args)` that applies a command with the given id generator. */
export const makeRun = (newId) => (project, name, args) =>
  applyCommand(project, { name, args }, { newId })
