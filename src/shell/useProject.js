import { addEdge, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IMPORT_CONFIRMING, INITIAL_IMPORT_STATE, reduceImport } from '../flow/importFlow.js'
import { parseImport } from '../flow/importFile.js'
import { initialEdges, initialNodes } from '../flow/initialFlow.js'
import { createStarterProject } from '../flow/project.js'
import { projectFileName, toProjectFile } from '../flow/projectFile.js'
import { downloadTextFile } from './download.js'

const JSON_INDENT = 2

// Runs import events through the pure reducer and performs what it asks for: speak, replace the
// map, and hand focus back to the Import button once the dialog (if any) has gone.
const useImportFlow = ({ project, applyReplacement, announce, returnFocusRef }) => {
  const [importState, setImportState] = useState(INITIAL_IMPORT_STATE)
  const previousState = useRef(importState)

  useEffect(() => {
    const hasChanged = previousState.current !== importState
    previousState.current = importState
    if (hasChanged && importState.type !== IMPORT_CONFIRMING) returnFocusRef.current?.focus()
  }, [importState, returnFocusRef])

  const dispatchImport = useCallback(
    (event) => {
      const { state, announcement, replacement } = reduceImport(importState, event)
      setImportState(state)
      if (announcement) announce(announcement)
      if (replacement) applyReplacement(replacement)
    },
    [importState, announce, applyReplacement],
  )

  const importFile = useCallback(
    async (file) =>
      dispatchImport({ type: 'fileParsed', result: parseImport(await file.text()), project }),
    [dispatchImport, project],
  )
  const confirmImport = useCallback(() => dispatchImport({ type: 'confirm' }), [dispatchImport])
  const cancelImport = useCallback(() => dispatchImport({ type: 'cancel' }), [dispatchImport])
  const dismissImportError = useCallback(
    () => dispatchImport({ type: 'dismiss' }),
    [dispatchImport],
  )

  return { importState, importFile, confirmImport, cancelImport, dismissImportError }
}

export const useProject = ({ announce, importButtonRef }) => {
  const [project, setProject] = useState(createStarterProject)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const { fitView } = useReactFlow()
  const onConnect = useCallback(
    (params) => setEdges((currentEdges) => addEdge(params, currentEdges)),
    [setEdges],
  )
  const applyReplacement = useCallback(
    (replacement) => {
      setProject(replacement.project)
      setNodes(replacement.nodes)
      setEdges(replacement.edges)
      fitView()
    },
    [setNodes, setEdges, fitView],
  )
  const importFlow = useImportFlow({
    project,
    applyReplacement,
    announce,
    returnFocusRef: importButtonRef,
  })
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
    ...importFlow,
  }
}
