export const PROBLEM_SELF = 'self'
export const PROBLEM_DUPLICATE = 'duplicate'
export const PROBLEM_LOOP = 'loop'

// Edges indexed as source -> Set of targets, so duplicate and reachability checks never rescan
// the edge list. The maps are local to the closure and only grow through add.
const createEdgeIndex = (edges = []) => {
  const targetsBySource = new Map()

  const add = ({ source, target }) => {
    const targets = targetsBySource.get(source) ?? new Set()
    targets.add(target)
    targetsBySource.set(source, targets)
  }

  const has = ({ source, target }) => targetsBySource.get(source)?.has(target) === true

  // A step always reaches itself. Terminates on cyclic input via the visited set.
  const reaches = (from, to) => {
    const visited = new Set()
    const pending = [from]
    while (pending.length > 0) {
      const current = pending.pop()
      if (current === to) return true
      if (!visited.has(current)) {
        visited.add(current)
        targetsBySource.get(current)?.forEach((next) => pending.push(next))
      }
    }
    return false
  }

  const problemFor = ({ source, target }) => {
    if (source === target) return PROBLEM_SELF
    if (has({ source, target })) return PROBLEM_DUPLICATE
    if (reaches(target, source)) return PROBLEM_LOOP
    return null
  }

  edges.forEach(add)
  return { add, problemFor, reaches }
}

export const reachable = (edges, from, to) => createEdgeIndex(edges).reaches(from, to)

export const connectionProblem = (edges, connection) =>
  createEdgeIndex(edges).problemFor(connection)

export const isValidConnection = (edges) => (connection) =>
  connectionProblem(edges, connection) === null

// Checks each edge against the accepted edges before it, in order.
// Returns [{ kind, edge }] for every rejected edge.
export const findEdgeProblems = (edges) => {
  const accepted = createEdgeIndex()
  const problems = []
  for (const edge of edges) {
    const kind = accepted.problemFor(edge)
    if (kind) problems.push({ kind, edge })
    else accepted.add(edge)
  }
  return problems
}
