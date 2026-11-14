import { addEdge, useEdgesState, useNodesState } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { initialEdges, initialNodes } from '../flow/initialFlow.js'
import { createStarterProject } from '../flow/project.js'

export const useProject = () => {
  const [project] = useState(createStarterProject)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const onConnect = useCallback(
    (params) => setEdges((currentEdges) => addEdge(params, currentEdges)),
    [setEdges],
  )
  return { project, nodes, setNodes, onNodesChange, edges, setEdges, onEdgesChange, onConnect }
}
