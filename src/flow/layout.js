// Matches `--card-width: 9rem` in src/index.css at a 16px root.
export const STEP_CARD_WIDTH = 144
// A chosen row pitch, taller than a card with every metric filled in.
export const STEP_ROW_HEIGHT = 240
export const COLUMN_GAP = 56
export const ROW_GAP = 24

const COLUMN_PITCH = STEP_CARD_WIDTH + COLUMN_GAP
const ROW_PITCH = STEP_ROW_HEIGHT + ROW_GAP

// The key of a connection in a Set: its ends joined by a character no step id holds.
const edgeKey = (source, target) => `${source}\u0000${target}`

// Outgoing connections per step id, in file order. Connections to unknown steps are ignored.
const indexTargets = (nodes, edges) => {
  const ids = new Set(nodes.map((node) => node.id))
  const known = edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  const bySource = Map.groupBy(known, (e) => e.source)
  return new Map(nodes.map(({ id }) => [id, (bySource.get(id) ?? []).map((e) => e.target)]))
}

// One step of the walk, from the step on top of the stack: leave it when it has no connection
// left, otherwise follow its next one. A connection back to a step still on the path closes a loop.
const advanceWalk = ({ stack, onPath, done, backEdges }, targets) => {
  const frame = stack[stack.length - 1]
  const target = targets.get(frame.id)[frame.next]
  if (target === undefined) {
    stack.pop()
    onPath.delete(frame.id)
    done.add(frame.id)
    return
  }
  frame.next += 1
  if (onPath.has(target)) backEdges.add(edgeKey(frame.id, target))
  else if (!done.has(target)) {
    onPath.add(target)
    stack.push({ id: target, next: 0 })
  }
}

// Connections that close a loop: found by a depth-first walk from each step in file order, an
// edge back to a step still on the walk's path. Iterative, so a long chain cannot overflow the
// stack. Returns a Set of edgeKey keys.
const findBackEdges = (nodes, targets) => {
  const backEdges = new Set()
  const done = new Set()
  nodes.forEach(({ id: root }) => {
    if (done.has(root)) return
    const walk = { stack: [{ id: root, next: 0 }], onPath: new Set([root]), done, backEdges }
    while (walk.stack.length > 0) advanceWalk(walk, targets)
  })
  return backEdges
}

/**
 * Column of each step: the longest path from a source, ignoring the connections that close a
 * loop. Computed in topological order over the remaining connections.
 *
 * @returns {Map<string, number>} step id to column index
 */
const assignColumns = (nodes, edges) => {
  const targets = indexTargets(nodes, edges)
  const backEdges = findBackEdges(nodes, targets)
  const forward = new Map(
    nodes.map(({ id }) => [
      id,
      targets.get(id).filter((target) => !backEdges.has(edgeKey(id, target))),
    ]),
  )
  const incoming = new Map(nodes.map(({ id }) => [id, 0]))
  forward.forEach((list) => list.forEach((t) => incoming.set(t, incoming.get(t) + 1)))
  const columns = new Map(nodes.map(({ id }) => [id, 0]))
  const ready = nodes.map(({ id }) => id).filter((id) => incoming.get(id) === 0)
  for (let i = 0; i < ready.length; i += 1) {
    const id = ready[i]
    forward.get(id).forEach((target) => {
      columns.set(target, Math.max(columns.get(target), columns.get(id) + 1))
      incoming.set(target, incoming.get(target) - 1)
      if (incoming.get(target) === 0) ready.push(target)
    })
  }
  return columns
}

/**
 * Stack the steps of each column top to bottom in file order.
 *
 * @returns {{ x: number, y: number }[]} one position per node, in node order
 */
const placeRows = (nodes, columns) => {
  const rowsUsed = new Map()
  return nodes.map((node) => {
    const column = columns.get(node.id)
    const row = rowsUsed.get(column) ?? 0
    rowsUsed.set(column, row + 1)
    return { x: column * COLUMN_PITCH, y: row * ROW_PITCH }
  })
}

/**
 * Lay steps out left to right so every connection points forward, except a connection that closes
 * a loop.
 *
 * @param {{ id: string }[]} nodes in file order
 * @param {{ source: string, target: string }[]} edges
 * @returns {object[]} new nodes with a position; inputs are not mutated
 */
export const layoutSteps = (nodes, edges) => {
  const positions = placeRows(nodes, assignColumns(nodes, edges))
  return nodes.map((node, i) => ({ ...node, position: positions[i] }))
}

/** Where a step starts before anyone places it: the origin. */
export const START_POSITION = Object.freeze({ x: 0, y: 0 })

/** True when the step is still at the start position, so no one has placed it. */
export const isUnplaced = ({ position }) =>
  position?.x === START_POSITION.x && position?.y === START_POSITION.y

// Where layoutUnplacedSteps starts its grid: one gap in from the start position, so a step it
// lays out is never taken for one still unplaced.
export const UNPLACED_LAYOUT_ORIGIN = Object.freeze({ x: COLUMN_GAP, y: ROW_GAP })

const cardsOverlap = (a, b) =>
  Math.abs(a.x - b.x) < STEP_CARD_WIDTH && Math.abs(a.y - b.y) < STEP_ROW_HEIGHT

// The first position at or below `slot`, one row at a time, that overlaps no taken position.
const firstFreeBelow = (slot, taken) => {
  const isFree = (y) => !taken.some((position) => cardsOverlap({ x: slot.x, y }, position))
  let y = slot.y
  while (!isFree(y)) y += ROW_PITCH
  return { x: slot.x, y }
}

/**
 * Lays out only the steps still at the start position and keeps every other step where the user
 * put it. Each unplaced step takes the column and row layoutSteps gives it, offset by
 * UNPLACED_LAYOUT_ORIGIN, moved down a row at a time until it overlaps no other step.
 *
 * @param {{ id: string, position: { x: number, y: number } }[]} nodes in file order
 * @param {{ source: string, target: string }[]} edges
 * @returns {object[]} new nodes; inputs are not mutated
 */
export const layoutUnplacedSteps = (nodes, edges) => {
  const laidOut = layoutSteps(nodes, edges)
  const placedPositions = nodes.filter((node) => !isUnplaced(node)).map((node) => node.position)
  const { result } = nodes.reduce(
    ({ result: done, taken }, node, i) => {
      if (!isUnplaced(node)) return { result: [...done, node], taken }
      const { x, y } = laidOut[i].position
      const slot = { x: x + UNPLACED_LAYOUT_ORIGIN.x, y: y + UNPLACED_LAYOUT_ORIGIN.y }
      const position = firstFreeBelow(slot, taken)
      return { result: [...done, { ...node, position }], taken: [...taken, position] }
    },
    { result: [], taken: placedPositions },
  )
  return result
}
