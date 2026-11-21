import { findEdgeProblems, PROBLEM_DUPLICATE, PROBLEM_LOOP, PROBLEM_SELF } from '../connections.js'
import { problem } from '../diagnostics/problem.js'
import { STEP_TYPE, stepPositionName } from '../step.js'
import { isObject } from './primitives.js'

const isNonEmptyString = (value) => typeof value === 'string' && value !== ''

const isNonEmptyText = (value) => isNonEmptyString(value) && value.trim() !== ''

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0

const isPercentage = (value) => Number.isFinite(value) && value >= 0 && value <= 100

const hasPosition = (node) =>
  Number.isFinite(node?.position?.x) && Number.isFinite(node?.position?.y)

// User text echoed into a message is cut to this many characters, so a huge label or id cannot
// flood the import status. The full text stays in `untrusted`.
const MAX_ECHOED_TEXT = 80

const shorten = (text) =>
  text.length > MAX_ECHOED_TEXT ? `${text.slice(0, MAX_ECHOED_TEXT - 1)}…` : text

// Steps are named by label and 1-based position. A missing or blank label leaves the position.
const stepName = (node, index) => {
  const label = node?.data?.label
  return isNonEmptyText(label)
    ? `Step "${shorten(label)}" (#${index + 1})`
    : stepPositionName(index)
}

// Shape guards: the first one that fails is the only problem reported.
const SHAPE_GUARDS = [
  { code: 'FILE_NOT_A_PROJECT', fails: (file) => !isObject(file) },
  { code: 'FILE_NOT_A_PROJECT', fails: (file) => !Array.isArray(file.nodes) },
  { code: 'FILE_NOT_A_PROJECT', fails: (file) => !Array.isArray(file.edges) },
]

// Per-item rules: every rule that fails is reported. `fails` takes the untrusted item and never
// throws. `field` is the key the message names.
const PROJECT_RULES = [
  {
    code: 'FILE_PROJECT_NAME_EMPTY',
    field: 'project.name',
    fails: (p) => !isNonEmptyText(p?.name),
  },
  { code: 'FILE_PROJECT_ID_MISSING', field: 'project.id', fails: (p) => !isNonEmptyString(p?.id) },
]

// Optional data fields are valid when absent; a present null or wrong type is invalid.
const optionalFieldRule = (code, field, fieldLabel, isValid) => ({
  code,
  field,
  fieldLabel,
  fails: (node) => {
    const value = node?.data?.[field]
    return value !== undefined && !isValid(value)
  },
})

const STEP_RULES = [
  { code: 'STEP_ID_MISSING', field: 'id', fails: (node) => typeof node?.id !== 'string' },
  { code: 'STEP_POSITION_MISSING', field: 'position', fails: (node) => !hasPosition(node) },
  {
    code: 'STEP_LABEL_MISSING',
    field: 'label',
    fails: (node) => typeof node?.data?.label !== 'string',
  },
  {
    code: 'STEP_TYPE_UNKNOWN',
    field: 'type',
    fails: (node) => node?.type !== undefined && node.type !== STEP_TYPE,
  },
  optionalFieldRule('STEP_COUNT_INVALID', 'pt', 'process time', isNonNegativeInteger),
  optionalFieldRule('STEP_COUNT_INVALID', 'lt', 'lead time', isNonNegativeInteger),
  optionalFieldRule('STEP_COUNT_INVALID', 'queue', 'queue', isNonNegativeInteger),
  optionalFieldRule('STEP_COUNT_INVALID', 'batch', 'batch size', isNonNegativeInteger),
  optionalFieldRule('STEP_PERCENT_INVALID', 'ca', '%C&A', isPercentage),
]

const connectionName = (index) => `Connection ${index + 1}`

const CONNECTION_RULES = [
  { code: 'CONN_ID_MISSING', field: 'id', fails: (edge) => !isNonEmptyString(edge?.id) },
]

const failedRules = (rules, subject) => rules.filter((rule) => rule.fails(subject))

const checkShape = (file) => {
  const guard = SHAPE_GUARDS.find((candidate) => candidate.fails(file))
  return guard ? [problem(guard.code)] : []
}

const checkProject = (project) =>
  failedRules(PROJECT_RULES, project).map((rule) => problem(rule.code, { field: rule.field }))

// What a step problem carries about the step: its id when it has one, its title as user text.
const stepRefs = (node) => ({
  ...(typeof node?.id === 'string' && { stepId: node.id }),
  ...(isNonEmptyText(node?.data?.label) && { untrusted: { title: node.data.label } }),
})

const connectionRefs = (edge) => (isNonEmptyString(edge?.id) ? { edgeId: edge.id } : {})

const stepProblem = (rule, node, index) =>
  problem(rule.code, {
    params: { step: stepName(node, index), fieldLabel: rule.fieldLabel, field: rule.field },
    field: rule.field,
    ...stepRefs(node),
  })

const connectionProblem = (rule, edge, index) =>
  problem(rule.code, {
    params: { connection: connectionName(index) },
    field: rule.field,
    ...connectionRefs(edge),
  })

// Phase 1: every per-item rule on every item. An entry keeps the item's place in the file and its
// problems; an item with none passed.
const checkItems = (items, rules, toProblem) =>
  items.map((item, index) => ({
    item,
    index,
    problems: failedRules(rules, item).map((rule) => toProblem(rule, item, index)),
  }))

const passedEntries = (entries) => entries.filter((entry) => entry.problems.length === 0)

const entryProblems = (entries) => entries.flatMap((entry) => entry.problems)

// Entries whose id an earlier entry already used. Entries here passed phase 1, so ids are strings.
const repeatedIdEntries = (entries) => {
  const seen = new Set()
  return entries.filter(({ item }) => {
    const isRepeat = seen.has(item.id)
    seen.add(item.id)
    return isRepeat
  })
}

const duplicateStepIds = (steps) =>
  repeatedIdEntries(steps).map(({ item, index }) =>
    problem('STEP_ID_DUPLICATE', {
      params: { step: stepName(item, index), id: shorten(item.id) },
      field: 'id',
      ...stepRefs(item),
    }),
  )

const duplicateConnectionIds = (connections) =>
  repeatedIdEntries(connections).map(({ item, index }) =>
    problem('CONN_ID_DUPLICATE', {
      params: { connection: connectionName(index), id: shorten(item.id) },
      field: 'id',
      ...connectionRefs(item),
    }),
  )

const CONNECTION_KIND_CODES = {
  [PROBLEM_SELF]: 'CONN_SELF',
  [PROBLEM_DUPLICATE]: 'CONN_DUPLICATE',
  [PROBLEM_LOOP]: 'CONN_LOOP',
}

const connectionKindProblem = ({ kind, edge: { entry } }, nodes, firstIndexById) => {
  const sourceIndex = firstIndexById.get(entry.item.source)
  return problem(CONNECTION_KIND_CODES[kind], {
    params: {
      connection: connectionName(entry.index),
      step: stepName(nodes[sourceIndex], sourceIndex),
    },
    ...connectionRefs(entry.item),
    ...(kind === PROBLEM_SELF && stepRefs(nodes[sourceIndex])),
  })
}

// Relational rules over connections that passed phase 1. Endpoints are checked against every step
// id in the file, so a step with some other problem is still a step a connection can point to.
const checkConnectionRelations = (nodes, connections) => {
  // Built in reverse so the first step with an id wins, as a forward search would find it.
  const firstIndexById = new Map(
    nodes
      .map((node, index) => [node?.id, index])
      .filter(([id]) => typeof id === 'string')
      .toReversed(),
  )
  const hasBothEndpoints = ({ item }) =>
    firstIndexById.has(item.source) && firstIndexById.has(item.target)
  const dangling = connections.filter((entry) => !hasBothEndpoints(entry))
  const connected = connections.filter(hasBothEndpoints)
  return [
    ...dangling.map(({ item, index }) =>
      problem('CONN_ENDPOINT_MISSING', {
        params: { connection: connectionName(index) },
        ...connectionRefs(item),
      }),
    ),
    // Each edge carries its entry so a rejected edge maps back to its place in the file.
    ...findEdgeProblems(
      connected.map((entry) => ({ source: entry.item.source, target: entry.item.target, entry })),
    ).map((found) => connectionKindProblem(found, nodes, firstIndexById)),
  ]
}

/**
 * Validates an untrusted project file and reports every problem found, not only the first.
 * A shape problem stops at itself. Otherwise phase 1 reports every per-item problem, and phase 2
 * reports relational problems among the items that passed phase 1.
 * One deliberate exception: a connection endpoint counts as existing when any step in the file has
 * that string id, even a step that failed phase 1. A bad step then does not also make every
 * connection to it a missing-endpoint problem.
 * Never throws on any input.
 * @returns {{ ok: boolean, problems: object[] }}
 */
export const validateProjectFile = (file) => {
  const shape = checkShape(file)
  if (shape.length > 0) return { ok: false, problems: shape }
  const steps = checkItems(file.nodes, STEP_RULES, stepProblem)
  const connections = checkItems(file.edges, CONNECTION_RULES, connectionProblem)
  const problems = [
    ...checkProject(file.project),
    ...entryProblems(steps),
    ...entryProblems(connections),
    ...duplicateStepIds(passedEntries(steps)),
    ...duplicateConnectionIds(passedEntries(connections)),
    ...checkConnectionRelations(file.nodes, passedEntries(connections)),
  ]
  return { ok: problems.length === 0, problems }
}
