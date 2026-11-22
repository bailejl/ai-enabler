import { initialEdges, initialNodes } from './initialFlow.js'
import { toMemoryProject } from './projectFile.js'

export const DEFAULT_PROJECT_NAME = 'Untitled Project'

export const createStarterProject = ({ newId = () => crypto.randomUUID() } = {}) => ({
  id: newId(),
  name: DEFAULT_PROJECT_NAME,
})

/**
 * The starter map as an in-memory project (`{ project, nodes, edges }`), cut to the fields a
 * project file carries: runtime fields such as `ariaLabel` are left to the canvas.
 */
export const createStarterMemoryProject = ({ newId } = {}) =>
  toMemoryProject({
    project: createStarterProject({ newId }),
    nodes: initialNodes,
    edges: initialEdges,
  })
