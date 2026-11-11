/**
 * Starter value stream: the stages from idea to production, left to right.
 * Ids are stable slugs so reordering or inserting stages does not change identity.
 */
const STAGES = [
  { id: 'idea', label: 'Idea' },
  { id: 'plan', label: 'Plan' },
  { id: 'build', label: 'Build' },
  { id: 'test', label: 'Test' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'production', label: 'Production' },
]

export const STAGE_SPACING = 200

/**
 * @param {{ id: string, label: string }[]} stages
 * @returns {{ id: string, position: { x: number, y: number }, data: { label: string } }[]}
 */
export const toNodes = (stages) =>
  stages.map(({ id, label }, i) => ({
    id,
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
  nodes.slice(1).map((target, i) => {
    const source = nodes[i]
    return { id: `${source.id}->${target.id}`, source: source.id, target: target.id }
  })

export const initialNodes = toNodes(STAGES)
export const initialEdges = toEdges(initialNodes)
