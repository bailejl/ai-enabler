// Deleting from the keyboard removes the focused element, so focus must land somewhere sensible.
// Returns the id of the step to focus, or null when no step is a fit and the canvas takes focus.
// Deleted steps: the next remaining step in order, else the nearest earlier one.
// Only connections deleted: the step the first one started from.
export const pickFocusAfterDelete = ({ nodes, deletedNodes, deletedEdges }) => {
  const deletedIds = new Set(deletedNodes.map((node) => node.id))
  const remaining = nodes.filter((node) => !deletedIds.has(node.id))
  if (deletedIds.size > 0) {
    const firstDeletedIndex = nodes.findIndex((node) => deletedIds.has(node.id))
    const next = remaining.find((node) => nodes.indexOf(node) > firstDeletedIndex)
    return (next ?? remaining.at(-1))?.id ?? null
  }
  const source = deletedEdges[0]?.source
  return remaining.some((node) => node.id === source) ? source : null
}
