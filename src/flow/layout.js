// Matches `--card-width: 9rem` in src/index.css at a 16px root.
export const STEP_CARD_WIDTH = 144
// Above the tallest card.
export const STEP_CARD_HEIGHT = 240
export const COLUMN_GAP = 56
export const ROW_GAP = 24

const COLUMN_PITCH = STEP_CARD_WIDTH + COLUMN_GAP
const ROW_PITCH = STEP_CARD_HEIGHT + ROW_GAP

/**
 * Column of each step: the longest path from a source. An edge back into a step already on the
 * current path is skipped, so a loop cannot recurse forever.
 *
 * @returns {Map<string, number>} step id to column index
 */
const assignColumns = (nodes, edges) => {
  const columns = new Map()
  const columnOf = (id, path = new Set()) => {
    if (columns.has(id)) return columns.get(id)
    const onPath = new Set(path).add(id)
    const column = edges
      .filter((e) => e.target === id && !onPath.has(e.source))
      .reduce((max, e) => Math.max(max, columnOf(e.source, onPath) + 1), 0)
    columns.set(id, column)
    return column
  }
  nodes.forEach((node) => columnOf(node.id))
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
 * Lay steps out left to right so every connection points forward.
 *
 * @param {{ id: string }[]} nodes in file order
 * @param {{ source: string, target: string }[]} edges
 * @returns {object[]} new nodes with a position; inputs are not mutated
 */
export const layoutSteps = (nodes, edges) => {
  const positions = placeRows(nodes, assignColumns(nodes, edges))
  return nodes.map((node, i) => ({ ...node, position: positions[i] }))
}
