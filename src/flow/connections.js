export const PROBLEM_SELF = 'self'
export const PROBLEM_DUPLICATE = 'duplicate'
export const PROBLEM_LOOP = 'loop'

// A step always reaches itself. Terminates on cyclic input via the visited set.
export const reachable = (edges, from, to) => {
  const visited = new Set()
  const pending = [from]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === to) return true
    if (!visited.has(current)) {
      visited.add(current)
      edges.filter(({ source }) => source === current).forEach(({ target }) => pending.push(target))
    }
  }
  return false
}

export const connectionProblem = (edges, { source, target }) => {
  if (source === target) return PROBLEM_SELF
  if (edges.some((edge) => edge.source === source && edge.target === target)) {
    return PROBLEM_DUPLICATE
  }
  if (reachable(edges, target, source)) return PROBLEM_LOOP
  return null
}

export const isValidConnection = (edges) => (connection) =>
  connectionProblem(edges, connection) === null

// Checks each edge against the accepted edges before it, in order.
// Returns [{ kind, edge }] for every rejected edge.
export const findEdgeProblems = (edges) =>
  edges.reduce(
    ({ accepted, problems }, edge) => {
      const kind = connectionProblem(accepted, edge)
      return kind
        ? { accepted, problems: [...problems, { kind, edge }] }
        : { accepted: [...accepted, edge], problems }
    },
    { accepted: [], problems: [] },
  ).problems
