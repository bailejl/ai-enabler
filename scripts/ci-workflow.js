// Facts about a parsed GitHub Actions workflow, for the checks that the test gates run in CI.

// `on` is an event name, a list of names, or a map from names to options.
const triggerNames = (on) => {
  if (typeof on === 'string') return [on]
  if (Array.isArray(on)) return on
  return on ? Object.keys(on) : []
}

/** Whether the workflow's `on` includes the `pull_request` event. */
export const runsOnPullRequest = (workflow) => triggerNames(workflow.on).includes('pull_request')

/** The `run` command of every step of every job, trimmed, in job and step order. */
export const runCommands = (workflow) =>
  Object.values(workflow.jobs ?? {}).flatMap((job) =>
    (job.steps ?? []).flatMap((step) => (step.run ? [step.run.trim()] : [])),
  )
