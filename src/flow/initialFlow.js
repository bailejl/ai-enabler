/**
 * Starter value stream: the stages from idea to production, left to right.
 * Ids are stable slugs so reordering or inserting stages does not change identity.
 * Durations (pt, lt) are integer minutes; ca is a percentage; batch is absent when unset.
 */
const STAGES = [
  { id: 'idea', label: 'Idea', pt: 120, lt: 1440, ca: 90, queue: 20 },
  { id: 'plan', label: 'Plan', pt: 360, lt: 960, ca: 90, queue: 3 },
  { id: 'build', label: 'Build', pt: 480, lt: 1200, ca: 90, queue: 4 },
  { id: 'test', label: 'Test', pt: 240, lt: 1200, ca: 90, queue: 5 },
  { id: 'deploy', label: 'Deploy', pt: 240, lt: 720, ca: 90, queue: 1 },
  { id: 'production', label: 'Production', pt: 120, lt: 480, ca: 90, queue: 1, batch: 3 },
]

export const STAGE_SPACING = 200

/**
 * @param {{ id: string, label: string }[]} stages every field besides id becomes node data
 * @returns {{ id: string, position: { x: number, y: number }, data: { label: string } }[]}
 */
export const toNodes = (stages) =>
  stages.map(({ id, ...data }, i) => ({
    id,
    position: { x: i * STAGE_SPACING, y: 0 },
    data,
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
