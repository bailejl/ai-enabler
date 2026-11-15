import { findEdgeProblems, PROBLEM_DUPLICATE, PROBLEM_LOOP, PROBLEM_SELF } from '../connections.js'
import { STEP_TYPE, stepPositionName } from '../step.js'
import { isObject } from './primitives.js'

export const NOT_A_PROJECT_FILE =
  'This is not a project file. Choose a file exported from AI Enabler.'

const isNonEmptyString = (value) => typeof value === 'string' && value !== ''

const isNonEmptyText = (value) => isNonEmptyString(value) && value.trim() !== ''

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0

const isPercentage = (value) => Number.isFinite(value) && value >= 0 && value <= 100

// Steps are named by label and 1-based position. A missing or blank label leaves the position.
const stepName = (node, index) => {
  const label = node?.data?.label
  return isNonEmptyText(label) ? `Step "${label}" (#${index + 1})` : stepPositionName(index)
}

// A rule that flags the first step for which isProblem is true. describe gets the step name.
const firstBadStep = (isProblem, describe) => (file) => {
  const index = file.nodes.findIndex(isProblem)
  return index === -1 ? null : describe(stepName(file.nodes[index], index))
}

const hasPosition = (node) =>
  Number.isFinite(node?.position?.x) && Number.isFinite(node?.position?.y)

// Optional data fields are valid when absent; a present null or wrong type is invalid.
const hasBadOptionalField = (field, isValid) => (node) => {
  const value = node?.data?.[field]
  return value !== undefined && !isValid(value)
}

const invalidField = (noun) => (name) => `${name} has an invalid ${noun}.`

// The first id that an earlier item already used, or undefined. Items are untrusted: null is skipped.
const findDuplicateId = (items) => {
  const seen = new Set()
  for (const item of items) {
    if (seen.has(item?.id)) return item.id
    seen.add(item?.id)
  }
  return undefined
}

const connectionName = (index) => `Connection ${index + 1}`

const hasMissingEndpoint = (nodes) => {
  const ids = new Set(nodes.map((node) => node.id))
  return (edge) => !ids.has(edge?.source) || !ids.has(edge?.target)
}

// Describes the first rejected connection. A self-connection names its step.
const EDGE_PROBLEM_MESSAGES = {
  [PROBLEM_SELF]: (edge, nodes) => {
    const index = nodes.findIndex((node) => node.id === edge.source)
    return `${stepName(nodes[index], index)} connects to itself.`
  },
  [PROBLEM_DUPLICATE]: () => 'A connection appears twice.',
  [PROBLEM_LOOP]: () => 'The connections form a loop.',
}

const findEdgeProblemMessage = (file) => {
  const [first] = findEdgeProblems(file.edges)
  return first ? EDGE_PROBLEM_MESSAGES[first.kind](first.edge, file.nodes) : null
}

// Ordered rules. The first one that finds a problem decides the message, so each rule may rely on
// the rules above it. Every rule takes the whole file and returns a message, or null when it passes.
// Inputs are untrusted JSON: rules read with optional chaining and never throw.
const RULES = [
  (file) => (isObject(file) ? null : NOT_A_PROJECT_FILE),
  (file) => (isNonEmptyText(file.project?.name) ? null : 'The project name is empty.'),
  (file) => (Array.isArray(file.nodes) ? null : 'The file has no list of steps.'),
  (file) => (Array.isArray(file.edges) ? null : 'The file has no list of connections.'),
  firstBadStep(
    (node) => typeof node?.id !== 'string',
    (name) => `${name} is missing an id.`,
  ),
  firstBadStep(
    (node) => !hasPosition(node),
    (name) => `${name} is missing a position.`,
  ),
  firstBadStep(
    (node) => typeof node?.data?.label !== 'string',
    (name) => `${name} is missing a label.`,
  ),
  firstBadStep(
    (node) => node?.type !== undefined && node.type !== STEP_TYPE,
    (name) => `${name} has an unknown type.`,
  ),
  firstBadStep(hasBadOptionalField('pt', isNonNegativeInteger), invalidField('process time')),
  firstBadStep(hasBadOptionalField('lt', isNonNegativeInteger), invalidField('lead time')),
  firstBadStep(hasBadOptionalField('queue', isNonNegativeInteger), invalidField('queue')),
  firstBadStep(hasBadOptionalField('batch', isNonNegativeInteger), invalidField('batch size')),
  firstBadStep(hasBadOptionalField('ca', isPercentage), invalidField('%C&A')),
  (file) => {
    const id = findDuplicateId(file.nodes)
    return id === undefined ? null : `Two steps share the id "${id}".`
  },
  (file) => {
    const index = file.edges.findIndex((edge) => !isNonEmptyString(edge?.id))
    return index === -1 ? null : `${connectionName(index)} is missing an id.`
  },
  (file) => {
    const id = findDuplicateId(file.edges)
    return id === undefined ? null : `Two connections share the id "${id}".`
  },
  (file) =>
    file.edges.some(hasMissingEndpoint(file.nodes))
      ? 'A connection points to a step that is not there.'
      : null,
  findEdgeProblemMessage,
  (file) => (isNonEmptyString(file.project.id) ? null : 'The project id is missing.'),
]

export const validateProjectFile = (file) => {
  for (const rule of RULES) {
    const message = rule(file)
    if (message) return { ok: false, message }
  }
  return { ok: true }
}
