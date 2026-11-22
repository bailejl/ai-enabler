import { problem } from '../diagnostics/problem.js'
import { STEP_DATA_FIELDS, stepDisplayName } from '../step.js'

// The step data a flow still needs before its numbers can be read: every data field except the
// title and the batch size. They stay optional for files and commands; the gate only reports them.
export const GATE_STEP_FIELDS = STEP_DATA_FIELDS.filter(
  (field) => field !== 'label' && field !== 'batch',
)

// 0 is data. Only a field with no value at all is still to fill in.
const isMissing = (value) => value === undefined || value === null

const stepProblems = (node, index) => {
  const missing = GATE_STEP_FIELDS.filter((field) => isMissing(node.data[field]))
  if (missing.length === 0) return []
  return [
    problem('GATE_STEP_DATA_MISSING', {
      params: { step: stepDisplayName(node, index), fields: missing.join(', ') },
      stepId: node.id,
      untrusted: { title: node.data.label },
    }),
  ]
}

/**
 * The data-complete gate: one problem per step missing any of GATE_STEP_FIELDS, or one problem
 * for a project with no steps.
 * @param {{ nodes: object[] }} project the in-memory project the commands work on
 * @returns {object[]} problems
 */
export const dataComplete = (project) =>
  project.nodes.length === 0 ? [problem('GATE_PROJECT_EMPTY')] : project.nodes.flatMap(stepProblems)
