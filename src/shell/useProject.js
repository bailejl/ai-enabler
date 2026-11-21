import { addEdge, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IMPORT_CONFIRMING,
  IMPORT_ERROR,
  IMPORT_EVENT,
  INITIAL_IMPORT_STATE,
  reduceImport,
} from '../flow/importFlow.js'
import { parseImport, unreadableImport } from '../flow/importFile.js'
import { initialEdges, initialNodes } from '../flow/initialFlow.js'
import { createStarterProject } from '../flow/project.js'
import { projectFileName, toProjectFile, withContentHash } from '../flow/projectFile.js'
import { downloadTextFile } from './download.js'

const JSON_INDENT = 2

// A file the browser cannot read is reported like any other file that cannot be imported.
const readImport = async (file) => {
  try {
    return await parseImport(await file.text())
  } catch {
    return unreadableImport()
  }
}

// Runs import events through the pure reducer and performs what it asks for: speak, replace the
// map, and hand focus back to the Import button once the dialog (if any) has gone. A rejection
// keeps focus off the button: the status heading takes it, and Dismiss returns it to the button.
const useImportFlow = ({ project, applyReplacement, announce, returnFocusRef }) => {
  const [importState, setImportState] = useState(INITIAL_IMPORT_STATE)
  const previousState = useRef(importState)
  const latestRequestId = useRef(0)

  useEffect(() => {
    const hasChanged = previousState.current !== importState
    previousState.current = importState
    const keepsFocus = importState.type === IMPORT_CONFIRMING || importState.type === IMPORT_ERROR
    if (hasChanged && !keepsFocus) returnFocusRef.current?.focus()
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

  // When two reads overlap, only the one started last may change the state.
  const importFile = useCallback(
    async (file) => {
      latestRequestId.current += 1
      const requestId = latestRequestId.current
      const result = await readImport(file)
      if (requestId === latestRequestId.current) {
        dispatchImport({ type: IMPORT_EVENT.fileParsed, result, project })
      }
    },
    [dispatchImport, project],
  )
  const confirmImport = useCallback(
    () => dispatchImport({ type: IMPORT_EVENT.confirm }),
    [dispatchImport],
  )
  const cancelImport = useCallback(
    () => dispatchImport({ type: IMPORT_EVENT.cancel }),
    [dispatchImport],
  )
  const dismissImportError = useCallback(
    () => dispatchImport({ type: IMPORT_EVENT.dismiss }),
    [dispatchImport],
  )

  return { importState, importFile, confirmImport, cancelImport, dismissImportError }
}

export const useProject = ({ announce, importButtonRef }) => {
  const [project, setProject] = useState(createStarterProject)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const { fitView } = useReactFlow()
  // Fitting must wait for React Flow to hold the replaced nodes, so a replacement only asks for it.
  const [fitRequestCount, setFitRequestCount] = useState(0)
  const onConnect = useCallback(
    (params) => setEdges((currentEdges) => addEdge(params, currentEdges)),
    [setEdges],
  )
  const applyReplacement = useCallback(
    (replacement) => {
      setProject(replacement.project)
      setNodes(replacement.nodes)
      setEdges(replacement.edges)
      setFitRequestCount((count) => count + 1)
    },
    [setNodes, setEdges],
  )
  useEffect(() => {
    if (fitRequestCount > 0) fitView()
  }, [fitRequestCount, fitView])
  const importFlow = useImportFlow({
    project,
    applyReplacement,
    announce,
    returnFocusRef: importButtonRef,
  })
  // Returns the downloaded file name so the caller can announce it.
  const exportProject = useCallback(async () => {
    const projectFile = toProjectFile({ project, nodes, edges, now: new Date() })
    const fileName = projectFileName(project.name)
    downloadTextFile(
      fileName,
      JSON.stringify(await withContentHash(projectFile), null, JSON_INDENT),
    )
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
