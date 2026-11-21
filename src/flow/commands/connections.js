import { problem } from '../diagnostics/problem.js'
import { findStep, stepDisplayName } from '../step.js'
import { quoted, shorten } from '../text.js'
import { validStepsList, validStepsText } from './stepNames.js'

// What a message calls a step id: the step's name, or the id as given when no step has it.
const nameOf = (nodes, id) => {
  const found = findStep(nodes, id)
  return found ? stepDisplayName(found.step, found.index) : quoted(id)
}

// connect only adds the connection. Self, duplicate, loop and missing-endpoint cases are the
// project validator's to reject (validateProjectFile, which uses connectionProblem), so their
// codes and messages come from its results.
const connect = (project, { sourceId, targetId }, { newId }) => {
  const id = newId()
  return {
    project: { ...project, edges: [...project.edges, { id, source: sourceId, target: targetId }] },
    summary: () =>
      `Connected ${nameOf(project.nodes, sourceId)} to ${nameOf(project.nodes, targetId)} (${shorten(id)})`,
    created: id,
  }
}

// An endpoint that is not text names no step, so nothing of it is echoed.
const invalidEndpointProblems = (nodes, endpoints) =>
  endpoints
    .filter(([, id]) => typeof id !== 'string')
    .map(([argument]) =>
      problem('CONN_TARGET_INVALID', {
        params: { argument, steps: validStepsText(nodes) },
        field: argument,
        untrusted: { steps: validStepsList(nodes) },
      }),
    )

// `field` points at the endpoint that names no step; when both exist, at the target.
const notFoundProblem = (nodes, sourceId, targetId) =>
  problem('CONN_NOT_FOUND', {
    params: { source: nameOf(nodes, sourceId), target: nameOf(nodes, targetId) },
    field: findStep(nodes, sourceId) ? 'targetId' : 'sourceId',
    untrusted: { source: sourceId, target: targetId },
  })

const disconnect = (project, { sourceId, targetId }) => {
  const invalid = invalidEndpointProblems(project.nodes, [
    ['sourceId', sourceId],
    ['targetId', targetId],
  ])
  if (invalid.length > 0) return { problems: invalid }
  const edges = project.edges.filter((edge) => edge.source !== sourceId || edge.target !== targetId)
  if (edges.length === project.edges.length) {
    return { problems: [notFoundProblem(project.nodes, sourceId, targetId)] }
  }
  return {
    project: { ...project, edges },
    summary: () =>
      `Disconnected ${nameOf(project.nodes, sourceId)} from ${nameOf(project.nodes, targetId)}`,
  }
}

export const CONNECTION_COMMANDS = {
  connect: { args: ['sourceId', 'targetId'], apply: connect },
  disconnect: { args: ['sourceId', 'targetId'], apply: disconnect },
}
