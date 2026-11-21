import { problem } from '../diagnostics/problem.js'
import { hasText, STEP_DATA_FIELDS, STEP_TYPE } from '../step.js'
import { shorten } from '../text.js'

// A new step starts at the origin. Commands never accept positions; layout places steps on save.
const START_POSITION = Object.freeze({ x: 0, y: 0 })

// Every data field except the title: the ones set_step_metrics accepts and add_step takes along.
const METRIC_FIELDS = STEP_DATA_FIELDS.filter((field) => field !== 'label')

const quoted = (text) => `"${shorten(text)}"`

// A step as its summary names it: title, then id.
const stepRef = (step) => `${quoted(step.data.label)} (${shorten(step.id)})`

const nameProblems = (name, step) =>
  hasText(name) ? [] : [problem('STEP_NAME_EMPTY', { params: { step }, field: 'name' })]

const validStepsText = (nodes) => (nodes.length === 0 ? 'none' : nodes.map(stepRef).join(', '))

// The problem for a step id that names no step. It lists every valid step by id and title, in
// the message (shortened) and whole in `untrusted`.
const missingStepProblem = (nodes, stepId) => {
  const steps = nodes.map(({ id, data }) => ({ id, title: data.label }))
  const isText = typeof stepId === 'string'
  return problem(isText ? 'STEP_NOT_FOUND' : 'STEP_TARGET_INVALID', {
    params: { steps: validStepsText(nodes), ...(isText && { id: shorten(stepId) }) },
    field: 'stepId',
    untrusted: isText ? { id: stepId, steps } : { steps },
  })
}

// Finds the step a command names: `{ step }`, or `{ problems }` in the shape `apply` returns.
const findStep = (project, stepId) => {
  const step = project.nodes.find(({ id }) => id === stepId)
  return step ? { step } : { problems: [missingStepProblem(project.nodes, stepId)] }
}

const changeStep = (project, step, data) => ({
  ...project,
  nodes: project.nodes.map((node) =>
    node === step ? { ...node, data: { ...node.data, ...data } } : node,
  ),
})

const addStep = (project, { name, ...metrics }, { newId }) => {
  const problems = nameProblems(name, 'The new step')
  if (problems.length > 0) return { problems }
  const id = newId()
  const node = { id, type: STEP_TYPE, position: START_POSITION, data: { label: name, ...metrics } }
  return {
    project: { ...project, nodes: [...project.nodes, node] },
    summary: `Added step ${quoted(name)} (${shorten(id)})`,
    created: id,
  }
}

const updateStep = (project, { stepId, name }) => {
  const { step, problems = [] } = findStep(project, stepId)
  const allProblems = [...problems, ...nameProblems(name, step ? stepRef(step) : 'The step')]
  if (allProblems.length > 0) return { problems: allProblems }
  return {
    project: changeStep(project, step, { label: name }),
    summary: `Renamed step ${stepRef(step)} to ${quoted(name)}`,
  }
}

const setStepMetrics = (project, { stepId, ...metrics }) => {
  const found = findStep(project, stepId)
  if (found.problems) return found
  const given = Object.entries(metrics).map(([field, value]) => `${field}=${value}`)
  return {
    project: changeStep(project, found.step, metrics),
    summary: `Set ${given.join(', ') || 'no metrics'} on step ${stepRef(found.step)}`,
  }
}

const countText = (count) => `${count} ${count === 1 ? 'connection' : 'connections'}`

const removeStep = (project, { stepId }) => {
  const found = findStep(project, stepId)
  if (found.problems) return found
  const { step } = found
  const edges = project.edges.filter(
    ({ source, target }) => source !== step.id && target !== step.id,
  )
  return {
    project: { ...project, nodes: project.nodes.filter((node) => node !== step), edges },
    summary: `Removed step ${stepRef(step)} and ${countText(project.edges.length - edges.length)}`,
  }
}

export const STEP_COMMANDS = {
  add_step: { args: ['name', ...METRIC_FIELDS], apply: addStep },
  update_step: { args: ['stepId', 'name'], apply: updateStep },
  set_step_metrics: { args: ['stepId', ...METRIC_FIELDS], apply: setStepMetrics },
  remove_step: { args: ['stepId'], apply: removeStep },
}
