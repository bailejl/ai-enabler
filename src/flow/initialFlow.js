/**
 * Starter value stream: the stages from idea to production, left to right.
 */
const STAGES = ['Idea', 'Plan', 'Build', 'Test', 'Deploy', 'Production']

const STAGE_SPACING = 200

/**
 * @param {string[]} stages
 * @returns {{ id: string, position: { x: number, y: number }, data: { label: string } }[]}
 */
export const toNodes = (stages) =>
  stages.map((label, i) => ({
    id: `stage-${i}`,
    position: { x: i * STAGE_SPACING, y: 0 },
    data: { label },
  }))

/**
 * Connect each node to the next one in order.
 *
 * @param {{ id: string }[]} nodes
 * @returns {{ id: string, source: string, target: string }[]}
 */
export const toEdges = (nodes) =>
  nodes.slice(1).map((node, i) => ({
    id: `${nodes[i].id}->${node.id}`,
    source: nodes[i].id,
    target: node.id,
  }))

export const initialNodes = toNodes(STAGES)
export const initialEdges = toEdges(initialNodes)
