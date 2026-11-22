import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IMPORT_CONFIRMING,
  IMPORT_ERROR,
  IMPORT_EVENT,
  INITIAL_IMPORT_STATE,
  reduceImport,
} from '../flow/importFlow.js'
import { parseImport, unreadableImport } from '../flow/importFile.js'
import { syncCanvas } from '../flow/canvas.js'
import { createStarterMemoryProject } from '../flow/project.js'
import {
  projectFileName,
  serializeProjectFile,
  toMemoryProject,
  toProjectFile,
  withContentHash,
} from '../flow/projectFile.js'
import { report } from './diagnostics.js'
import { downloadTextFile } from './download.js'
import { useCanvasEdits } from './useCanvasEdits.js'

// A file the browser cannot read is reported like any other file that cannot be imported.
const readImport = async (file) => {
  try {
    return await parseImport(await file.text())
  } catch {
    return unreadableImport()
  }
}

// Runs import events through the pure reducer and performs what it asks for: speak, replace the
// map, write each rejected problem to the console as a diagnostic record, and hand focus back to the Import button once the dialog (if any) has gone. A rejection
// keeps focus off the button: the status heading takes it, and Dismiss returns it to the button.
const useImportFlow = ({ projectRef, applyReplacement, announce, returnFocusRef }) => {
  const [importState, setImportState] = useState(INITIAL_IMPORT_STATE)
  const previousState = useRef(importState)
  // The newest state, written only where a state is set. The reducer runs against this, not the
  // state a callback captured at render time, so a dispatch after an `await` sees every earlier one.
  const latestImportState = useRef(importState)
  const latestRequestId = useRef(0)
  useEffect(() => {
    const hasChanged = previousState.current !== importState
    previousState.current = importState
    const keepsFocus = importState.type === IMPORT_CONFIRMING || importState.type === IMPORT_ERROR
    if (hasChanged && !keepsFocus) returnFocusRef.current?.focus()
    if (hasChanged && importState.type === IMPORT_ERROR) importState.problems.forEach(report)
  }, [importState, returnFocusRef])

  const dispatchImport = useCallback(
    (event) => {
      const { state, announcement, replacement } = reduceImport(latestImportState.current, event)
      latestImportState.current = state
      setImportState(state)
      if (announcement) announce(announcement)
      if (replacement) applyReplacement(replacement)
    },
    [announce, applyReplacement],
  )

  // When two reads overlap, only the one started last may change the state.
  const importFile = useCallback(
    async (file) => {
      latestRequestId.current += 1
      const requestId = latestRequestId.current
      const result = await readImport(file)
      if (requestId === latestRequestId.current) {
        // The newest project, so a read that finishes after a confirm or an edit compares the file
        // with the project now open.
        const { project } = projectRef.current
        dispatchImport({ type: IMPORT_EVENT.fileParsed, result, project })
      }
    },
    [dispatchImport, projectRef],
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

const NO_CANVAS = { nodes: [], edges: [] }

// The one in-memory project (`{ project, nodes, edges }`) and the canvas drawn from it. Export,
// the metrics and the canvas all read it; the canvas edits and import's replacement write it.
export const useProject = ({ announce, importButtonRef, canvasElementRef }) => {
  const [project, setProject] = useState(createStarterMemoryProject)
  // The newest project, written only where the project is set, so a handler never reads one it
  // captured at render time.
  const latestProject = useRef(project)
  const commitProject = useCallback((next) => {
    latestProject.current = next
    setProject(next)
  }, [])
  const canvasEdits = useCanvasEdits({
    initialProject: project,
    projectRef: latestProject,
    commitProject,
    canvasElementRef,
  })
  const { setCanvas } = canvasEdits
  const { fitView } = useReactFlow()
  // Fitting must wait for React Flow to hold the replaced nodes, so a replacement only asks for it.
  const [fitRequestCount, setFitRequestCount] = useState(0)
  const applyReplacement = useCallback(
    (replacement) => {
      const next = toMemoryProject(replacement)
      commitProject(next)
      setCanvas(syncCanvas(NO_CANVAS, next))
      setFitRequestCount((count) => count + 1)
    },
    [commitProject, setCanvas],
  )
  useEffect(() => {
    if (fitRequestCount > 0) fitView()
  }, [fitRequestCount, fitView])
  const importFlow = useImportFlow({
    projectRef: latestProject,
    applyReplacement,
    announce,
    returnFocusRef: importButtonRef,
  })
  // Returns the downloaded file name so the caller can announce it.
  const exportProject = useCallback(async () => {
    const projectFile = toProjectFile({ ...latestProject.current, now: new Date() })
    const fileName = projectFileName(latestProject.current.project.name)
    downloadTextFile(fileName, serializeProjectFile(await withContentHash(projectFile)))
    return fileName
  }, [])
  return {
    projectName: project.project.name,
    steps: project.nodes.map((node) => node.data),
    exportProject,
    ...canvasEdits,
    ...importFlow,
  }
}
