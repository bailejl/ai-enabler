// The canvas adapter: project to view, view events to commands.
import { toExportEdge, toExportNode } from './projectFile.js'
import { withAriaLabel } from './step.js'

const NODE_VIEW_FIELDS = ['selected', 'measured']
const EDGE_VIEW_FIELDS = ['selected']

// The listed view fields that `previous` has, so an item never gains a field set to undefined.
const keepView = (previous, fields) =>
  Object.fromEntries(
    fields.filter((field) => previous?.[field] !== undefined).map((f) => [f, previous[f]]),
  )

const byId = (items) => new Map(items.map((item) => [item.id, item]))

/**
 * The canvas for a project: each node and edge as the project has it (position and data included)
 * with the view state of the same id in `previous` carried over (`selected` and `measured` on
 * nodes, `selected` on edges). A dragged view position never survives: the project decides.
 * @param {{ nodes: object[], edges: object[] }} previous the canvas as it is now
 * @param {{ nodes: object[], edges: object[] }} project the in-memory project
 * @returns {{ nodes: object[], edges: object[] }}
 */
export const syncCanvas = (previous, project) => {
  const previousNodes = byId(previous.nodes)
  const previousEdges = byId(previous.edges)
  return {
    nodes: project.nodes.map((node, index) => ({
      ...withAriaLabel(toExportNode(node), index),
      ...keepView(previousNodes.get(node.id), NODE_VIEW_FIELDS),
    })),
    edges: project.edges.map((edge) => ({
      ...toExportEdge(edge),
      ...keepView(previousEdges.get(edge.id), EDGE_VIEW_FIELDS),
    })),
  }
}

/** The edit for a drag from one step to another: React Flow's handle ids are left behind. */
export const connectEdit = ({ source, target }) => [
  { name: 'connect', args: { sourceId: source, targetId: target } },
]

/**
 * The edit for a delete of the selected `nodes` and `edges`: a `disconnect` for each connection
 * that is not attached to a deleted step, then a `remove_step` for each step (which removes its
 * own connections).
 */
export const deleteEdit = ({ nodes, edges }) => {
  const removedIds = new Set(nodes.map((node) => node.id))
  const edgesToDisconnect = edges.filter(
    (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target),
  )
  return [
    ...edgesToDisconnect.map((edge) => ({
      name: 'disconnect',
      args: { sourceId: edge.source, targetId: edge.target },
    })),
    ...nodes.map((node) => ({ name: 'remove_step', args: { stepId: node.id } })),
  ]
}

const isSamePosition = (a, b) => a?.x === b?.x && a?.y === b?.y

// A move is final when it is a position change that is not mid-drag. React Flow sends
// `dragging: false` for the drop of a drag and for each arrow-key move.
const isSettledMove = (change) =>
  change.type === 'position' && change.dragging === false && change.position !== undefined

/**
 * The edit for the moves in one `onNodesChange` call: one `move_step` for each drop whose position
 * differs from the project's. In-progress drag positions (`dragging: true`) and every other kind
 * of change build nothing, so a click or a selection never runs a command.
 * @param {object[]} changes React Flow node changes
 * @param {{ nodes: object[] }} project
 */
export const moveEdit = (changes, project) => {
  const settled = changes.filter(isSettledMove)
  if (settled.length === 0) return []
  const nodes = byId(project.nodes)
  return settled
    .filter((change) => !isSamePosition(change.position, nodes.get(change.id)?.position))
    .map(({ id, position }) => ({
      name: 'move_step',
      args: { stepId: id, x: position.x, y: position.y },
    }))
}
