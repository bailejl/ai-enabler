import { problem } from '../diagnostics/problem.js'
import { shorten } from '../text.js'

// What a summary calls a step: its title in quotes. An id no step has is shown as given.
const titleOf = (project, id) => {
  const step = project.nodes.find((node) => node.id === id)
  return `"${shorten(step ? step.data.label : id)}"`
}

// connect only adds the connection. Self, duplicate, loop and missing-endpoint cases are the
// project validator's to reject, so their codes and messages come from its results.
const connect = (project, { sourceId, targetId }, { newId }) => {
  const id = newId()
  return {
    project: { ...project, edges: [...project.edges, { id, source: sourceId, target: targetId }] },
    summary: `Connected ${titleOf(project, sourceId)} to ${titleOf(project, targetId)} (${shorten(id)})`,
    created: id,
  }
}

const disconnect = (project, { sourceId, targetId }) => {
  const edges = project.edges.filter((edge) => edge.source !== sourceId || edge.target !== targetId)
  if (edges.length === project.edges.length) {
    return {
      problems: [
        problem('CONN_NOT_FOUND', {
          params: { source: shorten(sourceId), target: shorten(targetId) },
          untrusted: { source: sourceId, target: targetId },
        }),
      ],
    }
  }
  return {
    project: { ...project, edges },
    summary: `Disconnected ${titleOf(project, sourceId)} from ${titleOf(project, targetId)}`,
  }
}

export const CONNECTION_COMMANDS = {
  connect: { args: ['sourceId', 'targetId'], apply: connect },
  disconnect: { args: ['sourceId', 'targetId'], apply: disconnect },
}
