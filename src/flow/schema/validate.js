import { findEdgeProblems, PROBLEM_DUPLICATE, PROBLEM_LOOP, PROBLEM_SELF } from '../connections.js'
import { problem } from '../diagnostics/problem.js'
import { hasText, STEP_TYPE, stepPositionName } from '../step.js'
import { shorten } from '../text.js'
import { isObject } from './primitives.js'

const isNonEmptyString = (value) => typeof value === 'string' && value !== ''

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0

const isPercentage = (value) => Number.isFinite(value) && value >= 0 && value <= 100

const hasPosition = (node) =>
  Number.isFinite(node?.position?.x) && Number.isFinite(node?.position?.y)

// Steps are named by label and 1-based position. A missing or blank label leaves the position.
const stepName = (node, index) => {
  const label = node?.data?.label
  return hasText(label) ? `Step "${shorten(label)}" (#${index + 1})` : stepPositionName(index)
}

// A file that is not an object with step and connection lists is one problem and nothing else.
const isProjectShaped = (file) =>
  isObject(file) && Array.isArray(file.nodes) && Array.isArray(file.edges)

// Per-item rules: every rule that fails is reported. `fails` takes the untrusted item and never
// throws. `field` is the key the message names.
const PROJECT_RULES = [
  {
    code: 'FILE_PROJECT_NAME_EMPTY',
    field: 'project.name',
    fails: (p) => !hasText(p?.name),
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

// The AI mark is optional. Present, it must be an object with a non-empty tool name and an ISO
// time. A file older than 0.1.0 never reaches this check with a mark: its upgrade drops one.
const ISO_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

// Date rolls an impossible day over (February 30 becomes March 2), so the day is checked by
// building it and reading it back.
const isRealDay = (year, month, day) => {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

const isIsoTime = (value) => {
  const match = typeof value === 'string' ? ISO_TIME_PATTERN.exec(value) : null
  if (!match || Number.isNaN(Date.parse(value))) return false
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  return isRealDay(year, month, day) && hour <= 23 && minute <= 59 && second <= 59
}

// The time is the only user text a mark problem can hold, so it is the only thing `untrusted` keeps,
// whole like any other untrusted value (the message never echoes it).
const MARK_RULES = [
  { code: 'MARK_TOOL_INVALID', field: 'modifiedBy.tool', fails: (m) => !isNonEmptyString(m.tool) },
  {
    code: 'MARK_TIME_INVALID',
    field: 'modifiedBy.at',
    fails: (m) => !isIsoTime(m.at),
    untrusted: (m) => (isNonEmptyString(m.at) ? { time: m.at } : undefined),
  },
]

const connectionName = (index) => `Connection ${index + 1}`

const CONNECTION_RULES = [
  { code: 'CONN_ID_MISSING', field: 'id', fails: (edge) => !isNonEmptyString(edge?.id) },
]

const failedRules = (rules, subject) => rules.filter((rule) => rule.fails(subject))

const checkShape = (file) => (isProjectShaped(file) ? [] : [problem('FILE_NOT_A_PROJECT')])

const checkProject = (project) =>
  failedRules(PROJECT_RULES, project).map((rule) => problem(rule.code, { field: rule.field }))

const markProblem = (rule, mark) => {
  const untrusted = rule.untrusted?.(mark)
  return problem(rule.code, { field: rule.field, ...(untrusted && { untrusted }) })
}

const checkMark = (mark) => {
  if (mark === undefined) return []
  if (!isObject(mark)) return [problem('MARK_NOT_AN_OBJECT', { field: 'modifiedBy' })]
  return failedRules(MARK_RULES, mark).map((rule) => markProblem(rule, mark))
}

// What a step problem carries about the step: its id when it has one, its title as user text.
const stepRefs = (node) => ({
  ...(typeof node?.id === 'string' && { stepId: node.id }),
  ...(hasText(node?.data?.label) && { untrusted: { title: node.data.label } }),
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

// One problem per entry whose id an earlier entry already used. `describe` gives the message
// params and the refs (ids, untrusted text) for the kind of item. The id is echoed into the
// message, so its full text is marked as user text too.
const duplicateIdProblems = (entries, code, describe) =>
  repeatedIdEntries(entries).map(({ item, index }) => {
    const { params, refs } = describe(item, index)
    return problem(code, {
      params: { ...params, id: shorten(item.id) },
      field: 'id',
      ...refs,
      untrusted: { ...refs.untrusted, id: item.id },
    })
  })

const duplicateStepIds = (stepEntries) =>
  duplicateIdProblems(stepEntries, 'STEP_ID_DUPLICATE', (item, index) => ({
    params: { step: stepName(item, index) },
    refs: stepRefs(item),
  }))

const duplicateConnectionIds = (connectionEntries) =>
  duplicateIdProblems(connectionEntries, 'CONN_ID_DUPLICATE', (item, index) => ({
    params: { connection: connectionName(index) },
    refs: connectionRefs(item),
  }))

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
const checkConnectionRelations = (nodes, connectionEntries) => {
  // Built in reverse so the first step with an id wins, as a forward search would find it.
  const firstIndexById = new Map(
    nodes
      .map((node, index) => [node?.id, index])
      .filter(([id]) => typeof id === 'string')
      .toReversed(),
  )
  const hasBothEndpoints = ({ item }) =>
    firstIndexById.has(item.source) && firstIndexById.has(item.target)
  const danglingEntries = connectionEntries.filter((entry) => !hasBothEndpoints(entry))
  const connectedEntries = connectionEntries.filter(hasBothEndpoints)
  return [
    ...danglingEntries.map(({ item, index }) =>
      problem('CONN_ENDPOINT_MISSING', {
        params: { connection: connectionName(index) },
        ...connectionRefs(item),
      }),
    ),
    // Each edge carries its entry so a rejected edge maps back to its place in the file.
    ...findEdgeProblems(
      connectedEntries.map((entry) => ({
        source: entry.item.source,
        target: entry.item.target,
        entry,
      })),
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
  const stepEntries = checkItems(file.nodes, STEP_RULES, stepProblem)
  const connectionEntries = checkItems(file.edges, CONNECTION_RULES, connectionProblem)
  const problems = [
    ...checkProject(file.project),
    ...checkMark(file.modifiedBy),
    ...entryProblems(stepEntries),
    ...entryProblems(connectionEntries),
    ...duplicateStepIds(passedEntries(stepEntries)),
    ...duplicateConnectionIds(passedEntries(connectionEntries)),
    ...checkConnectionRelations(file.nodes, passedEntries(connectionEntries)),
  ]
  return { ok: problems.length === 0, problems }
}
