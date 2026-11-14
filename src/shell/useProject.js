import { addEdge, useEdgesState, useNodesState } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { initialEdges, initialNodes } from '../flow/initialFlow.js'
import { createStarterProject } from '../flow/project.js'
import { projectFileName, toProjectFile } from '../flow/projectFile.js'
import { downloadTextFile } from './download.js'

const JSON_INDENT = 2

export const useProject = () => {
  const [project] = useState(createStarterProject)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const onConnect = useCallback(
    (params) => setEdges((currentEdges) => addEdge(params, currentEdges)),
    [setEdges],
  )
  // Returns the downloaded file name so the caller can announce it.
  const exportProject = useCallback(() => {
    const projectFile = toProjectFile({ project, nodes, edges, now: new Date() })
    const fileName = projectFileName(project.name)
    downloadTextFile(fileName, JSON.stringify(projectFile, null, JSON_INDENT))
    return fileName
  }, [project, nodes, edges])
  return {
    project,
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    onConnect,
    exportProject,
  }
}
