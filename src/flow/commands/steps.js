import { problem } from '../diagnostics/problem.js'
import { START_POSITION } from '../layout.js'
import { findStep, STEP_DATA_FIELDS, STEP_TYPE, stepDisplayName } from '../step.js'
import { formatCount, hasText, quoted, shorten } from '../text.js'
import { stepRef, validStepsList, validStepsText } from './stepNames.js'

// A new step starts at the origin. MCP commands never accept positions; an MCP save lays out the
// steps still there.

// Every data field except the title: the ones set_step_metrics accepts and add_step takes along.
const METRIC_FIELDS = STEP_DATA_FIELDS.filter((field) => field !== 'label')

// `subject` is the text that opens the message. `refs` are the problem's stepId and untrusted title.
const nameProblems = (name, subject, refs = {}) =>
  hasText(name)
    ? []
    : [problem('STEP_NAME_EMPTY', { params: { step: subject }, field: 'name', ...refs })]

// The problem for a step id that names no step. It lists the valid steps by id and title, in the
// message (shortened, capped) and whole in `untrusted`.
const missingStepProblem = (nodes, stepId) => {
  const steps = validStepsList(nodes)
  const isText = typeof stepId === 'string'
  return problem(isText ? 'STEP_NOT_FOUND' : 'STEP_TARGET_INVALID', {
    params: { steps: validStepsText(nodes), ...(isText && { id: shorten(stepId) }) },
    field: 'stepId',
    untrusted: isText ? { id: stepId, steps } : { steps },
  })
}

// Finds the step a command names: `{ step, index }`, or `{ problems }` in the shape `apply` returns.
const findStepOrProblems = (project, stepId) =>
  findStep(project.nodes, stepId) ?? { problems: [missingStepProblem(project.nodes, stepId)] }

const changeStep = (project, step, data) => ({
  ...project,
  nodes: project.nodes.map((node) =>
    node === step ? { ...node, data: { ...node.data, ...data } } : node,
  ),
})

// A blank name still gets a candidate, so the metrics are checked in the same pass. Its title is
// emptied so the validator does not report the same name a second time.
const addStep = (project, { name, ...metrics }, { newId }) => {
  const id = newId()
  const label = hasText(name) ? name : ''
  const node = { id, type: STEP_TYPE, position: START_POSITION, data: { label, ...metrics } }
  return {
    project: { ...project, nodes: [...project.nodes, node] },
    problems: nameProblems(name, 'The new step'),
    summary: () => `Added step ${quoted(name)} (${shorten(id)})`,
    created: id,
  }
}

const updateStep = (project, { stepId, name }) => {
  const found = findStepOrProblems(project, stepId)
  const { step, index } = found
  const named = step
    ? nameProblems(name, stepDisplayName(step, index), {
        stepId: step.id,
        untrusted: { title: step.data.label },
      })
    : nameProblems(name, 'The step')
  const problems = [...(found.problems ?? []), ...named]
  if (problems.length > 0) return { problems }
  return {
    project: changeStep(project, step, { label: name }),
    summary: () => `Renamed step ${stepRef(step, index)} to ${quoted(name)}`,
  }
}

// An explicit undefined means "not given": it must not clear a metric or print as "pt=undefined".
const setStepMetrics = (project, { stepId, ...args }) => {
  const found = findStepOrProblems(project, stepId)
  if (found.problems) return found
  const { step, index } = found
  const given = Object.entries(args).filter(([, value]) => value !== undefined)
  return {
    project: changeStep(project, step, Object.fromEntries(given)),
    summary: () =>
      `Set ${given.map(([field, value]) => `${field}=${value}`).join(', ') || 'no metrics'} on step ${stepRef(step, index)}`,
  }
}

const removeStep = (project, { stepId }) => {
  const found = findStepOrProblems(project, stepId)
  if (found.problems) return found
  const { step, index } = found
  const edges = project.edges.filter(
    ({ source, target }) => source !== step.id && target !== step.id,
  )
  const removed = project.edges.length - edges.length
  return {
    project: { ...project, nodes: project.nodes.filter((node) => node !== step), edges },
    summary: () =>
      `Removed step ${stepRef(step, index)}; ${formatCount(removed, 'connection')} ${removed === 1 ? 'was' : 'were'} removed`,
  }
}

// The coordinates are not checked here: the validator rejects a position that is not two finite
// numbers (STEP_POSITION_MISSING), so a bad move never reaches the project.
const moveStep = (project, { stepId, x, y }) => {
  const found = findStepOrProblems(project, stepId)
  if (found.problems) return found
  const { step, index } = found
  return {
    project: {
      ...project,
      nodes: project.nodes.map((node) => (node === step ? { ...node, position: { x, y } } : node)),
    },
    summary: () => `Moved step ${stepRef(step, index)}`,
  }
}

export const STEP_COMMANDS = {
  add_step: { args: ['name', ...METRIC_FIELDS], apply: addStep },
  update_step: { args: ['stepId', 'name'], apply: updateStep },
  set_step_metrics: { args: ['stepId', ...METRIC_FIELDS], apply: setStepMetrics },
  remove_step: { args: ['stepId'], apply: removeStep },
  move_step: { args: ['stepId', 'x', 'y'], uiOnly: true, apply: moveStep },
}
